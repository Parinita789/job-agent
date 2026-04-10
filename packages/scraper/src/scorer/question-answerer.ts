import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { llmChat } from '@job-agent/shared';
import { loadProfile, loadAnswerRules, logQuestionAnswer } from '../db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '../../../../.env') });

// Default rules — used as fallback if DB has no rules
const DEFAULT_RULES: Record<string, string> = {
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
  city: 'Fremont',
  state: 'California',
  country: 'United States',
};

// Lazy-loaded profile and rules
let _profile: any = null;
let _rules: Record<string, string> | null = null;

async function getProfile(): Promise<any> {
  if (!_profile) {
    _profile = await loadProfile();
  }
  return _profile;
}

async function getRules(): Promise<Record<string, string>> {
  if (!_rules) {
    const dbRules = await loadAnswerRules();
    _rules = { ...DEFAULT_RULES, ...dbRules };
    // Merge profile-specific defaults lazily
    const profile = await getProfile();
    if (profile?.personal) {
      if (profile.personal.phone) _rules.phone = profile.personal.phone;
      if (profile.personal.linkedin) _rules.linkedin = profile.personal.linkedin;
      if (profile.personal.github) {
        _rules.github = profile.personal.github;
        _rules.website = profile.personal.github;
      }
    }
  }
  return _rules;
}

async function matchStructured(question: string): Promise<string | null> {
  const q = question.toLowerCase();
  const rules = await getRules();
  for (const [keyword, answer] of Object.entries(rules)) {
    if (q.includes(keyword)) return answer;
  }
  return null;
}

// ── Q&A logging ──
interface QAEntry {
  question: string;
  type: string;
  options?: string[];
  answer: string;
  source: 'rule' | 'llm';
}

let currentJob: { id: string; title: string; company: string } | null = null;

export function setCurrentJob(job: { id: string; title: string; company: string }) {
  currentJob = job;
}

async function logQA(entry: QAEntry) {
  if (!currentJob) return;
  await logQuestionAnswer(currentJob.id, currentJob.title, currentJob.company, entry);
}

async function askLLM(prompt: string): Promise<string> {
  return llmChat(prompt, { temperature: 0.1, maxTokens: 200 });
}

export async function answerQuestion(
  question: string,
  type: 'text' | 'textarea' | 'select' | 'radio',
  options?: string[],
): Promise<string> {
  const profile = await getProfile();

  // try rule-based first — fast and free
  const structured = await matchStructured(question);
  if (structured && type !== 'textarea') {
    console.log(`    Rule-based: "${question}" → "${structured}"`);
    await logQA({ question, type, options, answer: structured, source: 'rule' });
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

    const answer = await askLLM(prompt);
    await logQA({ question, type, options, answer, source: 'llm' });
    return answer;
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

  const answer = await askLLM(prompt);
  await logQA({ question, type, options, answer, source: 'llm' });
  return answer;
}
