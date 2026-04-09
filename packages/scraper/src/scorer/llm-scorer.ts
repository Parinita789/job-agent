import { getAnthropicClient } from '@job-agent/shared';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import type { JobListing } from '../types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

const profile = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../profile/candidate.json'), 'utf-8'),
);

function safeParseJSON(raw: string) {
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);

    return JSON.parse(cleaned);
  } catch {
    return {
      fit_score: 0,
      apply: false,
      matched_skills: [],
      missing_skills: [],
      reason: 'Parse error',
    };
  }
}

function buildScorerPrompt(job: JobListing): string {
  const workSummary = profile.work_history
    .map((j: any) => `- ${j.title} at ${j.company} (${j.duration_years} yrs)`)
    .join('\n');

  return `
You are evaluating job fit for a specific candidate. Be strict and accurate.

## Candidate
- Current level: ${profile.experience.current_level}
- Years experience: ${profile.experience.total_years}
- Core stack: ${profile.skills.languages.join(', ')}
- Frameworks: ${profile.skills.frameworks.join(', ')}
- Architecture: ${profile.skills.architecture.join(', ')}
- Cloud: ${profile.skills.cloud.join(', ')}
- Work history:
${workSummary}

## Scoring Rubric — use this exactly
9-10: Perfect match. Core stack identical (Node.js/TypeScript), distributed systems, backend-focused, right seniority.
7-8:  Good match. Most requirements align, 1-2 minor gaps, backend-heavy role.
5-6:  Partial match. Some overlap but significant gaps or role is not pure backend.
3-4:  Weak match. Different primary stack (.NET, Java, Python-only) or wrong domain entirely.
1-2:  Poor match. Completely different stack, role type, or seniority level.

## Hard rules — automatically score 3 or below if ANY of these apply
- Primary language is NOT TypeScript/JavaScript/Node.js (e.g. Java-only, .NET/C#-only, Python-only)
- Role is primarily frontend (React, CSS, UI/UX focus)
- Role requires technologies candidate has ZERO experience with as PRIMARY skill (e.g. ServiceNow, Dynamics CRM, BIOS firmware)
- Role is DevOps/SRE/Security focused, not backend engineering

## Few-shot examples — learn from these

### Example 1 — Strong match (score: 9)
Candidate: Node.js/TypeScript, microservices, AWS, 7 years
Job: "Senior Backend Engineer, Node.js/TypeScript, distributed systems, payment APIs, AWS"
Output: {
  "fit_score": 9,
  "apply": true,
  "matched_skills": ["Node.js", "TypeScript", "AWS", "microservices", "distributed systems"],
  "missing_skills": [],
  "reason": "Near-perfect match on stack, architecture patterns, and seniority level."
}

### Example 2 — Weak match (score: 3)
Candidate: Node.js/TypeScript, microservices, AWS, 7 years
Job: "Senior .NET Developer, C#, ASP.NET, Microsoft Azure, SharePoint, SQL Server"
Output: {
  "fit_score": 3,
  "apply": false,
  "matched_skills": ["Azure"],
  "missing_skills": [".NET", "C#", "ASP.NET", "SharePoint"],
  "reason": "Primary stack is .NET/C# which candidate has no experience with."
}

### Example 3 — Partial match (score: 5)
Candidate: Node.js/TypeScript, microservices, AWS, 7 years
Job: "Full Stack Engineer, React/Node.js, TypeScript, frontend-heavy, pixel-perfect UI"
Output: {
  "fit_score": 5,
  "apply": false,
  "matched_skills": ["Node.js", "TypeScript"],
  "missing_skills": ["React", "frontend", "CSS"],
  "reason": "Stack partially matches but role is frontend-heavy, not backend-focused."
}

### Example 4 — Wrong domain (score: 2)
Candidate: Node.js/TypeScript, microservices, AWS, 7 years
Job: "ServiceNow Developer, ITSM workflows, ServiceNow scripting, Glide API"
Output: {
  "fit_score": 2,
  "apply": false,
  "matched_skills": [],
  "missing_skills": ["ServiceNow", "ITSM", "Glide API"],
  "reason": "Completely different domain and tooling — no relevant overlap."
}

## Job to evaluate now
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description: ${job.description.slice(0, 800)}

Respond with ONLY a JSON object. Start with { and end with }. No other text.
{
  "fit_score": <number 1-10>,
  "apply": <true or false>,
  "matched_skills": [<list>],
  "missing_skills": [<list>],
  "reason": "<one sentence, be specific about why>"
}
`;
}

interface ScoreResult {
  fit_score: number;
  apply: boolean;
  matched_skills: string[];
  missing_skills: string[];
  reason: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callWithRetry(prompt: string, retries = 3): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await getAnthropicClient().messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });

      return response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (err: any) {
      const is429 = err?.status === 429 || err?.error?.type === 'rate_limit_error';
      if (is429 && attempt < retries - 1) {
        const waitSec = 30 * (attempt + 1); // 30s, 60s, 90s
        console.log(`    Rate limited — waiting ${waitSec}s before retry ${attempt + 2}/${retries}...`);
        await sleep(waitSec * 1000);
        continue;
      }
      throw err;
    }
  }
  return '';
}

export async function scoreFitWithLLM(job: JobListing): Promise<ScoreResult> {
  const prompt = buildScorerPrompt(job);
  const raw = await callWithRetry(prompt);
  return safeParseJSON(raw);
}
