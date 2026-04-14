import { Controller, Get, Put, Patch, Delete, Param, Body } from '@nestjs/common';
import { ApplicationFieldsService } from './application-fields.service';

@Controller('application-fields')
export class ApplicationFieldsController {
  constructor(private readonly service: ApplicationFieldsService) {}

  @Get()
  getAll() {
    return this.service.getAll();
  }

  @Get(':jobId')
  getByJobId(@Param('jobId') jobId: string) {
    return this.service.getByJobId(jobId);
  }

  @Put(':jobId/fields/:fieldIndex')
  updateField(
    @Param('jobId') jobId: string,
    @Param('fieldIndex') fieldIndex: string,
    @Body() body: { value: string; saveAsRule?: boolean },
  ) {
    return this.service.updateField(jobId, parseInt(fieldIndex, 10), body.value, body.saveAsRule ?? true);
  }

  @Patch(':jobId/status')
  updateStatus(@Param('jobId') jobId: string, @Body() body: { status: string }) {
    return this.service.updateStatus(jobId, body.status);
  }

  @Delete(':jobId')
  deleteByJobId(@Param('jobId') jobId: string) {
    return this.service.deleteByJobId(jobId);
  }
}
