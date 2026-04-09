import { Injectable } from '@nestjs/common';
import { QuestionAnswerModel, ProfileAnswerModel } from '@job-agent/shared';

@Injectable()
export class FormAnswersService {
  async getFormAnswers(): Promise<any[]> {
    return QuestionAnswerModel.find().sort({ appliedAt: -1 }).lean();
  }

  async getRules(): Promise<Record<string, string>> {
    const rules = await ProfileAnswerModel.find().lean();
    if (rules.length === 0) {
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
    return rules.reduce((acc, r) => {
      acc[r.question_pattern] = r.answer;
      return acc;
    }, {} as Record<string, string>);
  }

  async saveRules(rules: Record<string, string>): Promise<Record<string, string>> {
    // Clear and re-insert all rules
    await ProfileAnswerModel.deleteMany({});
    const docs = Object.entries(rules).map(([question_pattern, answer]) => ({
      question_pattern,
      answer,
      source: 'manual',
    }));
    if (docs.length > 0) {
      await ProfileAnswerModel.insertMany(docs);
    }
    return rules;
  }
}
