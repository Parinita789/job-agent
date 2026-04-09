import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  connectToDatabase,
  disconnectDatabase,
  JobModel,
  CoverLetterModel,
  UserModel,
  QuestionAnswerModel,
  ProfileAnswerModel,
} from './db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const PROFILE_PATH = path.join(__dirname, '../profile/candidate.json');

async function main() {
  console.log('Migrating JSON data to MongoDB...\n');
  await connectToDatabase();

  // ── 1. Migrate jobs ──
  const jobsFile = path.join(DATA_DIR, 'jobs.json');
  if (fs.existsSync(jobsFile)) {
    const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf-8'));
    console.log(`Jobs: ${jobs.length} records found`);

    // Dedup by id
    const seen = new Set<string>();
    const unique = jobs.filter((j: any) => {
      if (seen.has(j.id)) return false;
      seen.add(j.id);
      return true;
    });

    let inserted = 0;
    let skipped = 0;
    const coverLetters: { externalJobId: string; content: string; jobMongoId?: any }[] = [];

    for (const job of unique) {
      const exists = await JobModel.findOne({ externalId: job.id });
      if (exists) {
        skipped++;
        continue;
      }

      const doc = await JobModel.create({
        externalId: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        remote: job.remote,
        employment_type: job.employment_type,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        description: job.description,
        url: job.url,
        source: job.source,
        scraped_at: job.scraped_at ? new Date(job.scraped_at) : new Date(),
        fit_score: job.fit_score,
        apply: job.apply,
        matched_skills: job.matched_skills,
        missing_skills: job.missing_skills,
        reason: job.reason,
        deal_breaker: job.deal_breaker,
        status: job.status,
        applied_at: job.applied_at ? new Date(job.applied_at) : null,
        applied_via: job.applied_via || null,
        notes: job.notes || '',
      });

      if (job.cover_letter) {
        coverLetters.push({
          externalJobId: job.id,
          content: job.cover_letter,
          jobMongoId: doc._id,
        });
      }

      inserted++;
    }

    console.log(`  Inserted: ${inserted}, Skipped (already exists): ${skipped}`);

    // Migrate cover letters
    if (coverLetters.length > 0) {
      for (const cl of coverLetters) {
        await CoverLetterModel.create({
          jobId: cl.jobMongoId,
          externalJobId: cl.externalJobId,
          content: cl.content,
          generatedAt: new Date(),
        });
      }
      console.log(`  Cover letters: ${coverLetters.length}`);
    }
  } else {
    console.log('Jobs: no jobs.json found, skipping');
  }

  // ── 2. Migrate user profile ──
  if (fs.existsSync(PROFILE_PATH)) {
    const profile = JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf-8'));
    const existing = await UserModel.findOne();
    if (existing) {
      console.log('User: already exists, skipping');
    } else {
      await UserModel.create(profile);
      console.log('User: migrated');
    }
  } else {
    console.log('User: no candidate.json found, skipping');
  }

  // ── 3. Migrate answer rules ──
  const rulesFile = path.join(DATA_DIR, 'answer-rules.json');
  if (fs.existsSync(rulesFile)) {
    const rules = JSON.parse(fs.readFileSync(rulesFile, 'utf-8'));
    const entries = Object.entries(rules);
    let ruleCount = 0;
    for (const [question_pattern, answer] of entries) {
      const exists = await ProfileAnswerModel.findOne({ question_pattern });
      if (!exists) {
        await ProfileAnswerModel.create({ question_pattern, answer, source: 'manual' });
        ruleCount++;
      }
    }
    console.log(`Answer rules: ${ruleCount} migrated`);
  } else {
    console.log('Answer rules: no file found, skipping');
  }

  // ── 4. Migrate form answer logs ──
  const qaFile = path.join(DATA_DIR, 'form-answers.json');
  if (fs.existsSync(qaFile)) {
    const logs = JSON.parse(fs.readFileSync(qaFile, 'utf-8'));
    let qaCount = 0;
    for (const log of logs) {
      const exists = await QuestionAnswerModel.findOne({ externalJobId: log.jobId });
      if (!exists) {
        await QuestionAnswerModel.create({
          externalJobId: log.jobId,
          title: log.title,
          company: log.company,
          appliedAt: log.appliedAt ? new Date(log.appliedAt) : new Date(),
          answers: log.answers,
        });
        qaCount++;
      }
    }
    console.log(`Form answers: ${qaCount} job logs migrated`);
  } else {
    console.log('Form answers: no file found, skipping');
  }

  console.log('\nMigration complete!');
  await disconnectDatabase();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
