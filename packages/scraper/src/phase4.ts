import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { applyViaEasyApply } from './apply/easy-apply';
import { applyViaGreenhouse } from './apply/greenhouse-apply';
import { connectToDatabase, disconnectDatabase, loadExistingJobs, saveJob } from './db';
import type { ScoredJob } from './types';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await connectToDatabase();

  // Parse --platforms flag: e.g. --platforms=greenhouse,linkedin
  const platformsArg = process.argv.find((a) => a.startsWith('--platforms='));
  const allowedPlatforms = platformsArg
    ? platformsArg.split('=')[1].split(',')
    : ['linkedin', 'greenhouse'];

  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

  // Accept specific job IDs: --jobs=id1,id2,id3
  const jobsArg = process.argv.find((a) => a.startsWith('--jobs='));
  const specificJobIds = jobsArg ? jobsArg.split('=')[1].split(',') : null;

  console.log('Phase 4 — Auto Apply');
  console.log(`Platforms: ${allowedPlatforms.join(', ')} | Limit: ${limit === Infinity ? 'all' : limit}${specificJobIds ? ` | Jobs: ${specificJobIds.length} selected` : ''}`);
  console.log('==============================\n');

  const jobs: ScoredJob[] = await loadExistingJobs();

  const allEligible = specificJobIds
    ? jobs.filter((j) => specificJobIds.includes(j.id) && j.status === 'to_apply')
    : jobs.filter((j) => j.fit_score >= 5 && j.status === 'to_apply');

  const linkedinJobs = allowedPlatforms.includes('linkedin') ? allEligible.filter((j) => j.source === 'linkedin') : [];
  const greenhouseJobs = allowedPlatforms.includes('greenhouse') ? allEligible.filter((j) => j.source === 'greenhouse') : [];
  const manualApply = allEligible.filter((j) => !allowedPlatforms.includes(j.source));

  if (manualApply.length > 0) {
    console.log(`Lever/Indeed jobs (apply manually):`);
    manualApply.forEach((j) =>
      console.log(`  ${j.fit_score}/10 — ${j.title} @ ${j.company}\n           ${j.url}`),
    );
    console.log('');
  }

  // Greenhouse first (higher success rate), then LinkedIn
  const toApply = [...greenhouseJobs, ...linkedinJobs].slice(0, limit);

  if (toApply.length === 0) {
    console.log('No eligible jobs with status "to_apply".');
    await disconnectDatabase();
    return;
  }

  console.log(`LinkedIn Easy Apply: ${linkedinJobs.length} jobs`);
  console.log(`Greenhouse Apply:    ${greenhouseJobs.length} jobs\n`);
  toApply.forEach((j) => console.log(`  ${j.fit_score}/10 [${j.source}] ${j.title} @ ${j.company}`));
  console.log('');

  // Pre-generate cover letters for all jobs before launching browser
  const { CoverLetterModel } = await import('./db');
  const { generateCoverLetter } = await import('./cover-letter/cover-letter');
  console.log('Pre-generating cover letters...');
  for (const job of toApply) {
    const existing = await CoverLetterModel.findOne({ externalJobId: job.id }).lean().catch(() => null);
    if (!existing) {
      try {
        const cl = await generateCoverLetter(job);
        const { saveCoverLetter } = await import('./db');
        await saveCoverLetter(job.id, cl);
        console.log(`  ✓ ${job.company} — ${cl.length} chars`);
      } catch {
        console.log(`  ✗ ${job.company} — failed`);
      }
    }
  }
  console.log('');

  // Launch browser with comprehensive anti-detection
  const browser = await chromium.launch({
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--start-maximized',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: null, // use full window size (--start-maximized)
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    permissions: ['geolocation'],
    geolocation: { latitude: 37.5485, longitude: -121.9886 }, // Fremont, CA
  });

  // Comprehensive anti-detection
  await context.addInitScript(() => {
    // Hide webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // Realistic plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ];
        return Object.assign(plugins, { length: 3, item: (i: number) => plugins[i], namedItem: (n: string) => plugins.find(p => p.name === n) });
      },
    });

    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });

    // Chrome runtime
    (window as any).chrome = {
      runtime: { connect: () => {}, sendMessage: () => {} },
      loadTimes: () => ({}),
      csi: () => ({}),
    };

    // Hide automation flags
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: 'prompt' } as PermissionStatus)
        : originalQuery(parameters);

    // Realistic screen
    Object.defineProperty(screen, 'width', { get: () => 1440 });
    Object.defineProperty(screen, 'height', { get: () => 900 });
    Object.defineProperty(screen, 'availWidth', { get: () => 1440 });
    Object.defineProperty(screen, 'availHeight', { get: () => 877 });
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
  });

  // Load saved sessions
  const linkedinSessionFile = path.join(__dirname, '../data/linkedin-session.json');
  if (fs.existsSync(linkedinSessionFile)) {
    const cookies = JSON.parse(fs.readFileSync(linkedinSessionFile, 'utf-8'));
    await context.addCookies(cookies);
    console.log('LinkedIn session loaded.');
  }

  const greenhouseSessionFile = path.join(__dirname, '../data/greenhouse-session.json');
  if (fs.existsSync(greenhouseSessionFile)) {
    const cookies = JSON.parse(fs.readFileSync(greenhouseSessionFile, 'utf-8'));
    await context.addCookies(cookies);
    console.log('Greenhouse session loaded.');
  }
  console.log('');

  const page = await context.newPage();

  const results = {
    applied: [] as string[],
    skipped: [] as { job: string; reason: string }[],
    failed: [] as { job: string; reason: string }[],
  };

  for (let i = 0; i < toApply.length; i++) {
    const job = toApply[i];
    const label = `${job.title} @ ${job.company}`;

    console.log(`\n[${i + 1}/${toApply.length}] ${label}`);
    console.log(`  Score: ${job.fit_score}/10 | Platform: ${job.source}`);
    console.log(`  URL: ${job.url}`);

    // Same tab, sequential — more human-like
    let result: any;
    try {
      result = job.source === 'greenhouse'
        ? await applyViaGreenhouse(page, job)
        : await applyViaEasyApply(page, job);
    } catch (err) {
      console.log(`  ERROR: ${(err as Error).message}`);
      result = { success: false, reason: (err as Error).message };
      // Navigate to blank page to reset state for next job
      await page.goto('about:blank').catch(() => {});
    }

    // Save session cookies after each job (captures login state)
    if (job.source === 'greenhouse') {
      const cookies = await context.cookies();
      const ghCookies = cookies.filter((c) => c.domain.includes('greenhouse'));
      if (ghCookies.length > 0) {
        fs.writeFileSync(greenhouseSessionFile, JSON.stringify(ghCookies, null, 2));
      }
    }

    if (result.success) {
      console.log(`  APPLIED (${result.method})`);
      results.applied.push(label);

      job.status = 'applied';
      job.applied_at = new Date().toISOString();
      job.applied_via = 'auto';
      await saveJob(job);
      console.log(`  ✓ Status updated to 'applied' in database`);
    } else if (result.reason.includes('No Easy Apply') || result.reason.includes('No application form')) {
      console.log(`  SKIPPED: ${result.reason}`);
      results.skipped.push({ job: label, reason: result.reason });
      // Mark as rejected so it doesn't show up again
      job.status = 'rejected';
      job.reason = result.reason;
      await saveJob(job);
    } else if (result.reason.includes('skipped') || result.reason.includes('Timed out')) {
      console.log(`  SKIPPED — moving to next job`);
      results.skipped.push({ job: label, reason: result.reason });
      // Don't change status — user can retry later
    } else {
      console.log(`  FAILED: ${result.reason}`);
      results.failed.push({ job: label, reason: result.reason });
    }

    // Delay between jobs — shorter for skips, longer for actual applications
    if (i < toApply.length - 1) {
      const wasApplied = result.success;
      const delay = wasApplied ? 5000 + Math.random() * 5000 : 1000 + Math.random() * 2000;
      console.log(`\n  Waiting ${Math.round(delay / 1000)}s before next job...`);
      await sleep(delay);
    }
  }

  await browser.close();

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
    console.log('\nSkipped (apply manually):');
    results.skipped.forEach((s) => console.log(`  - ${s.job}`));
  }

  if (results.failed.length > 0) {
    console.log('\nFailed:');
    results.failed.forEach((f) => console.log(`  ! ${f.job} — ${f.reason}`));
  }

  await disconnectDatabase();
}

main().catch(console.error);
