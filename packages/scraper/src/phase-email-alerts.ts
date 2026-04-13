import { scrapeEmailAlerts } from './scraper/email-alerts';
import { checkDealBreakers } from './deal-breakers';
import { scoreFitWithLLM } from './scorer/llm-scorer';
import { connectToDatabase, disconnectDatabase, loadExistingJobs, saveJobs } from './db';
import type { JobListing, ScoredJob } from './types';

const LLM_CONCURRENCY = 5;

function quickReject(job: JobListing): string | null {
  const t = job.title.toLowerCase();
  const titleRejects = [
    'frontend', 'front-end', 'ios developer', 'android developer',
    'data scientist', 'machine learning engineer', 'ml engineer',
    'designer', 'ux ', 'product manager', 'sales ', 'recruiter',
    'marketing', 'finance', 'legal', 'devrel', 'developer advocate',
    'embedded', 'firmware', 'hardware', 'mechanical',
    'data analyst', 'analytics engineer', 'qa engineer', 'sdet',
    'test engineer', 'intern ', 'junior',
  ];
  for (const k of titleRejects) {
    if (t.includes(k)) return `Title exclude: ${k}`;
  }

  const d = job.description.slice(0, 500).toLowerCase();
  const wrongStack = [
    { keywords: ['java ', 'spring boot', 'jvm', 'kotlin'], label: 'Java/JVM' },
    { keywords: ['.net', 'c# ', 'asp.net', 'blazor'], label: '.NET/C#' },
    { keywords: ['ruby on rails', 'rails ', 'ruby '], label: 'Ruby/Rails' },
    { keywords: ['php ', 'laravel', 'symfony'], label: 'PHP' },
    { keywords: ['swift ', 'swiftui', 'uikit'], label: 'iOS/Swift' },
    { keywords: ['flutter', 'dart '], label: 'Flutter/Dart' },
  ];
  for (const stack of wrongStack) {
    const hits = stack.keywords.filter((k) => d.includes(k)).length;
    if (hits >= 2) return `Wrong stack: ${stack.label}`;
  }
  return null;
}

async function scoreBatch(batch: JobListing[]): Promise<ScoredJob[]> {
  const promises = batch.map(async (job) => {
    try {
      const score = await scoreFitWithLLM(job);
      return { ...job, ...score, status: score.fit_score >= 5 ? 'to_apply' : 'rejected' } as ScoredJob;
    } catch (err) {
      console.error(`  LLM failed for ${job.title}: ${(err as Error).message}`);
      return {
        ...job, fit_score: 0, apply: false, matched_skills: [], missing_skills: [],
        reason: 'LLM scoring failed', status: 'rejected',
      } as ScoredJob;
    }
  });
  return Promise.all(promises);
}

async function main() {
  await connectToDatabase();

  console.log('Phase — Email Alert Scraper');
  console.log('Parse .eml files → Scrape → Score');
  console.log('=====================================\n');

  const existing = await loadExistingJobs();
  const existingIds = new Set(existing.map((j) => j.id));
  const existingKeys = new Set(existing.map((j) => `${j.company}|||${j.title}`.toLowerCase()));
  const existingUrls = new Set(existing.map((j) => j.url).filter(Boolean));
  console.log(`Existing jobs in tracker: ${existing.length}\n`);

  const alertJobs = await scrapeEmailAlerts();

  // Deduplicate
  const newJobs = alertJobs.filter((j) => {
    const key = `${j.company}|||${j.title}`.toLowerCase();
    if (existingIds.has(j.id)) return false;
    if (existingKeys.has(key)) return false;
    if (j.url && existingUrls.has(j.url)) return false;
    return true;
  });

  console.log(`\nNew from email alerts: ${newJobs.length} (${alertJobs.length - newJobs.length} duplicates)\n`);

  if (newJobs.length === 0) {
    console.log('No new jobs from email alerts.');
    return;
  }

  // Fast filter
  const results: ScoredJob[] = [...existing];
  const needsLLM: JobListing[] = [];

  for (const job of newJobs) {
    const dealBreaker = checkDealBreakers(job);
    if (dealBreaker.rejected) {
      results.push({
        ...job, fit_score: 0, apply: false, matched_skills: [], missing_skills: [],
        reason: dealBreaker.reason!, deal_breaker: dealBreaker.reason, status: 'rejected',
      } as ScoredJob);
      continue;
    }
    const quickRejectReason = quickReject(job);
    if (quickRejectReason) {
      results.push({
        ...job, fit_score: 0, apply: false, matched_skills: [], missing_skills: [],
        reason: quickRejectReason, status: 'rejected',
      } as ScoredJob);
      continue;
    }
    needsLLM.push(job);
  }

  const filtered = newJobs.length - needsLLM.length;
  console.log(`Fast-filtered: ${filtered}`);
  console.log(`Need LLM:      ${needsLLM.length}`);

  // LLM scoring
  if (needsLLM.length > 0) {
    const totalBatches = Math.ceil(needsLLM.length / LLM_CONCURRENCY);
    console.log(`\nLLM scoring ${needsLLM.length} jobs (${totalBatches} batches)...\n`);

    for (let i = 0; i < needsLLM.length; i += LLM_CONCURRENCY) {
      const batch = needsLLM.slice(i, i + LLM_CONCURRENCY);
      const batchNum = Math.floor(i / LLM_CONCURRENCY) + 1;
      console.log(`[Batch ${batchNum}/${totalBatches}]`);
      batch.forEach((j) => console.log(`  - ${j.title} @ ${j.company}`));

      const scored = await scoreBatch(batch);
      for (const s of scored) {
        console.log(`  ${s.fit_score}/10 ${s.fit_score >= 5 ? '✓' : '✗'} ${s.title} @ ${s.company}`);
        results.push(s);
      }
      await saveJobs(results);
    }
  } else {
    await saveJobs(results);
  }

  // Summary
  const toApply = results.filter((j) => j.status === 'to_apply');
  console.log('\n' + '━'.repeat(45));
  console.log('EMAIL ALERTS SUMMARY');
  console.log('━'.repeat(45));
  console.log(`New from emails: ${newJobs.length}`);
  console.log(`Fast-filtered:   ${filtered}`);
  console.log(`LLM-scored:      ${needsLLM.length}`);
  console.log(`Total to apply:  ${toApply.length}`);

  await disconnectDatabase();
}

main().catch(console.error);
