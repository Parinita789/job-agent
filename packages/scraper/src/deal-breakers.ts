// src/deal-breakers.ts
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { JobListing } from './types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const profile = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../profile/candidate.json'), 'utf-8'),
);

export function checkDealBreakers(job: JobListing): { rejected: boolean; reason?: string } {
  // Rule 1 — salary floor (only if salary is explicitly listed)
  if (job.salary_max !== undefined && job.salary_max < profile.compensation.base_salary_min) {
    return {
      rejected: true,
      reason: `Salary too low: $${job.salary_max.toLocaleString()} < minimum $${profile.compensation.base_salary_min.toLocaleString()}`,
    };
  }

  // Rule 2 — employment type
  if (!profile.preferences.employment_type.includes(job.employment_type)) {
    return {
      rejected: true,
      reason: `Employment type "${job.employment_type}" not preferred`,
    };
  }

  // Rule 3 — frontend-heavy detection
  // Only reject pure frontend roles (not full stack)
  const frontendSignals = [
    'frontend engineer',
    'front-end engineer',
    'css specialist',
    'figma',
    'pixel-perfect',
    'ui/ux engineer',
  ];
  const descLower = job.description.toLowerCase();
  const titleLower = job.title.toLowerCase();
  const isFullStack = titleLower.includes('full stack') || titleLower.includes('fullstack');
  const hits = frontendSignals.filter((kw) => descLower.includes(kw));
  if (hits.length >= 3 && !isFullStack) {
    return {
      rejected: true,
      reason: `Frontend-heavy role detected (${hits.join(', ')})`,
    };
  }

  return { rejected: false };
}
