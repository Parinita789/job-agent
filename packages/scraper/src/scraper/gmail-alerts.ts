import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import * as fs from 'fs';
import type { JobListing } from '../types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseEmailForJobUrls(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  // Decode quoted-printable
  const decoded = html
    .replace(/=\r?\n/g, '')
    .replace(/=3D/gi, '=')
    .replace(/=26/gi, '&')
    .replace(/=3F/gi, '?');

  // Match LinkedIn job URLs — require at least 7 digits
  const patterns = [
    /https?:\/\/(?:www\.)?linkedin\.com\/(?:comm\/)?jobs\/view\/(\d{7,})/g,
    /https?:\/\/(?:www\.)?linkedin\.com\/job\/[^"'\s]*?currentJobId=(\d{7,})/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(decoded)) !== null) {
      const jobId = match[1];
      if (!seen.has(jobId)) {
        seen.add(jobId);
        urls.push(`https://www.linkedin.com/jobs/view/${jobId}`);
      }
    }
  }

  return urls;
}

async function scrapeJobPage(
  page: import('playwright').Page,
  url: string,
): Promise<JobListing | null> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(1500 + Math.random() * 1500);

    await page.waitForSelector('h1', { timeout: 10000 }).catch(() => null);

    const title = await page.$eval('h1', (el: Element) => el.textContent?.trim() ?? '').catch(() => '');

    const company = await page.$eval(
      [
        '.job-details-jobs-unified-top-card__company-name a',
        '.job-details-jobs-unified-top-card__company-name',
        '.jobs-unified-top-card__company-name a',
        '.jobs-unified-top-card__company-name',
        '.topcard__org-name-link',
        '.top-card-layout__company a',
      ].join(', '),
      (el: Element) => el.textContent?.trim() ?? '',
    ).catch(() => '');

    const location = await page.$eval(
      [
        '.job-details-jobs-unified-top-card__bullet',
        '.jobs-unified-top-card__bullet',
        '.topcard__flavor--bullet',
      ].join(', '),
      (el: Element) => el.textContent?.trim() ?? '',
    ).catch(() => '');

    const description = await page.$eval(
      [
        '#job-details',
        '.jobs-description__content',
        '.jobs-description-content',
        '.description__text',
        '.show-more-less-html__markup',
      ].join(', '),
      (el: Element) => el.textContent?.trim() ?? '',
    ).catch(() => '');

    if (!title || !company) return null;

    const isRemote = [title, location, description].join(' ').toLowerCase().includes('remote');

    return {
      id: crypto.createHash('md5').update(`linkedin-${url}`).digest('hex').slice(0, 10),
      title,
      company,
      location,
      remote: isRemote,
      employment_type: 'full-time',
      description,
      url,
      source: 'linkedin',
      scraped_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function fetchGmailAlerts(): Promise<JobListing[]> {
  const email = process.env.GMAIL_EMAIL || 'jobhunt2k26@gmail.com';
  const password = process.env.GMAIL_APP_PASSWORD;

  if (!password) {
    console.log('  GMAIL_APP_PASSWORD not set in .env — skipping Gmail fetch');
    return [];
  }

  console.log(`  Connecting to Gmail (${email})...`);

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
  });

  const allUrls: string[] = [];
  const seenUrls = new Set<string>();

  try {
    await client.connect();
    console.log('  Connected to Gmail');

    const lock = await client.getMailboxLock('INBOX');

    try {
      // Search for LinkedIn job alert emails from last 7 days
      const since = new Date();
      since.setDate(since.getDate() - 7);

      // Search for all emails from last 7 days, then filter for LinkedIn job content
      const uids = await client.search({ since });
      console.log(`  Found ${uids.length} emails since ${since.toLocaleDateString()}`);

      let emailCount = 0;
      let linkedinCount = 0;
      if (uids.length > 0) {
        const messages = client.fetch(uids, { source: true });

        for await (const msg of messages) {
          const parsed = await simpleParser(msg.source);
          const html = parsed.html || parsed.textAsHtml || parsed.text || '';
          const urls = parseEmailForJobUrls(html as string);

          // Skip emails with no LinkedIn job URLs
          if (urls.length === 0) continue;

          linkedinCount++;
          emailCount++;
          console.log(`  Email ${emailCount}: "${parsed.subject?.slice(0, 60)}" → ${urls.length} job links`);

          for (const url of urls) {
            if (!seenUrls.has(url)) {
              seenUrls.add(url);
              allUrls.push(url);
            }
          }
        }
      }

      console.log(`  LinkedIn alert emails: ${linkedinCount} out of ${uids.length} total`);

      console.log(`  Processed ${emailCount} emails, ${allUrls.length} unique job URLs`);
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    console.error(`  Gmail fetch failed: ${(err as Error).message}`);
    return [];
  }

  if (allUrls.length === 0) return [];

  // Scrape job details from LinkedIn
  console.log(`  Scraping ${allUrls.length} job pages...`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  // Load LinkedIn session
  const sessionFile = path.join(__dirname, '../../data/linkedin-session.json');
  if (fs.existsSync(sessionFile)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      await context.addCookies(cookies);
      console.log('  Loaded LinkedIn session');
    } catch { /* ignore */ }
  }

  const page = await context.newPage();
  const jobs: JobListing[] = [];

  for (let i = 0; i < allUrls.length; i++) {
    console.log(`  Scraping ${i + 1}/${allUrls.length}: ${allUrls[i]}`);
    const job = await scrapeJobPage(page, allUrls[i]);
    if (job) {
      console.log(`    ${job.title} @ ${job.company}`);
      jobs.push(job);
    }
  }

  await browser.close();

  console.log(`  Scraped ${jobs.length} jobs from ${allUrls.length} URLs`);
  return jobs;
}
