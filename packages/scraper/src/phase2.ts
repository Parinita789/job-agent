import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { scrapeLinkedIn } from './scraper/linkedin';
import { scrapeLinkedInAlerts } from './scraper/linkedin-alerts';
import { scrapeGreenhouse } from './scraper/greenhouse';
import { scrapeLever } from './scraper/lever';
import { scrapeIndeed } from './scraper/indeed';
import { checkDealBreakers } from './deal-breakers';
import { scoreFitWithLLM } from './scorer/llm-scorer';
import { TARGET_COMPANIES } from './scraper/company-list';
import type { JobListing, ScoredJob } from './types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '../data/jobs.json');

const LLM_CONCURRENCY = 2;

const INDEED_QUERIES = [
  { keywords: 'Backend Engineer Node.js', location: 'United States' },
  { keywords: 'Senior Software Engineer TypeScript', location: 'United States' },
  { keywords: 'Staff Software Engineer Backend', location: 'United States' },
  { keywords: 'Software Engineer distributed systems', location: 'Remote' },
];

const INDEED_JOBS_PER_QUERY = 25;

const LINKEDIN_QUERIES = [
  { keywords: 'Backend Engineer Node.js', location: 'United States' },
  { keywords: 'Senior Backend Engineer', location: 'United States' },
  { keywords: 'Staff Backend Engineer', location: 'United States' },
  { keywords: 'Software Engineer TypeScript', location: 'United States' },
  { keywords: 'Senior Software Engineer Node.js', location: 'United States' },
  { keywords: 'Platform Engineer Node.js', location: 'United States' },
  { keywords: 'Backend Engineer TypeScript', location: 'Remote' },
  { keywords: 'Senior Software Engineer Backend', location: 'San Francisco Bay Area' },
  { keywords: 'Staff Software Engineer Backend', location: 'San Francisco Bay Area' },
  { keywords: 'Backend Engineer AWS microservices', location: 'United States' },
  { keywords: 'Senior Backend Engineer API', location: 'United States' },
  { keywords: 'Software Engineer distributed systems', location: 'United States' },
];

const LINKEDIN_JOBS_PER_QUERY = 25;

function loadExistingJobs(): ScoredJob[] {
  if (!fs.existsSync(DATA_FILE)) return [];
  const content = fs.readFileSync(DATA_FILE, 'utf-8').trim();
  if (!content) return [];
  return JSON.parse(content);
}

function saveJobs(jobs: ScoredJob[]) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(jobs, null, 2));
}

