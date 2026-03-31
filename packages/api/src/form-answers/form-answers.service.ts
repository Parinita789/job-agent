import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FormAnswersService {
  private getFormAnswersPath(): string {
    return path.resolve(__dirname, '../../../scraper/data/form-answers.json');
  }

  private getRulesPath(): string {
    return path.resolve(__dirname, '../../../scraper/data/answer-rules.json');
  }

  // ── Form answer logs ──

  getFormAnswers(): any[] {
    const filePath = this.getFormAnswersPath();
    if (!fs.existsSync(filePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return [];
    }
  }

  // ── Rule-based answers ──

  getRules(): Record<string, string> {
    const filePath = this.getRulesPath();
    if (!fs.existsSync(filePath)) {
      // Return defaults
      return {
        'authorized to work': 'Yes',
        'legally authorized': 'Yes',
        'visa sponsorship': 'No',
        'require sponsorship': 'No',
        'years of experience': '7',
        'how many years': '7',
        'expected salary': '180000',
        'desired salary': '180000',
        'salary expectation': '180000',
        'current salary': '160000',
        'start date': '2 weeks',
        'when can you start': '2 weeks',
        'remote': 'Yes',
        'willing to relocate': 'Yes',
      };
    }
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return {};
    }
  }

  saveRules(rules: Record<string, string>): Record<string, string> {
    const filePath = this.getRulesPath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(rules, null, 2));
    return rules;
  }
}
