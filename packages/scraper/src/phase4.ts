import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { applyViaEasyApply } from './apply/easy-apply';
import { connectToDatabase, disconnectDatabase, loadExistingJobs, saveJob } from './db';
import type { ScoredJob } from './types';
import { PATHS } from './config';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await connectToDatabase();

  console.log('Phase 4 — LinkedIn Easy Apply');
  console.log('==============================\n');

  // load jobs scoring 7+, LinkedIn only (Greenhouse/Lever need manual apply)
  const jobs: ScoredJob[] = await loadExistingJobs();

  const allEligible = jobs.filter(
    (j) => j.fit_score >= 7 && j.apply === true && j.status === 'to_apply',
  );

  const toApply = allEligible.filter((j) => j.source === 'linkedin');
  const manualApply = allEligible.filter((j) => j.source !== 'linkedin');

  if (manualApply.length > 0) {
    console.log(`Greenhouse/Lever jobs (apply manually):`);
    manualApply.forEach((j) =>
      console.log(`  ${j.fit_score}/10 — ${j.title} @ ${j.company}\n           ${j.url}`),
    );
    console.log('');
  }

  if (toApply.length === 0) {
    console.log('No LinkedIn jobs scoring 7+ with status "to_apply".');
    console.log('Run npm run scraper first to scrape LinkedIn jobs.');
    return;
  }

  console.log(`LinkedIn Easy Apply (${toApply.length} jobs):`);
  toApply.forEach((j) => console.log(`  ${j.fit_score}/10 — ${j.title} @ ${j.company}`));
  console.log('');

  // launch browser
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

  // load saved LinkedIn session
  const sessionFile = path.join(__dirname, '../data/linkedin-session.json');
  if (fs.existsSync(sessionFile)) {
    const cookies = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
    await context.addCookies(cookies);
    console.log('LinkedIn session loaded.\n');
  }

  const page = await context.newPage();

  // track results
  const results = {
    applied: [] as string[],
    skipped: [] as { job: string; reason: string }[],
    failed: [] as { job: string; reason: string }[],
  };

  for (let i = 0; i < toApply.length; i++) {
    const job = toApply[i];
    const label = `${job.title} @ ${job.company}`;

    console.log(`\n[${i + 1}/${toApply.length}] ${label}`);
    console.log(`  Score: ${job.fit_score}/10`);
    console.log(`  URL: ${job.url}`);

    const result = await applyViaEasyApply(page, job);

    if (result.success) {
      console.log(`  APPLIED`);
      results.applied.push(label);

      // update status in DB
      job.status = 'applied';
      job.applied_at = new Date().toISOString();
      job.applied_via = 'auto';
      await saveJob(job);
    } else if (result.reason.includes('No Easy Apply')) {
      console.log(`  SKIPPED: ${result.reason}`);
      results.skipped.push({ job: label, reason: result.reason });
    } else {
      console.log(`  FAILED: ${result.reason}`);
      results.failed.push({ job: label, reason: result.reason });
    }

    // human-like delay between applications (15-30 seconds)
    if (i < toApply.length - 1) {
      const delay = 15000 + Math.random() * 15000;
      console.log(`\n  Waiting ${Math.round(delay / 1000)}s before next job...`);
      await sleep(delay);
    }
  }

  await browser.close();

  // ── Final Summary ──────────────────────────────────────────────
  console.log('\n==============================');
  console.log('Phase 4 Summary');
  console.log('==============================');
  console.log(`Applied:  ${results.applied.length}`);
  console.log(`Skipped:  ${results.skipped.length}`);
  console.log(`Failed:   ${results.failed.length}`);

  if (results.applied.length > 0) {
    console.log('\nSuccessfully applied to:');
    results.applied.forEach((j) => console.log(`  ✓ ${j}`));
  }

  if (results.skipped.length > 0) {
    console.log('\nSkipped (no Easy Apply — apply manually):');
    results.skipped.forEach((s) => console.log(`  - ${s.job}`));
  }

  if (results.failed.length > 0) {
    console.log('\nFailed (check debug screenshots in data/):');
    results.failed.forEach((f) => console.log(`  ! ${f.job} — ${f.reason}`));
  }

  await disconnectDatabase();
}

main().catch(console.error);
