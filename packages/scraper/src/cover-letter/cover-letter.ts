import * as path from 'path';
import * as dotenv from 'dotenv';
import { getAnthropicClient } from '@job-agent/shared';
import { connectToDatabase, disconnectDatabase, loadExistingJobs, saveJob, saveCoverLetter, loadProfile } from '../db';
import type { ScoredJob } from '../types';

dotenv.config({ path: path.join(__dirname, '../../../../.env') });

let profile: any = null;

async function getProfile() {
  if (!profile) {
    profile = await loadProfile();
  }
  return profile;
}

// ── Relevance selector ────────────────────────────────────────────────────────
async function selectRelevantAchievements(job: ScoredJob): Promise<string[]> {
  const profile = await getProfile();
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
async function buildCoverLetterPrompt(job: ScoredJob): Promise<string> {
  const profile = await getProfile();
  const achievements = await selectRelevantAchievements(job);

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
- Write exactly 2 short paragraphs, maximum 4 sentences each
- Paragraph 1: One sentence on what the company needs, then 2 sentences proving the candidate has done it — use ONE achievement with the exact metric.
- Paragraph 2: Connect one specific thing about the company's stack/product to the candidate's experience. End with a single sentence asking for a conversation.
- Under 150 words total. Every sentence must earn its place.
- Tone: direct, confident, senior. No filler, no fluff.

## Banned phrases — do NOT use any of these
"I am thrilled", "I am excited", "I am passionate", "I am confident",
"I would be a great fit", "resonates with me", "thank you for considering",
"make an immediate impact", "I'd love to", "Let's schedule",
"would be beneficial", "I look forward to", "Please consider",
"I am writing to", "strong passion", "dream company",
"I am impressed by", "I am drawn to", "resonates with",
"eager to leverage", "I am eager", "ideal candidate",
"honed my skills", "positions me as"

Write the cover letter body with "Dear Hiring Manager," at the top and a brief professional sign-off with the candidate's name at the end. No subject line, no date.
`.trim();
}

// ── Single cover letter ───────────────────────────────────────────────────────
export async function generateCoverLetter(job: ScoredJob): Promise<string> {
  const prompt = await buildCoverLetterPrompt(job);

  const message = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 350,
    messages: [{ role: 'user', content: prompt }],
  });

  return (message.content[0] as any).text.trim();
}

// ── Batch cover letter generator ──────────────────────────────────────────────
export async function generateAllCoverLetters(minScore: number, force = false): Promise<void> {
  await connectToDatabase();

  const jobs: ScoredJob[] = await loadExistingJobs();

  const eligible = jobs.filter(
    (j) => j.fit_score >= minScore && j.status === 'to_apply' && (force || !j.cover_letter),
  );

  console.log(`Found ${eligible.length} jobs scoring ${minScore}+ without cover letters.\n`);

  if (eligible.length === 0) {
    await disconnectDatabase();
    return;
  }

  for (const job of eligible) {
    console.log(`Generating cover letter for: ${job.title} @ ${job.company}`);

    try {
      const coverLetter = await generateCoverLetter(job);
      job.cover_letter = coverLetter;

      // Save cover letter to DB and update the job
      await saveCoverLetter(job.id, coverLetter);
      await saveJob(job);

      console.log(`  Done (${coverLetter.length} chars)\n`);
    } catch (err) {
      console.error(`  Failed: ${(err as Error).message}\n`);
    }
  }

  console.log(`Saved ${eligible.length} cover letters to database.`);

  await disconnectDatabase();
}
