import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import type { ScoredJob } from '../types';

dotenv.config({ path: path.join(__dirname, '../../../../.env') });

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const profile = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../profile/candidate.json'), 'utf-8'),
);

const DATA_FILE = path.join(__dirname, '../../data/jobs.json');

// ── Relevance selector ────────────────────────────────────────────────────────
function selectRelevantAchievements(job: ScoredJob): string[] {
  const descLower = job.description.toLowerCase();

  const isScaleRole = ['transaction', 'payment', 'latency', 'api', 'sla', 'scale'].some((k) =>
    descLower.includes(k),
  );

  const isLeadershipRole = [
    'lead',
    'platform',
    'founding',
    'launch',
    'cross-functional',
    'team',
  ].some((k) => descLower.includes(k));

  const achievements = profile.top_achievements;

  const primary = isScaleRole
    ? achievements.find((a: any) => a.company === 'Nium' && a.impact.includes('100K'))
    : isLeadershipRole
      ? achievements.find((a: any) => a.company === 'Driver Bandhu')
      : achievements.find((a: any) => a.company === 'Ninox Software GmbH');

  const secondary = achievements.find((a: any) => a !== primary && a.company !== primary?.company);

  return [primary?.impact ?? achievements[0].impact, secondary?.impact ?? achievements[1].impact];
}

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildCoverLetterPrompt(job: ScoredJob): string {
  const achievements = selectRelevantAchievements(job);

  return `
You are writing a cover letter for a senior software engineer job application.

## Candidate
- Name: ${profile.personal.name}
- Title: ${profile.experience.current_level}
- Years of experience: ${profile.experience.total_years}
- Core stack: ${profile.skills.languages.join(', ')}, ${profile.skills.frameworks.join(', ')}
- Architecture expertise: ${profile.skills.architecture.join(', ')}

## Most relevant achievements for THIS role
1. ${achievements[0]}
2. ${achievements[1]}

## Job
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Matched skills: ${job.matched_skills.join(', ')}
- Description: ${job.description.slice(0, 1000)}

## Scoring rubric for this role
${job.reason}

## Writing style rules
- Always use "I" instead of the candidate's name (${profile.personal.name})
- Write in first person throughout
- Never refer to the candidate in third person

## Banned phrases — do NOT use any of these
"I am thrilled", "I am excited", "I am passionate", "I am confident"

## Instructions — follow exactly
- Write exactly 3 paragraphs
- Paragraph 1: Open with a specific problem this company faces that the candidate has already solved.
  Do NOT start with "I am", "As a", or any first-person opener.
  Start with the company's challenge, pivot to candidate's solution in sentence 2.
- Paragraph 2: Lead with the metric, not "I did X".
  Use BOTH achievements above with exact numbers.
  e.g. "60% efficiency gains came from..." not "I increased efficiency by 60%"
- Paragraph 3: Name ONE specific technical thing about this company
  (their stack, product, or scale challenge) that connects to candidate's exact experience.
  End with a single direct sentence asking for a conversation.
  e.g. "I'd welcome a conversation about [specific thing]."
- Under 280 words total
- Tone: direct and senior, not eager or grateful

## Banned phrases — do NOT use any of these
"I am thrilled", "I am excited", "I am passionate", "I am confident",
"I would be a great fit", "resonates with me", "thank you for considering",
"make an immediate impact", "I'd love to", "Let's schedule",
"would be beneficial", "I look forward to", "Please consider",
"I am writing to", "strong passion", "dream company",
"I am impressed by", "I am drawn to"

Write ONLY the cover letter body. No subject line, no date, no greeting, no signature.
`.trim();
}

// ── Single cover letter ───────────────────────────────────────────────────────
export async function generateCoverLetter(job: ScoredJob): Promise<string> {
  const prompt = buildCoverLetterPrompt(job);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  return (message.content[0] as any).text.trim();
}

// ── Batch cover letter generator ──────────────────────────────────────────────
export async function generateAllCoverLetters(minScore: number, force = false): Promise<void> {
  const jobs: ScoredJob[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

  const eligible = jobs.filter(
    (j) => j.fit_score >= minScore && j.status === 'to_apply' && (force || !j.cover_letter),
  );

  console.log(`Found ${eligible.length} jobs scoring ${minScore}+ without cover letters.\n`);

  if (eligible.length === 0) return;

  for (const job of eligible) {
    console.log(`Generating cover letter for: ${job.title} @ ${job.company}`);

    try {
      const coverLetter = await generateCoverLetter(job);
      job.cover_letter = coverLetter;
      console.log(`  Done (${coverLetter.length} chars)\n`);
    } catch (err) {
      console.error(`  Failed: ${(err as Error).message}\n`);
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(jobs, null, 2));
  console.log(`Saved ${eligible.length} cover letters to data/jobs.json`);

  // save as individual text files for easy reading
  const outputDir = path.join(__dirname, '../../data/cover-letters');
  fs.mkdirSync(outputDir, { recursive: true });

  for (const job of eligible) {
    if (!job.cover_letter) continue;
    const filename = `${job.company.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${job.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.txt`;
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, job.cover_letter);
    console.log(`  Saved: data/cover-letters/${filename}`);
  }
}
