import { Injectable, NotFoundException } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class JobsService {
  private getJobsFilePath(): string {
    // __dirname is packages/api/src/jobs or packages/api/dist/jobs
    // jobs.json is at packages/scraper/data/jobs.json
    return path.resolve(__dirname, '../../../scraper/data/jobs.json');
  }

  private readAllRaw(): any[] {
    const filePath = this.getJobsFilePath();
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8').trim();
    if (!content) return [];
    return JSON.parse(content);
  }

  getAllJobs(): any[] {
    const jobs = this.readAllRaw();

    // deduplicate by company+title, keeping the first occurrence (highest score wins after sort)
    const seen = new Set<string>();
    return jobs.filter((j) => {
      const key = `${j.company}|||${j.title}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  getJobById(id: string): any {
    const jobs = this.getAllJobs();
    const job = jobs.find((j) => j.id === id);
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }

  async generateCoverLetter(id: string): Promise<{ cover_letter: string }> {
    const scraperDir = path.resolve(__dirname, '../../../scraper');

    return new Promise((resolve, reject) => {
      const child = spawn('npx', ['tsx', 'src/generate-one-cover-letter.ts', id], {
        cwd: scraperDir,
        shell: true,
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

      child.on('close', (code) => {
        if (code === 0) {
          // re-read the updated job from disk
          const job = this.getJobById(id);
          resolve({ cover_letter: job.cover_letter ?? '' });
        } else {
          reject(new Error(stderr || `Process exited with code ${code}`));
        }
      });

      child.on('error', reject);

      setTimeout(() => {
        child.kill();
        reject(new Error('Cover letter generation timed out'));
      }, 60000);
    });
  }
}
