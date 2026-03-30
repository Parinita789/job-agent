import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class JobsService {
  private getJobsFilePath(): string {
    // __dirname is packages/api/src/jobs or packages/api/dist/jobs
    // jobs.json is at packages/scraper/data/jobs.json
    return path.resolve(__dirname, '../../../scraper/data/jobs.json');
  }

  getAllJobs(): any[] {
    const filePath = this.getJobsFilePath();
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8').trim();
    if (!content) return [];
    const jobs: any[] = JSON.parse(content);

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
}
