import { generateAllCoverLetters } from './cover-letter/cover-letter';

async function main() {
  console.log('Phase 3 — Cover Letter Generator');
  console.log('==================================\n');
  const force = process.argv.includes('--force');

  await generateAllCoverLetters(7, force); // generate for jobs scoring 7+
}

main().catch(console.error);
