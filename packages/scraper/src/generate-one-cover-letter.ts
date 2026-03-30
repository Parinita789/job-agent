// Generates a cover letter for a single job by ID
// Usage: npx tsx src/generate-one-cover-letter.ts <jobId>

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { generateCoverLetter } from './cover-letter/cover-letter';
import type { ScoredJob } from './types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '../data/jobs.json');

async function main() {
  const jobId = process.argv[2];
  if (!jobId) {
    console.error('Usage: npx tsx src/generate-one-cover-letter.ts <jobId>');
    process.exit(1);
  }

  const jobs: ScoredJob[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const job = jobs.find((j) => j.id === jobId);

  if (!job) {
    console.error(`Job not found: ${jobId}`);
    process.exit(1);
  }

  console.log(`Generating cover letter for: ${job.title} @ ${job.company}`);

  const coverLetter = await generateCoverLetter(job);
  job.cover_letter = coverLetter;

  fs.writeFileSync(DATA_FILE, JSON.stringify(jobs, null, 2));
  console.log(`Done (${coverLetter.length} chars)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
