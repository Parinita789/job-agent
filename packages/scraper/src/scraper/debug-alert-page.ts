// Debug script: opens the alert URL and dumps the page structure
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = path.join(__dirname, '../../data/linkedin-session.json');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ALERT_URL =
  'https://www.linkedin.com/jobs/search-results/?savedSearchId=15759912668&keywords=node.js&geoId=103644278&distance=25';

async function main() {
  const browser = await chromium.launch({
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  if (fs.existsSync(SESSION_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    await context.addCookies(cookies);
    console.log('Session loaded.');
  }

  const page = await context.newPage();

  await page.goto(ALERT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);

  console.log('Page URL:', page.url());

  // dump job links
  const jobLinks = await page.$$eval('a[href*="/jobs/view/"]', (els) => {
    return els.map((el) => ({
      cls: el.className.slice(0, 100),
      text: (el.textContent || '').trim().slice(0, 60),
      href: el.getAttribute('href')?.slice(0, 80) || '',
      parentTag: el.parentElement?.tagName || '',
      parentCls: el.parentElement?.className?.slice(0, 80) || '',
      grandparentTag: el.parentElement?.parentElement?.tagName || '',
      grandparentCls: el.parentElement?.parentElement?.className?.slice(0, 80) || '',
    }));
  });

  console.log(`\n=== ${jobLinks.length} links with /jobs/view/ ===`);
  jobLinks.forEach((l, i) => {
    console.log(`  [${i}] class="${l.cls}"`);
    console.log(`    text="${l.text}"`);
    console.log(`    parent: ${l.parentTag}.${l.parentCls}`);
    console.log(`    grandparent: ${l.grandparentTag}.${l.grandparentCls}`);
  });

  // dump data attributes
  const dataEls = await page.$$eval('[data-occludable-job-id], [data-job-id], [data-entity-urn]', (els) => {
    return els.slice(0, 20).map((el) => ({
      tag: el.tagName,
      cls: el.className.slice(0, 100),
      occludable: el.getAttribute('data-occludable-job-id') || '',
      jobId: el.getAttribute('data-job-id') || '',
      urn: el.getAttribute('data-entity-urn')?.slice(0, 60) || '',
    }));
  });

  console.log(`\n=== ${dataEls.length} elements with job data attrs ===`);
  dataEls.forEach((d, i) => {
    console.log(`  [${i}] ${d.tag} class="${d.cls}" occludable="${d.occludable}" jobId="${d.jobId}" urn="${d.urn}"`);
  });

  // dump all <li> with meaningful text
  const listItems = await page.$$eval('li', (els) => {
    return els
      .map((li) => ({
        cls: li.className.slice(0, 100),
        text: (li.textContent || '').trim().slice(0, 80),
        parentCls: li.parentElement?.className?.slice(0, 80) || '',
        childCount: li.children.length,
      }))
      .filter((li) => li.text.length > 30);
  });

  console.log(`\n=== ${listItems.length} <li> with text > 30 chars ===`);
  listItems.forEach((li, i) => {
    console.log(`  [${i}] class="${li.cls}" children=${li.childCount}`);
    console.log(`    parent="${li.parentCls}"`);
    console.log(`    text="${li.text}"`);
  });

  // save HTML + screenshot
  const html = await page.content();
  fs.writeFileSync(path.join(__dirname, '../../data/debug-alert-page.html'), html);
  console.log('\nHTML saved to data/debug-alert-page.html');

  await page.screenshot({ path: path.join(__dirname, '../../data/debug-alert-page.png'), fullPage: true });
  console.log('Screenshot saved to data/debug-alert-page.png');

  await browser.close();
}

main().catch(console.error);
