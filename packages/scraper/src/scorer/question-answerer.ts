import OpenAI from 'openai';
// import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { PATHS } from '../config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QA_LOG_FILE = path.join(__dirname, '../../data/form-answers.json');

dotenv.config({ path: path.join(__dirname, '../../../../.env') });

// ── Ollama (local LLM) ──
const client = new OpenAI({
  baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
  apiKey: 'ollama',
});

// ── Anthropic Claude API — commented out, kept for reference ──
// const anthropic = new Anthropic({
//   apiKey: process.env.ANTHROPIC_API_KEY,
// });

const profile = JSON.parse(fs.readFileSync(PATHS.profile, 'utf-8'));
const RULES_FILE = path.join(__dirname, '../../data/answer-rules.json');

// Default rules — used if answer-rules.json doesn't exist
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
  phone: profile.personal.phone,
  linkedin: profile.personal.linkedin,
  github: profile.personal.github,
  website: profile.personal.github,
  city: 'Fremont',
  state: 'California',
  country: 'United States',
};

// Load rules from file, falling back to defaults
function loadRules(): Record<string, string> {
  if (fs.existsSync(RULES_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(RULES_FILE, 'utf-8'));
      return { ...DEFAULT_RULES, ...saved };
    } catch {
      // fall through
    }
  }
  return { ...DEFAULT_RULES };
}

function matchStructured(question: string): string | null {
  const q = question.toLowerCase();
  const rules = loadRules();
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

interface JobQALog {
  jobId: string;
  title: string;
  company: string;
  appliedAt: string;
  answers: QAEntry[];
}

let currentJob: { id: string; title: string; company: string } | null = null;

export function setCurrentJob(job: { id: string; title: string; company: string }) {
  currentJob = job;
}

function loadQALog(): JobQALog[] {
  if (!fs.existsSync(QA_LOG_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(QA_LOG_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function logQA(entry: QAEntry) {
  if (!currentJob) return;
  const logs = loadQALog();
  let jobLog = logs.find((l) => l.jobId === currentJob!.id);
  if (!jobLog) {
    jobLog = {
      jobId: currentJob.id,
      title: currentJob.title,
      company: currentJob.company,
      appliedAt: new Date().toISOString(),
      answers: [],
    };
    logs.push(jobLog);
  }
  jobLog.answers.push(entry);
  fs.writeFileSync(QA_LOG_FILE, JSON.stringify(logs, null, 2));
}

async function askOllama(prompt: string): Promise<string> {
  const res = await client.chat.completions.create({
    model: 'llama3:latest',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
  });
  return res.choices[0].message.content!.trim();
}

// ── Claude version (commented out) ──
// async function askClaude(prompt: string): Promise<string> {
//   const message = await anthropic.messages.create({
//     model: 'claude-haiku-4-5-20251001',
//     max_tokens: 200,
//     messages: [{ role: 'user', content: prompt }],
//   });
//   return (message.content[0] as any).text.trim();
// }

export async function answerQuestion(
  question: string,
  type: 'text' | 'textarea' | 'select' | 'radio',
  options?: string[],
): Promise<string> {
  // try rule-based first — fast and free
  const structured = matchStructured(question);
  if (structured && type !== 'textarea') {
    console.log(`    Rule-based: "${question}" → "${structured}"`);
    logQA({ question, type, options, answer: structured, source: 'rule' });
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

    const answer = await askOllama(prompt);
    logQA({ question, type, options, answer, source: 'llm' });
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

  const answer = await askOllama(prompt);
  logQA({ question, type, options, answer, source: 'llm' });
  return answer;
}
