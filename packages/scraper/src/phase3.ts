import { generateAllCoverLetters } from './cover-letter/cover-letter';

async function main() {
  console.log('Phase 3 — Cover Letter Generator');
  console.log('==================================\n');
  const force = process.argv.includes('--force');

  // Accept specific job IDs: --jobs=id1,id2,id3
  const jobsArg = process.argv.find((a) => a.startsWith('--jobs='));
  const specificJobIds = jobsArg ? jobsArg.split('=')[1].split(',') : null;

  await generateAllCoverLetters(5, force, specificJobIds);
}

main().catch(console.error);
