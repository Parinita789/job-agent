import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = path.join(__dirname, '../../data/linkedin-session.json');

async function debugCards() {
  const browser = await chromium.launch({
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });

  if (fs.existsSync(SESSION_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    await context.addCookies(cookies);
  }

  const page = await context.newPage();
  await page.goto(
    'https://www.linkedin.com/jobs/search?keywords=Node.js+TypeScript+backend+engineer+microservices&location=United+States&f_JT=F&sortBy=DD',
    { waitUntil: 'domcontentloaded', timeout: 60000 },
  );

  await new Promise((r) => setTimeout(r, 5000));

  // scroll to load all cards
  const listContainer = await page.$('.scaffold-layout__list');
  for (let s = 0; s < 3; s++) {
    if (listContainer) {
      await page.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      }, listContainer);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  const allCards = await page.$$('li.scaffold-layout__list-item');
  console.log(`\nTotal cards: ${allCards.length}\n`);

  // inspect first 5 empty cards — what classes do they have?
  let emptyCount = 0;
  for (let i = 0; i < allCards.length && emptyCount < 5; i++) {
    const card = allCards[i]!;

    const hasStandardTitle = await card.$('.job-card-list__title--link').catch(() => null);
    if (hasStandardTitle) continue; // skip cards that already work

    emptyCount++;
    console.log(`\n--- Empty card ${emptyCount} (index ${i}) ---`);

    // get all classes on all child elements
    const classes = await card.evaluate((el: Element) => {
      const all = el.querySelectorAll('*');
      const classSet = new Set<string>();
      all.forEach((e) => e.classList.forEach((c) => classSet.add(c)));
      return Array.from(classSet).filter(
        (c) => c.includes('job') || c.includes('title') || c.includes('card'),
      );
    });

    console.log('Classes:', classes.join(', '));

    // get text content
    const text = await card.evaluate((el) => el.textContent?.trim().slice(0, 100));
    console.log('Text preview:', text);
  }

  await browser.close();
}

debugCards().catch(console.error);
