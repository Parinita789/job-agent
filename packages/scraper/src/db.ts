import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { connectToDatabase, disconnectDatabase, JobModel, CoverLetterModel, UserModel, QuestionAnswerModel, ProfileAnswerModel } from '@job-agent/shared';
import type { ScoredJob } from './types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../.env') });

export { connectToDatabase, disconnectDatabase };
export { JobModel, CoverLetterModel, UserModel, QuestionAnswerModel, ProfileAnswerModel };

export async function loadExistingJobs(): Promise<ScoredJob[]> {
  const jobs = await JobModel.find().lean();
  return jobs.map(jobDocToScoredJob);
}

export async function saveJob(job: ScoredJob): Promise<void> {
  await JobModel.findOneAndUpdate(
    { externalId: job.id },
    { $set: jobToDoc(job) },
    { upsert: true },
  );
}

export async function saveJobs(jobs: ScoredJob[]): Promise<void> {
  if (jobs.length === 0) return;
  const ops = jobs.map((job) => ({
    updateOne: {
      filter: { externalId: job.id },
      update: { $set: jobToDoc(job) },
      upsert: true,
    },
  }));
  await JobModel.bulkWrite(ops);
}

export async function saveCoverLetter(externalJobId: string, content: string): Promise<void> {
  const job = await JobModel.findOne({ externalId: externalJobId });
  await CoverLetterModel.create({
    jobId: job?._id,
    externalJobId,
    content,
    generatedAt: new Date(),
  });
}

export async function loadProfile(): Promise<any> {
  return UserModel.findOne().lean();
}

export async function loadAnswerRules(): Promise<Record<string, string>> {
  const rules = await ProfileAnswerModel.find().lean();
  return rules.reduce((acc: Record<string, string>, r: any) => {
    acc[r.question_pattern] = r.answer;
    return acc;
  }, {});
}

export async function logQuestionAnswer(
  jobId: string, title: string, company: string,
  entry: { question: string; type: string; options?: string[]; answer: string; source: 'rule' | 'llm' },
): Promise<void> {
  await QuestionAnswerModel.findOneAndUpdate(
    { externalJobId: jobId },
    {
      $setOnInsert: { title, company, appliedAt: new Date() },
      $push: { answers: entry },
    },
    { upsert: true },
  );
}

// ── Mapping helpers ──

function jobToDoc(job: ScoredJob): Record<string, any> {
  return {
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
    posted_at: job.posted_at ? new Date(job.posted_at) : null,
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
  };
}

function jobDocToScoredJob(doc: any): ScoredJob {
  return {
    id: doc.externalId,
    title: doc.title,
    company: doc.company,
    location: doc.location || '',
    remote: doc.remote || false,
    employment_type: doc.employment_type || 'full-time',
    salary_min: doc.salary_min,
    salary_max: doc.salary_max,
    description: doc.description || '',
    url: doc.url || '',
    source: doc.source || 'linkedin',
    scraped_at: doc.scraped_at?.toISOString?.() || '',
    posted_at: doc.posted_at?.toISOString?.(),
    fit_score: doc.fit_score || 0,
    apply: doc.apply || false,
    matched_skills: doc.matched_skills || [],
    missing_skills: doc.missing_skills || [],
    reason: doc.reason || '',
    deal_breaker: doc.deal_breaker,
    status: doc.status || 'to_apply',
    applied_at: doc.applied_at?.toISOString?.(),
    applied_via: doc.applied_via,
    notes: doc.notes,
  };
}
