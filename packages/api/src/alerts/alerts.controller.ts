import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  getAll() {
    return this.alertsService.getAll();
  }

  @Post()
  create(@Body() body: { keywords: string; location: string }) {
    return this.alertsService.create(body.keywords, body.location);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    this.alertsService.delete(id);
    return { ok: true };
  }
}