// ── Fast keyword pre-filter (no LLM needed) ────────────────────────
function quickReject(job: JobListing): string | null {
  const t = job.title.toLowerCase();
  const d = job.description.slice(0, 500).toLowerCase();

  // wrong role entirely
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

  // wrong primary stack — description dominated by non-matching tech
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
async function scoreBatch(
  batch: JobListing[],
): Promise<ScoredJob[]> {
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

type Source = 'linkedin' | 'greenhouse' | 'lever' | 'indeed';
const ALL_SOURCES: Source[] = ['linkedin', 'greenhouse', 'lever', 'indeed'];

async function scrapeAllSources(sources: Source[] = ALL_SOURCES): Promise<JobListing[]> {
  const all: JobListing[] = [];
  const enabled = new Set(sources);

  if (enabled.has('linkedin')) {
    console.log('━'.repeat(45));
    console.log('SOURCE — LinkedIn');
    console.log('━'.repeat(45));

    for (const query of LINKEDIN_QUERIES) {
      console.log(`\nSearching: "${query.keywords}" in ${query.location}`);
      try {
        const jobs = await scrapeLinkedIn(query.keywords, query.location, LINKEDIN_JOBS_PER_QUERY);
        console.log(`  Got ${jobs.length} jobs`);
        all.push(...jobs);
      } catch (err) {
        console.error(`  Failed: ${(err as Error).message}`);
      }
    }

    console.log('\n' + '━'.repeat(45));
    console.log('SOURCE — LinkedIn Job Alerts');
    console.log('━'.repeat(45));

    try {
      const alertJobs = await scrapeLinkedInAlerts(50);
      console.log(`  Got ${alertJobs.length} jobs from alerts`);
      all.push(...alertJobs);
    } catch (err) {
      console.error(`  Alerts failed: ${(err as Error).message}`);
    }
  }

  if (enabled.has('greenhouse')) {
    console.log('\n' + '━'.repeat(45));
    console.log('SOURCE — Greenhouse');
    console.log('━'.repeat(45) + '\n');

    const greenhouseCompanies = TARGET_COMPANIES.filter((c) => c.ats === 'greenhouse');
    console.log(`Scraping ${greenhouseCompanies.length} companies...\n`);

    for (const company of greenhouseCompanies) {
      const jobs = await scrapeGreenhouse(company.slug, company.name);
      all.push(...jobs);
    }
  }

  if (enabled.has('lever')) {
    console.log('\n' + '━'.repeat(45));
    console.log('SOURCE — Lever');
    console.log('━'.repeat(45) + '\n');

    const leverCompanies = TARGET_COMPANIES.filter((c) => c.ats === 'lever');
    console.log(`Scraping ${leverCompanies.length} companies...\n`);

    for (const company of leverCompanies) {
      const jobs = await scrapeLever(company.slug, company.name);
      all.push(...jobs);
    }
  }

  if (enabled.has('indeed')) {
    console.log('\n' + '━'.repeat(45));
    console.log('SOURCE — Indeed');
    console.log('━'.repeat(45));

    const indeedSeen = new Set<string>();
    for (const query of INDEED_QUERIES) {
      console.log(`\nSearching: "${query.keywords}" in ${query.location}`);
      try {
        const jobs = await scrapeIndeed(query.keywords, query.location, INDEED_JOBS_PER_QUERY);
        // Dedup across queries by id
        const newJobs = jobs.filter((j) => {
          if (indeedSeen.has(j.id)) return false;
          indeedSeen.add(j.id);
          return true;
        });
        console.log(`  Got ${jobs.length} jobs (${jobs.length - newJobs.length} cross-query dupes)`);
        all.push(...newJobs);
      } catch (err) {
        console.error(`  Failed: ${(err as Error).message}`);
      }
    }
  }

  return all;
}

async function main() {
  // Parse --sources flag: e.g. --sources linkedin,greenhouse
  const sourcesArg = process.argv.find((a) => a.startsWith('--sources='));
  const sources: Source[] = sourcesArg
    ? (sourcesArg.split('=')[1].split(',') as Source[])
    : ALL_SOURCES;

  console.log('Phase 2 — Multi-Source Job Scraper');
  console.log(`Sources: ${sources.join(', ')}`);
  console.log('=====================================\n');

  const existingJobs = loadExistingJobs();
  const existingIds = new Set(existingJobs.map((j) => j.id));
  console.log(`Existing jobs in tracker: ${existingJobs.length}\n`);

  // ── scrape selected sources ────────────────────────────────────────
  const allRawJobs = await scrapeAllSources(sources);

  // ── deduplicate ────────────────────────────────────────────────────
  const seenIds = new Set<string>();
  const seenKeys = new Set(existingJobs.map((j) => `${j.company}|||${j.title}`.toLowerCase()));
  const seenUrls = new Set(existingJobs.map((j) => j.url).filter(Boolean));
  const uniqueNewJobs = allRawJobs.filter((job) => {
    const key = `${job.company}|||${job.title}`.toLowerCase();
    if (seenIds.has(job.id) || existingIds.has(job.id)) return false;
    if (seenKeys.has(key)) return false;
    if (job.url && seenUrls.has(job.url)) return false;
    seenIds.add(job.id);
    seenKeys.add(key);
    if (job.url) seenUrls.add(job.url);
    return true;
  });

  // Log dedup breakdown by reason
  let dupById = 0, dupByKey = 0, dupByUrl = 0;
  for (const job of allRawJobs) {
    const key = `${job.company}|||${job.title}`.toLowerCase();
    if (existingIds.has(job.id)) { dupById++; continue; }
    if (seenKeys.has(key) && !seenIds.has(job.id)) { dupByKey++; continue; }
    if (job.url && seenUrls.has(job.url) && !seenIds.has(job.id)) { dupByUrl++; continue; }
  }

  console.log('\n' + '━'.repeat(45));
  console.log('SCRAPE COMPLETE');
  console.log('━'.repeat(45));
  console.log(`Total scraped:   ${allRawJobs.length}`);
  console.log(`After dedup:     ${uniqueNewJobs.length}`);
  console.log(`Already tracked: ${allRawJobs.length - uniqueNewJobs.length}`);
  if (allRawJobs.length - uniqueNewJobs.length > 0) {
    console.log(`  - by ID:           ${dupById}`);
    console.log(`  - by company+title: ${dupByKey}`);
    console.log(`  - by URL:          ${dupByUrl}`);
  }

  if (uniqueNewJobs.length === 0) {
    console.log('\nNo new jobs to process.');
    return;
  }

  // ── Layer 1: Fast filters (deal-breakers + keyword pre-filter) ────
  console.log(`\nLayer 1 — Fast filtering ${uniqueNewJobs.length} jobs...\n`);

  const results: ScoredJob[] = [...existingJobs];
  const needsLLM: JobListing[] = [];

  for (const job of uniqueNewJobs) {
    // deal-breaker check
    const dealBreaker = checkDealBreakers(job);
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

    // quick keyword reject
    const quickRejectReason = quickReject(job);
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

    needsLLM.push(job);
  }

  const filtered = uniqueNewJobs.length - needsLLM.length;
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
        console.log(`  ${s.fit_score}/10 ${s.fit_score >= 5 ? '✓' : '✗'} ${s.title} @ ${s.company}`);
        results.push(s);
      }

      // save after each batch so progress isn't lost
      saveJobs(results);
      console.log(`  Saved. Progress: ${results.length - existingJobs.length}/${uniqueNewJobs.length}\n`);
    }
  } else {
    saveJobs(results);
  }

  // ── final summary ──────────────────────────────────────────────────
  const toApply = results.filter((j) => j.status === 'to_apply');
  const rejected = results.filter((j) => j.status === 'rejected');

  const bySource = toApply.reduce(
    (acc, j) => {
      acc[j.source] = (acc[j.source] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  console.log('━'.repeat(45));
  console.log('FINAL SUMMARY');
  console.log('━'.repeat(45));
  console.log(`Total in tracker: ${results.length}`);
  console.log(`New this run:     ${uniqueNewJobs.length}`);
  console.log(`  Fast-filtered:  ${filtered}`);
  console.log(`  LLM-scored:     ${needsLLM.length}`);
  console.log(`To apply:         ${toApply.length}`);
  console.log(`Rejected:         ${rejected.length}`);
  console.log(`\nMatches by source:`);
  Object.entries(bySource).forEach(([src, count]) => console.log(`  ${src}: ${count}`));

  if (toApply.length > 0) {
    console.log('\nTop matches:');
    toApply
      .sort((a, b) => b.fit_score - a.fit_score)
      .slice(0, 10)
      .forEach((j) => console.log(`  ${j.fit_score}/10 [${j.source}] ${j.title} @ ${j.company}`));
  }

  console.log(`\nSaved to: data/jobs.json`);
}

main().catch(console.error);
