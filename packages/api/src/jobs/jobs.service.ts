import { Injectable, NotFoundException } from '@nestjs/common';
import { JobModel, CoverLetterModel } from '@job-agent/shared';
import { spawn } from 'child_process';
import * as path from 'path';

@Injectable()
export class JobsService {
  async getAllJobs(): Promise<any[]> {
    const jobs = await JobModel.find().sort({ fit_score: -1 }).lean();
    return jobs.map((j: any) => {
      const { _id, __v, ...rest } = j;
      return { ...rest, id: j.externalId };
    });
  }

  async getJobById(id: string): Promise<any> {
    const job = await JobModel.findOne({ externalId: id }).lean();
    if (!job) throw new NotFoundException(`Job ${id} not found`);

    // Attach latest cover letter if exists
    const coverLetter = await CoverLetterModel.findOne({ externalJobId: id }).sort({ generatedAt: -1 }).lean();
    if (coverLetter) {
      (job as any).cover_letter = coverLetter.content;
    }

    const { _id, __v, ...rest } = job as any;
    return { ...rest, id: (job as any).externalId };
  }

  async updateJobStatus(id: string, status: string, reason?: string): Promise<any> {
    const update: any = { status };
    if (reason) update.reason = reason;
    if (status === 'applied') {
      update.applied_at = new Date();
      update.applied_via = 'manual';
    }

    const job = await JobModel.findOneAndUpdate(
      { externalId: id },
      { $set: update },
      { new: true },
    ).lean();

    if (!job) throw new NotFoundException(`Job ${id} not found`);

    // Sync applicationFields — remove from Prepare tab when job status changes
    if (['applied', 'declined', 'rejected'].includes(status)) {
      const { ApplicationFieldsModel } = await import('@job-agent/shared');
      await ApplicationFieldsModel.deleteOne({ externalJobId: id }).catch(() => {});
    }

    const { _id, __v, ...rest } = job as any;
    return { ...rest, id: (job as any).externalId };
  }

  async getJobsWithCoverLetters(): Promise<any[]> {
    const coverLetters = await CoverLetterModel.find().sort({ generatedAt: -1 }).lean();

    // Group by externalJobId, keep latest
    const latestByJob = new Map<string, any>();
    for (const cl of coverLetters) {
      if (!latestByJob.has(cl.externalJobId)) {
        latestByJob.set(cl.externalJobId, cl);
      }
    }

    const jobIds = Array.from(latestByJob.keys());
    const jobs = await JobModel.find({ externalId: { $in: jobIds } }).lean();

    return jobs
      .map((j) => {
        const cl = latestByJob.get(j.externalId);
        return {
          id: j.externalId,
          title: j.title,
          company: j.company,
          matched_skills: j.matched_skills || [],
          fit_score: j.fit_score,
          source: j.source,
          cover_letter: cl?.content || '',
          generated_at: cl?.generatedAt,
        };
      })
      .sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
  }

  async generateCoverLetter(id: string): Promise<{ cover_letter: string }> {
    const scraperDir = path.resolve(__dirname, '../../../scraper');

    return new Promise((resolve, reject) => {
      // Validate job ID to prevent injection
      if (!/^[a-zA-Z0-9_\-]+$/.test(id)) {
        reject(new Error('Invalid job ID format'));
        return;
      }
      const child = spawn('npx', ['tsx', 'src/generate-one-cover-letter.ts', id], {
        cwd: scraperDir,
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      let stderr = '';
      child.stdout.on('data', () => {});
      child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

      child.on('close', async (code) => {
        if (code === 0) {
          const coverLetter = await CoverLetterModel.findOne({ externalJobId: id }).sort({ generatedAt: -1 }).lean();
          resolve({ cover_letter: coverLetter?.content ?? '' });
        } else {
          reject(new Error(stderr || `Process exited with code ${code}`));
        }
      });

      child.on('error', reject);
      setTimeout(() => { child.kill(); reject(new Error('Cover letter generation timed out')); }, 60000);
    });
  }

  async addManualJob(data: { title: string; company: string; url?: string; source?: string }): Promise<any> {
    const id = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job = await JobModel.create({
      externalId: id,
      title: data.title,
      company: data.company,
      url: data.url || '',
      description: '',
      source: data.source || 'linkedin',
      location: '',
      fit_score: 7,
      apply: true,
      matched_skills: [],
      missing_skills: [],
      reason: 'Manually added',
      status: 'applied',
      applied_at: new Date(),
      applied_via: 'manual',
      scraped_at: new Date(),
    });
    const { _id, __v, ...rest } = job.toObject();
    return { ...rest, id: job.externalId };
  }
}
