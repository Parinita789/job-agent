import OpenAI from 'openai';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { PATHS } from '../config';

dotenv.config({ path: path.join(__dirname, '../../../../.env') });

const client = new OpenAI({
  baseURL: process.env.OLLAMA_BASE_URL ?? 'http://10.0.0.197:11434/v1',
  apiKey: 'ollama',
});

const profile = JSON.parse(fs.readFileSync(PATHS.profile, 'utf-8'));

// rule-based answers — deterministic, no LLM needed
const STRUCTURED_ANSWERS: Record<string, string> = {
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
  remote: 'Yes',
  'willing to relocate': 'Yes',
  phone: profile.personal.phone,
  linkedin: profile.personal.linkedin,
  github: profile.personal.github,
  website: profile.personal.github,
  city: 'Fremont',
  state: 'California',
  country: 'United States',
};

function matchStructured(question: string): string | null {
  const q = question.toLowerCase();
  for (const [keyword, answer] of Object.entries(STRUCTURED_ANSWERS)) {
    if (q.includes(keyword)) return answer;
  }
  return null;
}

export async function answerQuestion(
  question: string,
  type: 'text' | 'textarea' | 'select' | 'radio',
  options?: string[],
): Promise<string> {
  // try rule-based first — fast and free
  const structured = matchStructured(question);
  if (structured && type !== 'textarea') {
    console.log(`    Rule-based: "${question}" → "${structured}"`);
    return structured;
  }

  // for select/radio — pick best option
  if ((type === 'select' || type === 'radio') && options?.length) {
    const prompt = `
Question: "${question}"
Options: ${options.join(', ')}

Candidate:
- Title: ${profile.experience.current_level}
- Years exp: ${profile.experience.total_years}
- Location: ${profile.personal.location}
- Visa needed: ${profile.preferences.visa_sponsorship_required}

Reply with ONLY the exact text of the best matching option. Nothing else.
    `;

    const res = await client.chat.completions.create({
      model: 'llama3:latest',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    return res.choices[0].message.content!.trim();
  }

  // open-ended textarea
  const prompt = `
Answer this job application question for the candidate.
Be specific, 2-3 sentences max. Only use real experience from the profile.

Candidate:
- ${profile.experience.total_years} years as ${profile.experience.current_level}
- Stack: ${profile.skills.languages.join(', ')}, ${profile.skills.frameworks.join(', ')}
- Achievement: ${profile.top_achievements[0].impact}

Question: "${question}"

Answer directly, no preamble.
  `;

  const res = await client.chat.completions.create({
    model: 'llama3:latest',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
  });

  return res.choices[0].message.content!.trim();
}
