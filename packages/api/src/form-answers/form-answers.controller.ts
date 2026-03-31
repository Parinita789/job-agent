import { Controller, Get, Put, Body } from '@nestjs/common';
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
}
