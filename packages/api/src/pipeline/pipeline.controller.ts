import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { PipelineService } from './pipeline.service';

@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get('commands')
  getCommands() {
    return this.pipelineService.getAvailableCommands();
  }

  @Post('run/:commandId')
  async runCommand(@Param('commandId') commandId: string) {
    await this.pipelineService.runCommand(commandId);
    return { message: `${commandId} started` };
  }

  // keep old endpoint working
  @Post('run')
  async runPipeline() {
    await this.pipelineService.runCommand('pipeline');
    return { message: 'Pipeline started' };
  }

  @Get('status')
  getStatus() {
    return this.pipelineService.getStatus();
  }

  @Get('logs')
  getLogs(@Query('since') since?: string) {
    return this.pipelineService.getLogs(since ? parseInt(since, 10) : 0);
  }
}
