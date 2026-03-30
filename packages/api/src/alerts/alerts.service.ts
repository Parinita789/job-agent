import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface Alert {
  id: string;
  keywords: string;
  location: string;
  label: string;
}

@Injectable()
export class AlertsService {
  private getFilePath(): string {
    return path.resolve(__dirname, '../../../scraper/data/alerts.json');
  }

  getAll(): Alert[] {
    const filePath = this.getFilePath();
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8').trim();
    if (!content) return [];
    return JSON.parse(content);
  }

  create(keywords: string, location: string): Alert {
    const alerts = this.getAll();
    const id = Date.now().toString(36);
    const label = `${keywords} — ${location}`;
    const alert: Alert = { id, keywords, location, label };
    alerts.push(alert);
    this.save(alerts);
    return alert;
  }

  delete(id: string): void {
    const alerts = this.getAll();
    const idx = alerts.findIndex((a) => a.id === id);
    if (idx === -1) throw new NotFoundException(`Alert ${id} not found`);
    alerts.splice(idx, 1);
    this.save(alerts);
  }

  private save(alerts: Alert[]): void {
    const filePath = this.getFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(alerts, null, 2));
  }
}
