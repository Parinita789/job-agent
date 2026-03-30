import { Controller, Get, Post, Param } from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  getAllJobs() {
    return this.jobsService.getAllJobs();
  }

  @Get(':id')
  getJobById(@Param('id') id: string) {
    return this.jobsService.getJobById(id);
  }

  @Post(':id/cover-letter')
  async generateCoverLetter(@Param('id') id: string) {
    return this.jobsService.generateCoverLetter(id);
  }
}
