import { Module } from '@nestjs/common';
import { FormAnswersController } from './form-answers.controller';
import { FormAnswersService } from './form-answers.service';

@Module({
  controllers: [FormAnswersController],
  providers: [FormAnswersService],
})
export class FormAnswersModule {}
