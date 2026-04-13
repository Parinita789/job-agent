// Standalone: scrape LinkedIn job alerts → score → save
// Run: npm run alerts -w packages/scraper

import { connectToDatabase, disconnectDatabase, loadExistingJobs, saveJobs as persistJobs } from './db';
import { scrapeLinkedInAlerts } from './scraper/linkedin-alerts';
import { checkDealBreakers } from './deal-breakers';
import { scoreFitWithLLM } from './scorer/llm-scorer';
import type { JobListing, ScoredJob } from './types';

const LLM_CONCURRENCY = 5;

function quickReject(job: JobListing): string | null {
  const t = job.title.toLowerCase();
  const d = job.description.slice(0, 500).toLowerCase();

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
  console.log('LinkedIn Job Alerts — Scrape + Score');
  console.log('=====================================\n');

  await connectToDatabase();

  const existing = await loadExistingJobs();
  const existingIds = new Set(existing.map((j) => j.id));
  console.log(`Existing jobs in tracker: ${existing.length}\n`);

  const alertJobs = await scrapeLinkedInAlerts(50);

  // Deduplicate
  const existingKeys = new Set(existing.map((j) => `${j.company}|||${j.title}`.toLowerCase()));
  const existingUrls = new Set(existing.map((j) => j.url).filter(Boolean));
  const seenKeys = new Set<string>();
  const newJobs = alertJobs.filter((j) => {
    const key = `${j.company}|||${j.title}`.toLowerCase();
    if (existingIds.has(j.id) || existingKeys.has(key) || seenKeys.has(key)) return false;
    if (j.url && existingUrls.has(j.url)) return false;
    seenKeys.add(key);
    return true;
  });
  console.log(`\nNew from alerts: ${newJobs.length} (${alertJobs.length - newJobs.length} duplicates)\n`);

  if (newJobs.length === 0) {
    console.log('No new jobs from alerts.');
    await disconnectDatabase();
    return;
  }

  // Fast filter
  const newScored: ScoredJob[] = [];
  const needsLLM: JobListing[] = [];

  for (const job of newJobs) {
    const dealBreaker = checkDealBreakers(job);
    if (dealBreaker.rejected) {
      newScored.push({
        ...job, fit_score: 0, apply: false, matched_skills: [], missing_skills: [],
        reason: dealBreaker.reason!, deal_breaker: dealBreaker.reason, status: 'rejected',
      });
      continue;
    }
    const reject = quickReject(job);
    if (reject) {
      newScored.push({
        ...job, fit_score: 0, apply: false, matched_skills: [], missing_skills: [],
        reason: reject, status: 'rejected',
      });
      continue;
    }
    needsLLM.push(job);
  }

  if (newScored.length > 0) await persistJobs(newScored);

  const filtered = newJobs.length - needsLLM.length;
  console.log(`Fast-filtered: ${filtered}`);
  console.log(`Need LLM:      ${needsLLM.length}\n`);

  // LLM scoring
  if (needsLLM.length > 0) {
    const totalBatches = Math.ceil(needsLLM.length / LLM_CONCURRENCY);
    for (let i = 0; i < needsLLM.length; i += LLM_CONCURRENCY) {
      const batch = needsLLM.slice(i, i + LLM_CONCURRENCY);
      const batchNum = Math.floor(i / LLM_CONCURRENCY) + 1;

      console.log(`[Batch ${batchNum}/${totalBatches}] Scoring ${batch.length} jobs...`);
      const scored = await scoreBatch(batch);

      for (const s of scored) {
        console.log(`  ${s.fit_score}/10 ${s.fit_score >= 5 ? '✓' : '✗'} ${s.title} @ ${s.company}`);
        newScored.push(s);
      }
      await persistJobs(scored);
    }
  }

  // Summary
  const allJobs = await loadExistingJobs();
  const toApply = allJobs.filter((j) => j.status === 'to_apply');
  console.log('\n' + '━'.repeat(45));
  console.log('ALERTS SUMMARY');
  console.log('━'.repeat(45));
  console.log(`New from alerts:  ${newJobs.length}`);
  console.log(`Fast-filtered:    ${filtered}`);
  console.log(`LLM-scored:       ${needsLLM.length}`);
  console.log(`Total to apply:   ${toApply.length}`);

  const newToApply = newScored.filter((j) => j.status === 'to_apply');
  if (newToApply.length > 0) {
    console.log('\nNew matches from alerts:');
    newToApply
      .sort((a, b) => b.fit_score - a.fit_score)
      .forEach((j) => console.log(`  ${j.fit_score}/10 ${j.title} @ ${j.company}`));
  }

  await disconnectDatabase();
}

main().catch(console.error);
