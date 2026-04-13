// src/rescore.ts — re-scores existing jobs without scraping again
import { checkDealBreakers } from "./deal-breakers";
import { scoreFitWithLLM } from "./scorer/llm-scorer";
import { connectToDatabase, disconnectDatabase, loadExistingJobs, saveJobs } from "./db";
import type { ScoredJob, JobListing } from "./types";

const LLM_CONCURRENCY = 5;

// ── Fast keyword pre-filter (no LLM needed) ────────────────────────
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

// ── Score a batch of jobs concurrently ──────────────────────────────
async function scoreBatch(batch: JobListing[]): Promise<ScoredJob[]> {
  const promises = batch.map(async (job) => {
    try {
      const score = await scoreFitWithLLM(job);
      return {
        ...job,
        ...score,
        status: score.fit_score >= 5 ? 'to_apply' : 'rejected',
      } as ScoredJob;
    } catch (err) {
      console.error(`  LLM failed for ${job.title}: ${(err as Error).message}`);
      return {
        ...job,
        fit_score: 0,
        apply: false,
        matched_skills: [],
        missing_skills: [],
        reason: 'LLM scoring failed',
        status: 'rejected',
      } as ScoredJob;
    }
  });

  return Promise.all(promises);
}

async function rescore() {
  await connectToDatabase();

  const existing = await loadExistingJobs();

  if (existing.length === 0) {
    console.error("No jobs found in database. Run phase 2 first to scrape jobs.");
    await disconnectDatabase();
    process.exit(1);
  }

  console.log("Rescore — Re-scoring with optimized pipeline");
  console.log(`Jobs to re-score: ${existing.length}\n`);

  // ── Layer 1: Fast filters (deal-breakers + keyword pre-filter) ────
  console.log(`Layer 1 — Fast filtering ${existing.length} jobs...\n`);

  const results: ScoredJob[] = [];
  const needsLLM: JobListing[] = [];

  for (const job of existing) {
    const dealBreaker = checkDealBreakers(job as JobListing);
    if (dealBreaker.rejected) {
      results.push({
        ...job,
        fit_score: 0,
        apply: false,
        matched_skills: [],
        missing_skills: [],
        reason: dealBreaker.reason!,
        deal_breaker: dealBreaker.reason,
        status: 'rejected',
      });
      continue;
    }

    const quickRejectReason = quickReject(job as JobListing);
    if (quickRejectReason) {
      results.push({
        ...job,
        fit_score: 0,
        apply: false,
        matched_skills: [],
        missing_skills: [],
        reason: quickRejectReason,
        status: 'rejected',
      });
      continue;
    }

    needsLLM.push(job as JobListing);
  }

  const filtered = existing.length - needsLLM.length;
  console.log(`  Filtered out: ${filtered} (deal-breakers + wrong stack)`);
  console.log(`  Need LLM:    ${needsLLM.length}`);

  // ── Layer 2: LLM scoring in batches ───────────────────────────────
  if (needsLLM.length > 0) {
    const totalBatches = Math.ceil(needsLLM.length / LLM_CONCURRENCY);
    console.log(`\nLayer 2 — LLM scoring ${needsLLM.length} jobs (${totalBatches} batches of ${LLM_CONCURRENCY})...\n`);

    for (let i = 0; i < needsLLM.length; i += LLM_CONCURRENCY) {
      const batch = needsLLM.slice(i, i + LLM_CONCURRENCY);
      const batchNum = Math.floor(i / LLM_CONCURRENCY) + 1;

      console.log(`[Batch ${batchNum}/${totalBatches}] Scoring ${batch.length} jobs...`);
      batch.forEach((j) => console.log(`  - ${j.title} @ ${j.company}`));

      const scored = await scoreBatch(batch);

      for (const s of scored) {
        console.log(`  ${s.fit_score}/10 ${s.apply ? '✓' : '✗'} ${s.title} @ ${s.company}`);
        results.push(s);
      }

      // save after each batch so progress isn't lost
      await saveJobs(results);
      console.log(`  Saved. Progress: ${results.length}/${existing.length}\n`);
    }
  } else {
    await saveJobs(results);
  }

  // ── Final summary ─────────────────────────────────────────────────
  const toApply = results.filter((j) => j.status === "to_apply");
  const rejected = results.filter((j) => j.status === "rejected");

  console.log('━'.repeat(45));
  console.log("RESCORE SUMMARY");
  console.log('━'.repeat(45));
  console.log(`Total:        ${results.length}`);
  console.log(`Fast-filtered: ${filtered}`);
  console.log(`LLM-scored:    ${needsLLM.length}`);
  console.log(`To apply:      ${toApply.length}`);
  console.log(`Rejected:      ${rejected.length}`);

  if (toApply.length > 0) {
    console.log("\nTop matches:");
    toApply
      .sort((a, b) => b.fit_score - a.fit_score)
      .slice(0, 10)
      .forEach((j) =>
        console.log(`  ${j.fit_score}/10 [${j.source}] ${j.title} @ ${j.company}`),
      );
  }

  console.log(`\nSaved to database.`);

  await disconnectDatabase();
}

rescore().catch(console.error);
