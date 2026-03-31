import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import type { JobListing } from '../types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALERTS_DIR = path.join(__dirname, '../../data/email-alerts');
const PROCESSED_DIR = path.join(ALERTS_DIR, 'processed');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Parse LinkedIn job alert .eml files for job URLs.
 * LinkedIn alert emails contain links like:
 *   https://www.linkedin.com/comm/jobs/view/1234567
 *   https://www.linkedin.com/jobs/view/1234567
 */
function decodeQuotedPrintable(text: string): string {
  // Remove soft line breaks (=\r\n or =\n) that split URLs
  return text
    .replace(/=\r?\n/g, '')
    .replace(/=3D/gi, '=')
    .replace(/=26/gi, '&')
    .replace(/=3F/gi, '?');
}

function parseEmlForJobUrls(emlContent: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  // Decode quoted-printable encoding to reconstruct split URLs
  const decoded = decodeQuotedPrintable(emlContent);

  // Match LinkedIn job URLs — require at least 7 digits for valid job IDs
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

/**
 * Read all .eml files from the email-alerts directory.
 */
function loadEmlFiles(): { filename: string; content: string }[] {
  if (!fs.existsSync(ALERTS_DIR)) {
    fs.mkdirSync(ALERTS_DIR, { recursive: true });
    return [];
  }

  return fs
    .readdirSync(ALERTS_DIR)
    .filter((f) => f.endsWith('.eml'))
    .map((filename) => ({
      filename,
      content: fs.readFileSync(path.join(ALERTS_DIR, filename), 'utf-8'),
    }));
}

/**
 * Move processed .eml files to the processed/ subfolder.
 */
function moveToProcessed(filename: string): void {
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  const src = path.join(ALERTS_DIR, filename);
  const dest = path.join(PROCESSED_DIR, filename);
  fs.renameSync(src, dest);
}

/**
 * Visit a LinkedIn job URL and extract job details.
 */
async function scrapeJobPage(
  page: import('playwright').Page,
  url: string,
): Promise<JobListing | null> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(1500 + Math.random() * 1500);

    // Wait for the job page to fully render
    await page.waitForSelector('h1, [class*="job-title"], [class*="top-card"]', { timeout: 10000 }).catch(() => null);

    // Use $eval calls instead of page.evaluate to avoid __name issue
    const title = await page.$eval(
      'h1',
      (el: Element) => el.textContent?.trim() ?? '',
    ).catch(() => '');

    const company = await page.$eval(
      [
        '.job-details-jobs-unified-top-card__company-name a',
        '.job-details-jobs-unified-top-card__company-name',
        '.jobs-unified-top-card__company-name a',
        '.jobs-unified-top-card__company-name',
        '.topcard__org-name-link',
        '.top-card-layout__company a',
        'a[data-tracking-control-name*="company"]',
      ].join(', '),
      (el: Element) => el.textContent?.trim() ?? '',
    ).catch(() => '');

    const location = await page.$eval(
      [
        '.job-details-jobs-unified-top-card__bullet',
        '.jobs-unified-top-card__bullet',
        '.topcard__flavor--bullet',
        '.top-card-layout__bullet',
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

    const salary = await page.$eval(
      '[class*="salary"], [class*="compensation"]',
      (el: Element) => el.textContent?.trim() ?? '',
    ).catch(() => '');

    const data = { title, company, location, description, salary };

    // Debug: save screenshot on first failure to diagnose
    if (!data.title && !data.company) {
      const debugPath = path.join(__dirname, '../../data/debug-email-alert.png');
      await page.screenshot({ path: debugPath, fullPage: true }).catch(() => null);
    }

    if (!data.title || !data.company) {
      console.log(`    Skipped: missing title or company for ${url}`);
      return null;
    }

    // Extract salary
    let salaryMin: number | undefined;
    let salaryMax: number | undefined;
    const salaryMatch = data.salary.match(/\$?([\d,]+)[kK]?\s*[-–\/]\s*\$?([\d,]+)[kK]?/);
    if (salaryMatch) {
      const hasK = data.salary.toLowerCase().includes('k');
      salaryMin = parseInt(salaryMatch[1].replace(/,/g, ''), 10);
      salaryMax = parseInt(salaryMatch[2].replace(/,/g, ''), 10);
      if (hasK || salaryMin < 1000) { salaryMin *= 1000; salaryMax *= 1000; }
    }

    const isRemote = [data.title, data.location, data.description]
      .join(' ')
      .toLowerCase()
      .includes('remote');

    return {
      id: crypto
        .createHash('md5')
        .update(`linkedin-${url}`)
        .digest('hex')
        .slice(0, 10),
      title: data.title,
      company: data.company,
      location: data.location,
      remote: isRemote,
      employment_type: 'full-time',
      salary_min: salaryMin,
      salary_max: salaryMax,
      description: data.description,
      url,
      source: 'linkedin',
      scraped_at: new Date().toISOString(),
    };
  } catch (err) {
    console.log(`    Failed to scrape ${url}: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Main: parse .eml files, extract job URLs, scrape each job page.
 */
export async function scrapeEmailAlerts(): Promise<JobListing[]> {
  const emlFiles = loadEmlFiles();

  if (emlFiles.length === 0) {
    console.log('  No .eml files found in data/email-alerts/');
    return [];
  }

  console.log(`  Found ${emlFiles.length} email alert file(s)`);

  // Collect all unique job URLs
  const allUrls: string[] = [];
  const seenUrls = new Set<string>();

  for (const { filename, content } of emlFiles) {
    const urls = parseEmlForJobUrls(content);
    console.log(`  ${filename}: ${urls.length} job links`);
    for (const url of urls) {
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        allUrls.push(url);
      }
    }
  }

  console.log(`  Total unique job URLs: ${allUrls.length}`);

  if (allUrls.length === 0) {
    // Still move files to processed
    for (const { filename } of emlFiles) moveToProcessed(filename);
    return [];
  }

  // Launch browser and scrape each job page
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  // Load LinkedIn session if available
  const sessionFile = path.join(__dirname, '../../data/linkedin-session.json');
  if (fs.existsSync(sessionFile)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      await context.addCookies(cookies);
      console.log('  Loaded LinkedIn session');
    } catch {
      // ignore
    }
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

  // Move processed .eml files
  for (const { filename } of emlFiles) {
    moveToProcessed(filename);
    console.log(`  Moved ${filename} → processed/`);
  }

  console.log(`  Scraped ${jobs.length} jobs from ${allUrls.length} URLs`);
  return jobs;
}
