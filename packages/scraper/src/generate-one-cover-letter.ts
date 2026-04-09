// Generates a cover letter for a single job by ID
// Usage: npx tsx src/generate-one-cover-letter.ts <jobId>

import { connectToDatabase, disconnectDatabase, loadExistingJobs, saveJob, saveCoverLetter } from './db';
import { generateCoverLetter } from './cover-letter/cover-letter';
import type { ScoredJob } from './types';

async function main() {
  const jobId = process.argv[2];
  if (!jobId) {
    console.error('Usage: npx tsx src/generate-one-cover-letter.ts <jobId>');
    process.exit(1);
  }

  await connectToDatabase();

  const jobs: ScoredJob[] = await loadExistingJobs();
  const job = jobs.find((j) => j.id === jobId);

  if (!job) {
    console.error(`Job not found: ${jobId}`);
    await disconnectDatabase();
    process.exit(1);
  }

  console.log(`Generating cover letter for: ${job.title} @ ${job.company}`);

  const coverLetter = await generateCoverLetter(job);
  job.cover_letter = coverLetter;

  await saveCoverLetter(job.id, coverLetter);
  await saveJob(job);

  console.log(`Done (${coverLetter.length} chars)`);

  await disconnectDatabase();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
