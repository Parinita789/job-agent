import { Module } from '@nestjs/common';
import { ApplicationFieldsController } from './application-fields.controller';
import { ApplicationFieldsService } from './application-fields.service';

@Module({
  controllers: [ApplicationFieldsController],
  providers: [ApplicationFieldsService],
})
export class ApplicationFieldsModule {}
