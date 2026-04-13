import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { FormAnswersService } from './form-answers.service';

@Controller('form-answers')
export class FormAnswersController {
  constructor(private readonly service: FormAnswersService) {}

  @Get('logs')
  getLogs() {
    return this.service.getFormAnswers();
  }

  @Get('rules')
  getRules() {
    return this.service.getRules();
  }

  @Put('rules')
  saveRules(@Body() rules: Record<string, string>) {
    return this.service.saveRules(rules);
  }

  // ── Pending Questions ──

  @Post('pending')
  addPending(@Body() body: { jobTitle: string; company: string; question: string; type: string; options?: string[] }) {
    return this.service.addPendingQuestion(body as any);
  }

  @Get('pending')
  getPending() {
    return this.service.getPendingQuestions();
  }

  @Get('pending/:id')
  getQuestion(@Param('id') id: string) {
    return this.service.getQuestion(id);
  }

  @Post('pending/:id/answer')
  answerPending(@Param('id') id: string, @Body() body: { answer: string; saveAsRule?: boolean }) {
    return this.service.answerPendingQuestion(id, body.answer, body.saveAsRule ?? true);
  }

  @Delete('pending')
  clearPending() {
    this.service.clearPendingQuestions();
    return { message: 'Cleared' };
  }
}
