import { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import type { ScoredJob } from '../types';
import { answerQuestionWithPause } from './form-handler';
import { answerQuestion, clearRulesCache } from '../scorer/question-answerer';
import { TARGET_COMPANIES } from '../scraper/company-list';
import { generateCoverLetter } from '../cover-letter/cover-letter';
import { saveCoverLetter, logQuestionAnswer, ProfileAnswerModel } from '../db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const randomDelay = () => sleep(1500 + Math.random() * 2000);

// Type like a human — click, pause, then type with variable speed
async function humanType(element: any, text: string): Promise<void> {
  await element.click();
  await sleep(200 + Math.random() * 300);
  await element.fill('');
  await element.type(text, { delay: 20 + Math.random() * 40 });
}
const API_URL = process.env.API_URL || 'http://localhost:3001/api';

export type ApplicationResult =
  | { success: true; method: 'greenhouse' }
  | { success: false; reason: string };

async function getFieldLabel(element: any, page: Page): Promise<string> {
  // 1. Try aria-label (Greenhouse sets this reliably)
  const ariaLabel = await element.getAttribute('aria-label').catch(() => '');
  if (ariaLabel && ariaLabel.length < 100) return ariaLabel;

  // 2. Try associated label via id
  const id = await element.getAttribute('id').catch(() => '');
  if (id) {
    const label = await page
      .$eval(`label[for="${id}"]`, (el: Element) => {
        const clone = el.cloneNode(true) as HTMLElement;
        const nested = clone.querySelectorAll('span, abbr, small, svg, button');
        nested.forEach((n) => n.remove());
        return clone.textContent?.replace(/\*/g, '').trim() ?? '';
      })
      .catch(() => '');
    if (label && label.length > 0 && label.length < 100) return label;

    // 3. Use id as readable label: "first_name" → "First Name"
    const readable = id
      .replace(/^question_\d+$/, '') // skip generic question IDs
      .replace(/[_\-]/g, ' ')
      .trim();
    if (readable) return readable;
  }

  // 4. Try placeholder
  const placeholder = await element.getAttribute('placeholder').catch(() => '');
  if (placeholder && placeholder.length < 100) return placeholder;

  return '';
}

// Capture all form field values and save as Q&A log
async function captureFormAnswers(page: Page, job: ScoredJob): Promise<void> {
  try {
    const fields = await page.evaluate(() => {
      const results: { label: string; value: string; type: string }[] = [];

      document.querySelectorAll('input, textarea, select').forEach((el: any) => {
        if (el.offsetParent === null) return;
        if (
          el.type === 'file' ||
          el.type === 'hidden' ||
          el.type === 'submit' ||
          el.type === 'password'
        )
          return;

        const value = el.value?.trim() || '';
        if (!value) return;

        // Get label
        let label = '';
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) label = ariaLabel;
        if (!label && el.id) {
          const labelEl = document.querySelector('label[for="' + el.id + '"]');
          if (labelEl) {
            const clone = labelEl.cloneNode(true) as HTMLElement;
            clone.querySelectorAll('span, abbr, svg').forEach((n) => n.remove());
            label = clone.textContent?.replace(/\*/g, '').trim() || '';
          }
        }
        if (!label) label = el.id?.replace(/[_-]/g, ' ') || el.name?.replace(/[_-]/g, ' ') || '';
        if (!label || label.length < 2) return;

        // Skip common noise
        const lower = label.toLowerCase();
        if (['search', 'submit', 'apply'].includes(lower)) return;

        results.push({
          label,
          value,
          type: el.tagName.toLowerCase() === 'select' ? 'select' : el.type || 'text',
        });
      });

      // Capture checked radio buttons
      document.querySelectorAll('input[type="radio"]:checked').forEach((el: any) => {
        const fieldset = el.closest('fieldset');
        const legend = fieldset?.querySelector('legend')?.textContent?.trim() || '';
        const labelEl = document.querySelector('label[for="' + el.id + '"]');
        const value = labelEl?.textContent?.trim() || el.value || '';
        if (legend && value) results.push({ label: legend, value, type: 'radio' });
      });

      // Capture checked checkboxes
      document.querySelectorAll('input[type="checkbox"]:checked').forEach((el: any) => {
        const labelEl = document.querySelector('label[for="' + el.id + '"]');
        const label = labelEl?.textContent?.trim() || el.id?.replace(/[_-]/g, ' ') || '';
        if (label) results.push({ label, value: 'Yes', type: 'checkbox' });
      });

      // Also capture React Select values
      document.querySelectorAll('[class*="singleValue"], [class*="single-value"]').forEach((el) => {
        const container = el.closest('[class*="select"]');
        const input = container?.querySelector('input');
        const id = input?.id || '';
        let label = '';
        if (id) {
          const labelEl = document.querySelector('label[for="' + id + '"]');
          label = labelEl?.textContent?.replace(/\*/g, '').trim() || id.replace(/[_-]/g, ' ');
        }
        const value = el.textContent?.trim() || '';
        if (label && value) results.push({ label, value, type: 'select' });
      });

      return results;
    });

    // Skip basic profile fields, noise, and huge option lists
    const skipLabels = [
      'first name',
      'last name',
      'email',
      'phone',
      'preferred name',
      'name',
      'country',
      'country code',
      'search',
      'attach',
      'upload',
      'iti',
    ];

    const newFields = fields.filter((f) => {
      const lower = f.label.toLowerCase();
      if (skipLabels.some((s) => lower === s || lower.includes(s))) return false;
      if (f.value.length > 300) return false;
      if (f.label.length < 5) return false;
      // Skip if label is just a number (dropdown option IDs)
      if (/^\d+$/.test(f.label.trim())) return false;
      // Skip if value is just a number (option IDs)
      if (/^\d{5,}$/.test(f.value.trim())) return false;
      // Skip if value looks like a country list
      if (f.value.includes('+93') || f.value.includes('Afghanistan')) return false;
      // Skip phone code values like "United States +1"
      if (f.value.match(/\+\d+$/)) return false;
      // Skip standalone country/city names as labels (not questions)
      if (
        lower.length < 20 &&
        !lower.includes('?') &&
        !lower.includes('select') &&
        !lower.includes('please') &&
        [
          'australia',
          'brazil',
          'canada',
          'france',
          'germany',
          'india',
          'ireland',
          'israel',
          'japan',
          'mexico',
          'netherlands',
          'new zealand',
          'singapore',
          'south korea',
          'spain',
          'sweden',
          'switzerland',
          'thailand',
          'vietnam',
          'poland',
          'portugal',
          'romania',
          'united kingdom',
          'united states',
          'united arab emirates',
        ].includes(lower)
      )
        return false;
      return true;
    });
    console.log(`  Recording ${newFields.length} form answers as reusable rules...`);

    for (const field of newFields) {
      // Log to Q&A history — never include options
      await logQuestionAnswer(job.id, job.title, job.company, {
        question: field.label,
        type: field.type as any,
        answer: field.value,
        source: 'rule',
      }).catch(() => {});

      // Save as reusable rule for future auto-fill
      const normalized = field.label
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .trim();
      if (normalized.length >= 3 && field.value.length < 500) {
        await ProfileAnswerModel.findOneAndUpdate(
          { question_pattern: normalized },
          { $set: { answer: field.value, source: 'auto' } },
          { upsert: true },
        ).catch(() => {});
      }
    }
    // Clear cached rules so next job picks up new answers
    clearRulesCache();
  } catch (err) {
    console.log(`  Failed to capture form answers: ${(err as Error).message}`);
  }
}

let formPageUrl = '';

function setFormPageUrl(url: string) {
  formPageUrl = url;
}

async function detectSubmissionSuccess(page: Page): Promise<boolean> {
  try {
    const currentUrl = page.url();

    // Must still be on a greenhouse-related page
    if (!currentUrl.includes('greenhouse') && !currentUrl.includes(formPageUrl)) return false;

    // The submit button must be GONE — this is the strongest signal
    const submitBtn = await page.$(
      'form button[type="submit"], button:has-text("Submit Application"), button:has-text("Submit")',
    );
    if (submitBtn) {
      // Submit button still visible = form still active, not submitted
      return false;
    }

    // Also check that the form fields are gone
    const formField = await page.$('input[id="first_name"], input[id="email"], form textarea');
    if (formField) return false;

    // Now check for success text
    const bodyText = (await page.textContent('body').catch(() => '')) || '';
    const lower = bodyText.toLowerCase();

    const successIndicators = [
      'thank you for applying',
      'thanks for applying',
      'application submitted',
      'application has been submitted',
      'received your application',
      'successfully submitted',
      'we have received your application',
      'application received',
      'your application has been received',
      'thank you for your interest',
      'thanks for your interest',
    ];

    const matched = successIndicators.find((indicator) => lower.includes(indicator));
    if (matched) {
      console.log(`  [detection] Success indicator found: "${matched}"`);
      console.log(`  [detection] URL: ${currentUrl}`);
    }
    return !!matched;
  } catch {
    return false;
  }
}

async function waitForUserConfirmation(job: ScoredJob): Promise<'submit' | 'manual' | 'skip'> {
  try {
    const { data: pending } = await axios.post(`${API_URL}/form-answers/pending`, {
      jobTitle: job.title,
      company: job.company,
      question: `Review the form for "${job.title}" at ${job.company}. Check all fields in the browser are correct.`,
      type: 'select',
      options: ['Submit (bot clicks submit)', 'Already submitted manually', 'Skip this job'],
    });

    // Poll for answer
    const maxWait = 10 * 60 * 1000; // 10 min
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      await sleep(2000);
      const { data: q } = await axios.get(`${API_URL}/form-answers/pending/${pending.id}`);
      if (q?.answer) {
        const ans = q.answer.toLowerCase();
        console.log(`    User responded: "${q.answer}"`);
        if (ans.includes('already') || ans.includes('manual')) return 'manual';
        if (ans.includes('skip') || ans === '__skip__') return 'skip';
        return 'submit';
      }
    }

    return 'skip';
  } catch {
    return false;
  }
}

// Build direct Greenhouse application URL from job data
function getGreenhouseDirectUrl(job: ScoredJob): string | null {
  // Extract gh_jid from URL like ?gh_jid=7091959
  const ghJidMatch = job.url.match(/gh_jid=(\d+)/);
  if (!ghJidMatch) {
    // Already a greenhouse URL like job-boards.greenhouse.io/stripe/jobs/123
    if (job.url.includes('greenhouse.io')) return job.url;
    return null;
  }

  const jobId = ghJidMatch[1];

  // Find company slug from TARGET_COMPANIES
  const company = TARGET_COMPANIES.find((c) => c.name.toLowerCase() === job.company.toLowerCase());

  if (company) {
    return `https://job-boards.greenhouse.io/${company.slug}/jobs/${jobId}`;
  }

  // Fallback: try lowercase company name as slug
  const slugGuess = job.company.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `https://job-boards.greenhouse.io/${slugGuess}/jobs/${jobId}`;
}

// ── LLM fallback for unknown fields ──
async function askLLMForAnswer(
  label: string,
  job: ScoredJob,
  profile: any,
  type: 'text' | 'textarea' | 'select' | 'radio',
  options?: string[],
): Promise<string> {
  const { llmChat } = await import('@job-agent/shared');

  // Load cover letter for context
  const { CoverLetterModel } = await import('../db');
  const cl = await CoverLetterModel.findOne({ externalJobId: job.id })
    .sort({ generatedAt: -1 })
    .lean()
    .catch(() => null);
  const clContext = (cl as any)?.content
    ? `\nCover letter for reference:\n${(cl as any).content}`
    : '';

  let prompt = '';

  const candidateInfo = `${profile?.personal?.name || 'Parinita Kumari'}, Female, located in ${profile?.preferences?.location?.current_city || 'Fremont, CA'}, United States. ${profile?.experience?.total_years || 7} years ${profile?.experience?.current_level || 'Backend Engineer'}. Authorized to work in US, no sponsorship needed. Asian, not Hispanic/Latino, not a veteran, no disability.`;

  if ((type === 'select' || type === 'radio') && options?.length) {
    prompt = `Pick the best option for this job application question.
Question: "${label}"
Options: ${options.join(', ')}
Job: ${job.title} at ${job.company}
Candidate: ${candidateInfo}
Skills: ${(profile?.skills?.languages || []).join(', ')}

Reply with ONLY the exact text of the best option. Nothing else.`;
  } else if (type === 'textarea') {
    prompt = `Answer this job application question in 2-3 sentences.
Question: "${label}"
Job: ${job.title} at ${job.company}
Candidate: ${candidateInfo}
Skills: ${(profile?.skills?.languages || []).join(', ')}, ${(profile?.skills?.frameworks || []).join(', ')}
Architecture: ${(profile?.skills?.architecture || []).join(', ')}
${clContext}

Answer directly and specifically. No preamble.`;
  } else {
    prompt = `Answer this job application field concisely.
Field: "${label}"
Job: ${job.title} at ${job.company}
Candidate: ${candidateInfo}

Reply with ONLY the answer, nothing else. Keep it under 100 characters.`;
  }

  const answer = await llmChat(prompt, { maxTokens: type === 'textarea' ? 300 : 100 });

  // Don't auto-save LLM answers as rules — only user edits should create rules
  return answer;
}

// Labels that aren't real questions — skip these
function isSkippableLabel(label: string): boolean {
  const lower = label.toLowerCase().trim();
  const skip = [
    'attach',
    'upload',
    'drag',
    'drop',
    'browse',
    'choose file',
    'or',
    'and',
    'submit',
    'apply',
    'cancel',
    'back',
    'next',
    'required',
    'optional',
    'enter manually',
    'search',
    'select',
    'type to search',
  ];
  if (skip.includes(lower)) return true;
  if (lower.length < 2) return true;
  if (lower.length > 150) return true;
  // Skip if it's just a number or punctuation
  if (/^[\d\s\-_.*]+$/.test(lower)) return true;
  return false;
}

// Map known field IDs/labels to profile data — these should never go to LLM
// fieldType: pass 'text' for text inputs, 'select'/'radio' for dropdowns
function getDirectAnswer(
  id: string,
  label: string,
  profile: any,
  fieldType: string = 'text',
): string | null {
  const idLower = id.toLowerCase();
  const labelLower = label.toLowerCase();

  if (
    idLower === 'first_name' ||
    idLower === 'firstname' ||
    labelLower === 'first name' ||
    labelLower === 'first name'
  ) {
    return profile?.personal?.name?.split(' ')[0] || '';
  }
  if (
    idLower === 'last_name' ||
    idLower === 'lastname' ||
    labelLower === 'last name' ||
    labelLower === 'last name' ||
    labelLower === 'surname'
  ) {
    const parts = profile?.personal?.name?.split(' ') || [];
    return parts.slice(1).join(' ') || '';
  }
  if (idLower === 'name' || labelLower === 'name' || labelLower === 'full name') {
    return profile?.personal?.name || '';
  }
  if (
    idLower === 'preferred_name' ||
    idLower === 'preferredname' ||
    labelLower.includes('preferred')
  ) {
    return profile?.personal?.name?.split(' ')[0] || '';
  }
  if (idLower === 'email' || labelLower === 'email' || labelLower === 'email address') {
    return profile?.personal?.email || '';
  }
  if (idLower === 'phone' || labelLower === 'phone' || labelLower === 'phone number') {
    return profile?.personal?.phone || '';
  }
  if (labelLower.includes('linkedin')) {
    return profile?.personal?.linkedin || '';
  }
  if (
    labelLower.includes('website') ||
    labelLower.includes('github') ||
    labelLower.includes('portfolio') ||
    labelLower.includes('url')
  ) {
    return profile?.personal?.github || '';
  }

  // ── Work authorization (MUST be before location checks) ──
  // Only return Yes/No for non-text fields — text inputs with these labels are usually dropdowns
  if (fieldType !== 'text') {
    if (
      labelLower.includes('authorized to work') ||
      labelLower.includes('legally authorized') ||
      labelLower.includes('eligible to work') ||
      labelLower.includes('work authorization') ||
      labelLower.includes('right to work') ||
      labelLower.includes('legally eligible')
    ) {
      return 'Yes';
    }
    if (
      labelLower.includes('visa sponsorship') ||
      labelLower.includes('require sponsorship') ||
      labelLower.includes('need sponsorship') ||
      labelLower.includes('immigration sponsorship')
    ) {
      return 'No';
    }
  }

  if (
    labelLower.includes('city') ||
    labelLower.includes('location') ||
    labelLower.includes('address')
  ) {
    return profile?.preferences?.location?.current_city || profile?.personal?.location || '';
  }
  if (labelLower.includes('state') || labelLower.includes('province')) {
    return 'California';
  }
  if (labelLower.includes('zip') || labelLower.includes('postal')) {
    return '95134';
  }
  if (
    idLower === 'country' ||
    labelLower === 'country' ||
    (labelLower.includes('country') && !labelLower.includes('city'))
  ) {
    return 'United States';
  }

  // ── Compensation ──
  if (
    labelLower.includes('salary') ||
    labelLower.includes('compensation') ||
    labelLower.includes('pay expectation') ||
    labelLower.includes('desired pay')
  ) {
    return String(profile?.compensation?.base_salary_preferred || '180000');
  }
  if (
    labelLower.includes('salary expectation') ||
    labelLower.includes('expected salary') ||
    labelLower.includes('minimum salary')
  ) {
    return String(profile?.compensation?.base_salary_min || '150000');
  }

  // ── Experience ──
  if (
    labelLower.includes('years of experience') ||
    labelLower.includes('total experience') ||
    labelLower.includes('how many years')
  ) {
    return String(profile?.experience?.total_years || '7');
  }
  if (
    labelLower.includes('current title') ||
    labelLower.includes('job title') ||
    labelLower.includes('current role')
  ) {
    return profile?.experience?.current_level || 'Backend Engineer';
  }
  if (
    labelLower.includes('current company') ||
    labelLower.includes('current employer') ||
    labelLower.includes('most recent company')
  ) {
    const latest = profile?.work_history?.[0];
    return latest?.company || '';
  }

  // ── Availability ──
  if (
    labelLower.includes('start date') ||
    labelLower.includes('when can you start') ||
    labelLower.includes('earliest start') ||
    labelLower.includes('available to start') ||
    labelLower.includes('notice period')
  ) {
    return '2 weeks';
  }

  // ── Questions that ALWAYS have a clear answer regardless of field type ──

  // Sponsorship / visa — always No
  if (
    labelLower.includes('require sponsorship') ||
    labelLower.includes('need sponsorship') ||
    labelLower.includes('require.*visa') ||
    labelLower.includes('sponsorship for employment') ||
    labelLower.includes('immigration sponsorship') ||
    labelLower.includes('visa sponsorship') ||
    labelLower.includes('visa status') ||
    labelLower.includes('require.*immigration')
  ) {
    return 'No';
  }

  // Work authorization — always Yes
  if (
    labelLower.includes('authorized to work') ||
    labelLower.includes('legally authorized') ||
    labelLower.includes('eligible to work') ||
    labelLower.includes('work authorization') ||
    labelLower.includes('right to work') ||
    labelLower.includes('legally eligible') ||
    labelLower.includes('legal right to work') ||
    labelLower.includes('work legally')
  ) {
    return 'Yes';
  }

  // Relocation — always Yes
  if (
    labelLower.includes('willing to relocate') ||
    labelLower.includes('open to relocation') ||
    labelLower.includes('relocate if') ||
    labelLower.includes('willing to move')
  ) {
    return 'Yes';
  }

  // Background check — always Yes
  if (
    labelLower.includes('background check') ||
    labelLower.includes('drug test') ||
    labelLower.includes('drug screen') ||
    labelLower.includes('consent to')
  ) {
    return 'Yes';
  }

  // Commute / in-person — always Yes
  if (
    labelLower.includes('able to commute') ||
    labelLower.includes('commute to') ||
    labelLower.includes('work in person') ||
    labelLower.includes('in-person') ||
    labelLower.includes('on-site') ||
    labelLower.includes('onsite') ||
    labelLower.includes('hybrid')
  ) {
    return 'Yes';
  }

  // Employment type
  if (labelLower.includes('employment type') || labelLower.includes('work type')) {
    return 'Full-time';
  }

  // Education
  if (
    labelLower.includes('degree') ||
    labelLower.includes('education level') ||
    labelLower.includes('highest education')
  ) {
    return 'B. Tech';
  }
  if (
    labelLower.includes('university') ||
    labelLower.includes('school') ||
    labelLower.includes('college') ||
    labelLower.includes('institution')
  ) {
    return 'DIT University';
  }
  if (
    labelLower.includes('major') ||
    labelLower.includes('field of study') ||
    labelLower.includes('discipline')
  ) {
    return 'Computer Science';
  }
  if (labelLower.includes('graduation') || labelLower.includes('year of completion')) {
    return '2018';
  }

  // How did you hear
  if (
    labelLower.includes('how did you hear') ||
    labelLower.includes('where did you find') ||
    labelLower.includes('referral source') ||
    labelLower.includes('how did you learn')
  ) {
    return 'LinkedIn';
  }

  // Demographics — always answer
  if (labelLower.includes('gender')) return 'Female';
  if (labelLower.includes('race') || labelLower.includes('ethnicity')) return 'Asian';
  if (labelLower.includes('veteran')) return 'No';
  if (labelLower.includes('disability') || labelLower.includes('handicap')) return 'No';
  if (labelLower.includes('lgbtq') || labelLower.includes('sexual orientation')) return 'Heterosexual';
  if (labelLower.includes('pronoun')) return 'She/Her';

  // ── Generic yes/no — only for dropdowns, not text inputs ──
  if (fieldType === 'text') return null;

  const yesPatterns = [
    'are you open to',
    'are you willing',
    'are you able',
    'are you comfortable',
    'are you available',
    'are you interested',
    'do you have the right',
    'do you have authorization',
    'can you commute',
    'can you work',
    'can you start',
    'will you be able',
    'would you be open',
    'do you agree',
    'acknowledge',
  ];
  if (yesPatterns.some((p) => labelLower.includes(p))) return 'Yes';

  const noPatterns = [
    'non-compete',
    'non compete',
    'previously applied',
    'applied before',
    'government employee',
    'government official',
  ];
  if (noPatterns.some((p) => labelLower.includes(p))) return 'No';

  return null;
}

// Smart matcher: maps a short answer (e.g. "United States", "Female", "No") to the best dropdown option
// without LLM — handles common variations deterministically
export function smartMatchOption(answer: string, options: string[], label: string): string | null {
  const a = answer.toLowerCase().trim();
  const l = label.toLowerCase();

  // Exact match
  const exact = options.find((o) => o.toLowerCase().trim() === a);
  if (exact) return exact;

  // ── Specific matchers BEFORE generic contains (to avoid wrong partial matches) ──

  // Country variations: "United States" → "US", "USA", "United States of America"
  if (a === 'united states' || a === 'us' || a === 'usa') {
    const countryMatch = options.find((o) => {
      const ol = o.toLowerCase();
      return (
        ol === 'us' ||
        ol === 'usa' ||
        ol.includes('united states') ||
        ol.startsWith('us ') ||
        ol === 'u.s.' ||
        ol === 'u.s.a.'
      );
    });
    if (countryMatch) return countryMatch;
  }

  // Yes/No — match options that START with Yes/No (e.g. "Yes, I am authorized...", "No, I will not require...")
  if (a === 'yes' || a === 'no') {
    const ynMatch = options.find((o) => o.toLowerCase().startsWith(a));
    if (ynMatch) return ynMatch;
    // Also match "I am" / "I do" for Yes, "I am not" / "I do not" for No
    if (a === 'yes') {
      const posMatch = options.find((o) => {
        const ol = o.toLowerCase();
        return (
          (ol.includes('i am') && !ol.includes('not')) ||
          (ol.includes('i do') && !ol.includes('not')) ||
          (ol.includes('i will') && !ol.includes('not')) ||
          ol.includes('i intend')
        );
      });
      if (posMatch) return posMatch;
    }
    if (a === 'no') {
      const negMatch = options.find((o) => {
        const ol = o.toLowerCase();
        return (
          ol.includes('i am not') ||
          ol.includes('i do not') ||
          ol.includes('i will not') ||
          ol.includes('not a') ||
          ol.includes('do not have')
        );
      });
      if (negMatch) return negMatch;
    }
  }

  // Gender: "Female" ↔ "Woman", "Male" ↔ "Man"
  if (a === 'female' || a === 'woman') {
    return options.find((o) => o.toLowerCase().includes('female') || o.toLowerCase().includes('woman')) || null;
  }
  if (a === 'male' || a === 'man') {
    return options.find((o) =>
      (o.toLowerCase().includes('male') && !o.toLowerCase().includes('female')) || o.toLowerCase().includes('man')
    ) || null;
  }

  // Gender identity: "Cisgender" ↔ "Straight" (for "I identify as" questions)
  if (a === 'cisgender' || a === 'straight' || a === 'heterosexual') {
    return options.find((o) => o.toLowerCase().includes('cisgender')) ||
           options.find((o) => o.toLowerCase().includes('heterosexual')) ||
           options.find((o) => o.toLowerCase().includes('straight')) || null;
  }

  // Race/Ethnicity patterns
  if (a === 'south asian' || a === 'asian') {
    // Prefer specific "South Asian" if available, then exact "Asian", then any "asian"
    return options.find((o) => o.toLowerCase().includes('south asian')) ||
           options.find((o) => o.toLowerCase().trim() === 'asian' || o.toLowerCase().startsWith('asian')) ||
           options.find((o) => o.toLowerCase().includes('asian')) || null;
  }
  if (a === 'white' || a === 'caucasian') {
    return (
      options.find(
        (o) => o.toLowerCase().includes('white') || o.toLowerCase().includes('caucasian'),
      ) || null
    );
  }
  if (a === 'black' || a === 'african american') {
    return (
      options.find(
        (o) => o.toLowerCase().includes('black') || o.toLowerCase().includes('african american'),
      ) || null
    );
  }
  if (a === 'hispanic' || a === 'latino' || a === 'latina') {
    return (
      options.find(
        (o) => o.toLowerCase().includes('hispanic') || o.toLowerCase().includes('latino'),
      ) || null
    );
  }
  if (l.includes('race') || l.includes('ethnicity')) {
    // Generic race question — try contains match with the answer
    const raceMatch = options.find((o) => o.toLowerCase().includes(a));
    if (raceMatch) return raceMatch;
  }

  // Sexual orientation: "Heterosexual" ↔ "Straight"
  if (a === 'heterosexual' || a === 'straight') {
    return options.find((o) => o.toLowerCase().includes('heterosexual')) ||
           options.find((o) => o.toLowerCase().includes('straight')) || null;
  }

  // Veteran: "No" → "I am not a protected veteran", "No"
  if (l.includes('veteran') && a === 'no') {
    return (
      options.find((o) => o.toLowerCase().includes('not') && o.toLowerCase().includes('veteran')) ||
      options.find((o) => o.toLowerCase().startsWith('no')) ||
      null
    );
  }

  // Disability: "No" → "No, I do not have a disability", etc.
  if (l.includes('disability') && a === 'no') {
    return (
      options.find(
        (o) => o.toLowerCase().includes('do not have') || o.toLowerCase().includes('no,'),
      ) ||
      options.find((o) => o.toLowerCase().startsWith('no')) ||
      null
    );
  }

  // Decline to answer / prefer not patterns
  if (a === 'decline' || a === 'prefer not') {
    return (
      options.find(
        (o) => o.toLowerCase().includes('decline') || o.toLowerCase().includes('prefer not'),
      ) || null
    );
  }

  // Contains match (both directions) — AFTER specific matchers
  const contains = options.find((o) => {
    const ol = o.toLowerCase();
    return ol.includes(a) || a.includes(ol);
  });
  if (contains) return contains;

  // Starts-with match
  const startsWith = options.find((o) => o.toLowerCase().startsWith(a));
  if (startsWith) return startsWith;

  return null;
}

async function fillFormFields(page: Page, job: ScoredJob): Promise<void> {
  // Load profile for direct field mapping
  const { loadProfile } = await import('../db');
  const profile = await loadProfile();

  // Load pre-scraped answers (from Prepare tab) — use these first, skip LLM calls
  const { ApplicationFieldsModel } = await import('@job-agent/shared');
  const preScraped = (await ApplicationFieldsModel.findOne({ externalJobId: job.id })
    .lean()
    .catch(() => null)) as any;
  const preAnswersByFieldId = new Map<string, { value: string; source: string }>();
  const preAnswersByLabel = new Map<string, { value: string; source: string }>();
  if (preScraped?.fields) {
    for (const f of preScraped.fields) {
      if (f.value && f.source !== 'unknown') {
        if (f.fieldId) preAnswersByFieldId.set(f.fieldId, { value: f.value, source: f.source });
        preAnswersByLabel.set(f.label.toLowerCase().trim(), { value: f.value, source: f.source });
      }
    }
    console.log(
      `  Pre-scraped answers loaded: ${preAnswersByFieldId.size + preAnswersByLabel.size} answers available`,
    );
  }

  // Helper: look up pre-scraped answer by fieldId or label (with fuzzy fallback)
  function getPreScrapedAnswer(fieldId: string, label: string): string | null {
    // 1. Exact fieldId match
    if (fieldId) {
      const byId = preAnswersByFieldId.get(fieldId);
      if (byId) return byId.value;
    }
    // 2. Exact label match
    const normalizedLabel = label.toLowerCase().trim();
    const byLabel = preAnswersByLabel.get(normalizedLabel);
    if (byLabel) return byLabel.value;
    // 3. Fuzzy label match — handles typos, extra words, "in in" vs "in"
    const stripped = normalizedLabel
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    for (const [key, entry] of preAnswersByLabel) {
      const keyStripped = key
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (keyStripped === stripped) return entry.value;
      // Substring match for long labels (>20 chars)
      if (stripped.length > 20 && keyStripped.length > 20) {
        if (keyStripped.includes(stripped) || stripped.includes(keyStripped)) return entry.value;
      }
    }
    return null;
  }

  // Track filled field IDs to avoid re-processing
  const filledIds = new Set<string>();

  // Scroll through entire form to ensure all lazy-loaded fields are in DOM
  await page.evaluate(`(() => {
    const scrollStep = async () => {
      const height = document.body.scrollHeight;
      for (let y = 0; y < height; y += 300) {
        window.scrollTo(0, y);
      }
      window.scrollTo(0, height);
    };
    scrollStep();
  })()`).catch(() => {});
  await sleep(1000);
  await page.evaluate(`(() => { window.scrollTo(0, 0); })()`).catch(() => {});
  await sleep(300);

  // ── Handle React Select / custom dropdowns first ──
  // Run twice: first pass fills visible fields, second pass catches fields that were below the fold
  for (let pass = 0; pass < 2; pass++) {
    if (pass === 1) {
      // Scroll to bottom again before second pass
      await page.evaluate(`(() => { window.scrollTo(0, document.body.scrollHeight); })()`).catch(() => {});
      await sleep(500);
      await page.evaluate(`(() => { window.scrollTo(0, 0); })()`).catch(() => {});
      await sleep(300);
    }
  try {
    const comboboxInputs = await page.$$('input[role="combobox"]');
    if (pass === 0) console.log(`  Found ${comboboxInputs.length} combobox inputs`);
    for (const combo of comboboxInputs) {
      const id = (await combo.getAttribute('id').catch(() => '')) || '';

      // Skip phone country code picker (iti = international telephone input)
      if (id.includes('iti') || id.includes('search-input') || id.includes('country-listbox')) {
        filledIds.add(id);
        continue;
      }

      const label = await getFieldLabel(combo, page);
      console.log(`    Combobox id="${id}" label="${label?.slice(0, 60) || '(none)'}"`);
      if (!label || isSkippableLabel(label)) {
        console.log(`    → skipped (${!label ? 'no label' : 'skippable'})`);
        continue;
      }

      // Check if already has a value selected
      const selectedValue = await combo.evaluate((el) => {
        const container = el.closest('[class*="select"]');
        if (!container) return '';
        const val = container.querySelector('[class*="singleValue"], [class*="single-value"]');
        return val?.textContent?.trim() || '';
      }).catch(() => '');

      if (selectedValue) {
        console.log(`    Dropdown already set: "${label}" = "${selectedValue}"`);
        filledIds.add(id);
        continue;
      }

      // Resolve answer: pre-scraped → rules → profile (NO LLM)
      let answer = '';
      const preAnswer = getPreScrapedAnswer(id, label);
      if (preAnswer) {
        answer = preAnswer;
      }
      if (!answer) {
        try {
          const ruleAnswer = await answerQuestion(label, 'select');
          if (ruleAnswer) answer = ruleAnswer;
        } catch {
          /* fall through */
        }
      }
      if (!answer) {
        const directAnswer = getDirectAnswer(id, label, profile, 'select');
        if (directAnswer) answer = directAnswer;
      }

      if (!answer) {
        console.log(`    ○ Skipped dropdown: "${label}" — no answer available`);
        continue;
      }

      console.log(`    Dropdown "${label}": answer="${answer}"`);

      // Select from dropdown using type-to-filter approach (scoped to THIS combobox)
      try {
        // Focus and clear the combobox, then type the answer to filter
        await combo.click({ timeout: 5000 });
        await sleep(300);
        await combo.fill('');
        await combo.type(answer, { delay: 15 });
        await sleep(500);

        // Find the CLOSEST menu to this combobox (not the phone picker's menu)
        // Use the combobox's aria-controls or the menu that appeared right after this input
        const menuId = await combo.getAttribute('aria-controls').catch(() => '') || '';
        let clicked = false;

        if (menuId) {
          // Scoped: find options inside the menu this combobox controls
          const scopedOpts = page.locator(`#${menuId} [class*="option"], #${menuId} [role="option"]`);
          const count = await scopedOpts.count().catch(() => 0);
          console.log(`    Scoped menu #${menuId}: ${count} options`);
          for (let i = 0; i < count; i++) {
            const text = (await scopedOpts.nth(i).textContent().catch(() => '') || '').trim();
            if (text.toLowerCase() === answer.toLowerCase() ||
                text.toLowerCase().includes(answer.toLowerCase()) ||
                answer.toLowerCase().includes(text.toLowerCase())) {
              await scopedOpts.nth(i).click({ timeout: 3000 });
              console.log(`    ✓ Dropdown: "${label}" → "${text}" (scoped)`);
              clicked = true;
              break;
            }
          }
        }

        // Fallback: use the menu that's nearest sibling to this combobox's container
        if (!clicked) {
          // The React Select menu is usually rendered as a sibling of the select container
          const menuLocator = page.locator('[class*="select__menu"]:visible, [class*="menu-list"]:visible').last();
          const menuVisible = await menuLocator.isVisible().catch(() => false);
          if (menuVisible) {
            const opts = menuLocator.locator('[class*="option"], [role="option"]');
            const count = await opts.count().catch(() => 0);
            console.log(`    Visible menu: ${count} options`);
            // Check first option — if it's a phone code, skip
            if (count > 0) {
              const firstText = (await opts.first().textContent().catch(() => '') || '').trim();
              if (/\+\d{1,3}$/.test(firstText)) {
                console.log(`    ○ Skipped phone code picker: "${label}"`);
                await page.keyboard.press('Escape').catch(() => {});
                filledIds.add(id);
                continue;
              }
            }
            for (let i = 0; i < count; i++) {
              const text = (await opts.nth(i).textContent().catch(() => '') || '').trim();
              if (text.toLowerCase() === answer.toLowerCase() ||
                  text.toLowerCase().includes(answer.toLowerCase()) ||
                  answer.toLowerCase().includes(text.toLowerCase())) {
                await opts.nth(i).click({ timeout: 3000 });
                console.log(`    ✓ Dropdown: "${label}" → "${text}" (visible menu)`);
                clicked = true;
                break;
              }
            }
          }
        }

        // Last resort: just press Enter on the first filtered result
        if (!clicked) {
          await page.keyboard.press('Enter');
          await sleep(200);
          // Check if a value was selected
          const newVal = await combo.evaluate((el) => {
            const container = el.closest('[class*="select"]');
            const val = container?.querySelector('[class*="singleValue"], [class*="single-value"]');
            return val?.textContent?.trim() || '';
          }).catch(() => '');
          if (newVal) {
            console.log(`    ✓ Dropdown: "${label}" → "${newVal}" (Enter key)`);
            clicked = true;
          }
        }

        if (clicked) {
          filledIds.add(id);
        } else {
          await page.keyboard.press('Escape').catch(() => {});
          console.log(`    ○ Dropdown: "${label}" — couldn't select "${answer}", fill manually`);
        }
      } catch (err) {
        console.log(`    ○ Dropdown failed: "${label}" — ${(err as Error).message.slice(0, 60)}`);
        await page.keyboard.press('Escape').catch(() => {});
      }
      await sleep(100);
    }
  } catch (err) {
    console.log(`  ⚠ Dropdown handler error (continuing): ${(err as Error).message}`);
  }
  } // end combobox two-pass loop

  // ── Fill any remaining unfilled pre-scraped fields by ID ──
  // Catches comboboxes not found by page.$$('input[role="combobox"]')
  if (preScraped?.fields) {
    const unfilled = (preScraped.fields as any[]).filter((f: any) =>
      f.value && f.source !== 'unknown' && f.type === 'combobox' && f.fieldId && !filledIds.has(f.fieldId)
    );

    if (unfilled.length > 0) {
      console.log(`  Filling ${unfilled.length} remaining combobox fields by ID...`);

      for (const field of unfilled) {
        try {
          // Find the element by ID using attribute selector (safe for numeric IDs)
          const el = await page.$(`[id="${field.fieldId}"]`);
          if (!el) {
            console.log(`    ○ Element not found: #${field.fieldId} "${field.label}"`);
            continue;
          }

          // Check if already has a value
          const hasValue = await el.evaluate((e) => {
            const container = e.closest('[class*="select"]');
            const sv = container?.querySelector('[class*="singleValue"], [class*="single-value"]');
            return sv?.textContent?.trim() || '';
          }).catch(() => '');

          if (hasValue) {
            console.log(`    Already set: "${field.label}" = "${hasValue}"`);
            filledIds.add(field.fieldId);
            continue;
          }

          // Click to open, type answer, select from scoped menu
          await el.click({ timeout: 3000 }).catch(() => {});
          await sleep(300);
          await el.fill('');
          await el.type(field.value, { delay: 15 });
          await sleep(500);

          const menuId = await el.getAttribute('aria-controls').catch(() => '') || '';
          let clicked = false;

          if (menuId) {
            const opts = page.locator(`#${menuId} [class*="option"]`);
            const count = await opts.count().catch(() => 0);
            for (let i = 0; i < count; i++) {
              const text = (await opts.nth(i).textContent().catch(() => '') || '').trim();
              if (text.toLowerCase() === field.value.toLowerCase() ||
                  text.toLowerCase().includes(field.value.toLowerCase()) ||
                  field.value.toLowerCase().includes(text.toLowerCase())) {
                await opts.nth(i).click({ timeout: 3000 });
                console.log(`    ✓ By ID: "${field.label}" → "${text}"`);
                clicked = true;
                filledIds.add(field.fieldId);
                break;
              }
            }
          }

          if (!clicked) {
            // Try pressing Enter on first filtered result
            await page.keyboard.press('Enter');
            await sleep(200);
            const newVal = await el.evaluate((e) => {
              const c = e.closest('[class*="select"]');
              const v = c?.querySelector('[class*="singleValue"]');
              return v?.textContent?.trim() || '';
            }).catch(() => '');
            if (newVal) {
              console.log(`    ✓ By ID: "${field.label}" → "${newVal}" (Enter)`);
              filledIds.add(field.fieldId);
            } else {
              await page.keyboard.press('Escape').catch(() => {});
              console.log(`    ○ By ID: "${field.label}" — failed`);
            }
          }
        } catch (err) {
          console.log(`    ○ By ID failed: "${field.label}" — ${(err as Error).message.slice(0, 50)}`);
          await page.keyboard.press('Escape').catch(() => {});
        }
        await sleep(100);
      }
    }
  }

  // ── Text inputs (skip file, hidden, and combobox inputs) ──
  try {
    const inputs = await page.$$(
      'form input[type="text"], form input[type="email"], form input[type="tel"], form input[type="number"], form input[type="url"]',
    );
    for (const input of inputs) {
      const isHidden = await input.isHidden().catch(() => true);
      if (isHidden) continue;

      const id = (await input.getAttribute('id').catch(() => '')) || '';

      // Skip combobox inputs and already-filled fields
      const role = await input.getAttribute('role').catch(() => '');
      if (role === 'combobox') continue;
      if (id && filledIds.has(id)) continue;

      const label = await getFieldLabel(input, page);
      if (!label) continue;

      // Skip non-meaningful labels
      if (isSkippableLabel(label)) continue;

      const existing = await input.inputValue().catch(() => '');
      if (existing) {
        filledIds.add(id);
        continue;
      }

      console.log(`    Field: id="${id}" label="${label}" type="text"`);

      // Try pre-scraped answer first (already reviewed — fill instantly)
      const preAnswer = getPreScrapedAnswer(id, label);
      if (preAnswer !== null) {
        await input.fill(preAnswer);
        await sleep(100);
        console.log(`    ✓ Filled (pre-scraped): "${label}" = "${preAnswer}"`);
        filledIds.add(id);
        continue;
      }

      // Try saved rules first (user corrections override hardcoded defaults)
      try {
        const ruleAnswer = await answerQuestion(label, 'text');
        if (ruleAnswer && ruleAnswer.length > 0 && ruleAnswer.length < 200) {
          await input.fill(ruleAnswer);
          await sleep(100);
          console.log(`    ✓ Filled (rule): "${label}" = "${ruleAnswer}"`);
          filledIds.add(id);
          continue;
        }
      } catch {
        /* fall through */
      }

      // Try hardcoded profile mapping as fallback
      const directAnswer = getDirectAnswer(id, label, profile);
      if (directAnswer !== null) {
        await input.fill(directAnswer);
        await sleep(100);
        console.log(`    ✓ Filled (profile): "${label}" = "${directAnswer}"`);
        filledIds.add(id);
        continue;
      }

      // No LLM — leave unknown fields for user to fill manually
      console.log(`    ○ Skipped: "${label}" — no pre-scraped/rule/profile answer, fill manually`);
    }
  } catch (err) {
    console.log(`  ⚠ Text input handler error (continuing): ${(err as Error).message}`);
  }

  // ── Textareas (skip cover letter — handled separately) ──
  try {
    // Load cover letter for company-specific questions
    const { CoverLetterModel } = await import('../db');
    const existingCoverLetter = await CoverLetterModel.findOne({ externalJobId: job.id })
      .sort({ generatedAt: -1 })
      .lean()
      .catch(() => null);
    const coverLetterText = (existingCoverLetter as any)?.content || '';

    const textareas = await page.$$('form textarea');
    for (const textarea of textareas) {
      const isHidden = await textarea.isHidden().catch(() => true);
      if (isHidden) continue;

      const label = await getFieldLabel(textarea, page);
      if (!label || label.toLowerCase().includes('cover letter') || isSkippableLabel(label))
        continue;

      const existing = await textarea.inputValue().catch(() => '');
      if (existing) continue;

      // Try pre-scraped answer first
      const preAnswer = getPreScrapedAnswer('', label);
      if (preAnswer) {
        await textarea.fill(preAnswer);
        await sleep(200);
        console.log(`    ✓ Filled textarea (pre-scraped): "${label}"`);
        continue;
      }

      // Detect "why interested" / company-specific questions — use cover letter as reference
      const labelLower = label.toLowerCase();
      const isWhyQuestion = [
        'why are you interested',
        'why do you want to work',
        'why this company',
        'why this role',
        'what interests you about this',
        'what excites you about this',
        'what attracts you to this',
        'why should we hire you',
        'tell us why you',
        'why do you want to join',
      ].some((p) => labelLower.includes(p));

      if (isWhyQuestion && coverLetterText) {
        console.log(`    Company-specific question detected: "${label}" — using cover letter`);
        const { llmChat } = await import('@job-agent/shared');
        try {
          const response = await llmChat(
            `Based on this cover letter, write a 2-3 sentence answer to the question: "${label}"\n\nCover letter:\n${coverLetterText}\n\nJob: ${job.title} at ${job.company}\n\nWrite ONLY the answer, no preamble.`,
            { temperature: 0.2, maxTokens: 150 },
          );
          await textarea.fill(response);
          console.log(`    ✓ Filled (from cover letter): "${label}"`);
          await logQuestionAnswer(job.id, job.title, job.company, {
            question: label,
            type: 'textarea',
            answer: response,
            source: 'llm',
          }).catch(() => {});
          await sleep(200);
          continue;
        } catch {
          /* fall through to ask user */
        }
      }

      // Try rule-based, skip if unknown — user fills manually
      let answer = '';
      try {
        const ruleAnswer = await answerQuestion(label, 'textarea');
        if (ruleAnswer && ruleAnswer.length > 0) answer = ruleAnswer;
      } catch {
        /* skip */
      }

      if (!answer) {
        console.log(`    ○ Skipped textarea: "${label}" — fill manually`);
        continue;
      }

      if (answer) {
        await textarea.fill(answer);
        await sleep(200);
        console.log(`    Filled textarea: "${label}"`);
      }
    }
  } catch (err) {
    console.log(`  ⚠ Textarea handler error (continuing): ${(err as Error).message}`);
  }

  // ── Selects / Dropdowns — pick from available options only ──
  try {
    const selects = await page.$$('form select');
    for (const select of selects) {
      const isHidden = await select.isHidden().catch(() => true);
      if (isHidden) continue;

      const label = await getFieldLabel(select, page);
      if (!label) continue;

      // Check if already selected (not on default empty option)
      const currentValue = await select
        .$eval('option:checked', (o: Element) => (o as HTMLOptionElement).value)
        .catch(() => '');
      if (currentValue) continue;

      const options = await select.$$eval('option:not([value=""])', (opts: Element[]) =>
        opts.map((o) => (o as HTMLOptionElement).text.trim()),
      );
      if (!options.length) continue;

      // Resolve answer: pre-scraped → rules → profile (NO LLM), all via smartMatchOption
      let bestOption = '';
      const preAnswer = getPreScrapedAnswer('', label);
      if (preAnswer) {
        const matched = smartMatchOption(preAnswer, options, label);
        if (matched) bestOption = matched;
      }
      if (!bestOption) {
        try {
          const ruleAnswer = await answerQuestion(label, 'select', options);
          if (ruleAnswer) {
            const matched = smartMatchOption(ruleAnswer, options, label);
            if (matched) bestOption = matched;
          }
        } catch {
          /* skip */
        }
      }
      if (!bestOption) {
        const directAnswer = getDirectAnswer('', label, profile, 'select');
        if (directAnswer) {
          const matched = smartMatchOption(directAnswer, options, label);
          if (matched) bestOption = matched;
        }
      }
      if (!bestOption) {
        console.log(`    ○ Skipped select: "${label}" — fill manually`);
        continue;
      }

      await select.selectOption({ label: bestOption });
      console.log(`    Select: "${label}" → "${bestOption}"`);
      await logQuestionAnswer(job.id, job.title, job.company, {
        question: label,
        type: 'select',
        options: options.length <= 20 ? options : undefined,
        answer: bestOption,
        source: 'rule',
      }).catch(() => {});
      await sleep(100);
    }
  } catch (err) {
    console.log(`  ⚠ Select handler error (continuing): ${(err as Error).message}`);
  }

  // ── Radio buttons ──
  try {
    const fieldsets = await page.$$('form fieldset');
    for (const fieldset of fieldsets) {
      const legend = await fieldset
        .$eval('legend', (el: Element) => el.textContent?.trim() ?? '')
        .catch(() => '');
      if (!legend) continue;

      const radioLabels = await fieldset.$$eval('label', (labels: Element[]) =>
        labels.map((l) => l.textContent?.trim() ?? ''),
      );
      if (!radioLabels.length) continue;

      // Check if already selected
      const checked = await fieldset.$('input[type="radio"]:checked');
      if (checked) continue;

      // Try pre-scraped answer first — smart deterministic matching
      let answer = '';
      const preAnswer = getPreScrapedAnswer('', legend);
      if (preAnswer) {
        const matched = smartMatchOption(preAnswer, radioLabels, legend);
        if (matched) {
          answer = matched;
          console.log(`    ✓ Pre-scraped match: "${legend}" → "${matched}"`);
        }
      }

      // Try saved rules first (user corrections override hardcoded defaults)
      if (!answer) {
        try {
          const ruleAnswer = await answerQuestion(legend, 'radio', radioLabels);
          if (ruleAnswer) {
            const matched = smartMatchOption(ruleAnswer, radioLabels, legend);
            if (matched) answer = matched;
          }
        } catch {
          /* skip */
        }
      }

      // Try hardcoded profile answer as fallback
      if (!answer) {
        const directAnswer = getDirectAnswer('', legend, profile, 'radio');
        if (directAnswer) {
          const matched = smartMatchOption(directAnswer, radioLabels, legend);
          if (matched) answer = matched;
        }
      }
      if (!answer) {
        console.log(`    ○ Skipped radio: "${legend}" — fill manually`);
        continue;
      }

      // Check if this fieldset has radio buttons or checkboxes
      const radios = await fieldset.$$('input[type="radio"]');
      const checkboxes = await fieldset.$$('input[type="checkbox"]');

      if (radios.length > 0) {
        // Single-select radio
        for (const radio of radios) {
          const radioId = await radio.getAttribute('id').catch(() => '');
          if (!radioId) continue;
          const radioLabel = await page
            .$eval(`label[for="${radioId}"]`, (el: Element) => el.textContent?.trim() ?? '')
            .catch(() => '');
          if (
            radioLabel.toLowerCase().includes(answer.toLowerCase()) ||
            answer.toLowerCase().includes(radioLabel.toLowerCase())
          ) {
            await radio.click();
            console.log(`    Radio: "${legend}" → "${radioLabel}"`);
            break;
          }
        }
      } else if (checkboxes.length > 0) {
        // Multi-select checkboxes ("select all that apply")
        const answers = answer.split(',').map((a) => a.trim().toLowerCase());
        for (const checkbox of checkboxes) {
          const cbId = await checkbox.getAttribute('id').catch(() => '');
          if (!cbId) continue;
          const cbLabel = await page
            .$eval(`label[for="${cbId}"]`, (el: Element) => el.textContent?.trim() ?? '')
            .catch(() => '');
          const shouldCheck = answers.some(
            (a) => cbLabel.toLowerCase().includes(a) || a.includes(cbLabel.toLowerCase()),
          );
          if (shouldCheck) {
            const isChecked = await checkbox.isChecked().catch(() => false);
            if (!isChecked) {
              await checkbox.click();
              console.log(`    Checkbox: "${legend}" → "${cbLabel}"`);
            }
          }
        }
      }
      await sleep(100);
    }
  } catch (err) {
    console.log(`  ⚠ Radio handler error (continuing): ${(err as Error).message}`);
  }

}

async function handleCoverLetterField(page: Page, job: ScoredJob): Promise<void> {
  console.log('    Checking for cover letter field...');

  // Find the cover letter section by its label, then find the "Enter manually" button within it
  const coverLetterSection = await page.$('#upload-label-cover_letter, [id*="cover_letter"]');
  if (!coverLetterSection) {
    console.log('    No cover letter section found');
    return;
  }

  // Find the "Enter manually" button near the cover letter section
  // Get all "Enter manually" buttons and click the one associated with cover letter
  const allEnterBtns = await page.$$('button:has-text("Enter manually")');
  console.log(`    Found ${allEnterBtns.length} "Enter manually" button(s)`);

  // Click the LAST one — Greenhouse shows resume first, then cover letter
  // So the second "Enter manually" is for cover letter
  let clickedBtn = false;
  if (allEnterBtns.length >= 2) {
    console.log('    Clicking "Enter manually" for cover letter (2nd button)...');
    await allEnterBtns[allEnterBtns.length - 1].click();
    clickedBtn = true;
  } else if (allEnterBtns.length === 1) {
    // Only one button — check if resume is already uploaded (file input has value)
    const resumeInput = await page.$('input[type="file"][id="resume"]');
    const resumeValue = resumeInput
      ? await resumeInput.evaluate((el: any) => el.files?.length > 0).catch(() => false)
      : false;
    if (resumeValue) {
      // Resume already uploaded, this button must be for cover letter
      console.log('    Clicking "Enter manually" for cover letter...');
      await allEnterBtns[0].click();
      clickedBtn = true;
    }
  }

  // Load existing cover letter (pre-scraped or from DB) — avoid regeneration
  let coverLetter = '';
  const { ApplicationFieldsModel } = await import('@job-agent/shared');
  const preFilled = (await ApplicationFieldsModel.findOne({ externalJobId: job.id })
    .lean()
    .catch(() => null)) as any;
  if (preFilled?.coverLetter) {
    coverLetter = preFilled.coverLetter;
  }
  if (!coverLetter) {
    const { CoverLetterModel } = await import('../db');
    const existing = await CoverLetterModel.findOne({ externalJobId: job.id })
      .sort({ generatedAt: -1 })
      .lean()
      .catch(() => null);
    if ((existing as any)?.content) coverLetter = (existing as any).content;
  }

  if (clickedBtn) {
    await sleep(800);
  }

  // Look for the textarea — try multiple selectors and retry once
  let coverLetterTextarea = await page.$(
    'textarea[id*="cover_letter"], textarea[name*="cover_letter"]',
  );

  if (!coverLetterTextarea && coverLetterSection) {
    const parent = await coverLetterSection.evaluateHandle(
      (el: Element) =>
        el.closest('.field, .upload-field, [class*="field"]') || el.parentElement?.parentElement,
    );
    if (parent) {
      coverLetterTextarea = await parent.$('textarea');
    }
  }

  // Retry — textarea may take a moment to render after button click
  if (!coverLetterTextarea && clickedBtn) {
    await sleep(500);
    coverLetterTextarea = await page.$(
      'textarea[id*="cover_letter"], textarea[name*="cover_letter"]',
    );
    if (!coverLetterTextarea) {
      // Try any textarea near cover letter section
      coverLetterTextarea = await page.$('[class*="cover"] textarea, [id*="cover"] textarea');
    }
  }

  if (!coverLetterTextarea) {
    console.log('    No cover letter textarea — using file upload');
    const fileUpload = await page.$('input[type="file"][id="cover_letter"]');
    if (fileUpload) {
      try {
        if (!coverLetter) coverLetter = await generateCoverLetter(job);
        const tempDir = path.join(__dirname, '../../data/cover-letters');
        fs.mkdirSync(tempDir, { recursive: true });
        const filename = `${job.company.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-cover-letter.txt`;
        const filepath = path.join(tempDir, filename);
        fs.writeFileSync(filepath, coverLetter);
        await fileUpload.setInputFiles(filepath);
        if (!preFilled?.coverLetter) await saveCoverLetter(job.id, coverLetter);
        console.log(`    ✓ Cover letter uploaded as file (${coverLetter.length} chars)`);
      } catch (err) {
        console.log(`    Cover letter upload failed: ${(err as Error).message}`);
      }
    }
    return;
  }

  const existingText = await coverLetterTextarea.inputValue().catch(() => '');
  if (existingText) {
    console.log('    Cover letter already filled');
    return;
  }

  // Use pre-existing cover letter, only generate if none exists
  if (!coverLetter) {
    console.log('    Generating cover letter...');
    try {
      coverLetter = await generateCoverLetter(job);
    } catch (err) {
      console.log(`    Generation failed: ${(err as Error).message}`);
      return;
    }
  }

  // Fill it directly into the form
  await coverLetterTextarea.fill(coverLetter);
  console.log(`    ✓ Cover letter filled in form (${coverLetter.length} chars)`);

  // Save to database for the Cover Letters tab
  if (!preFilled?.coverLetter) await saveCoverLetter(job.id, coverLetter);
}

async function handleResumeUpload(page: Page): Promise<void> {
  // Target specifically the resume upload, not the cover letter one
  const fileInput = await page.$(
    'input[type="file"][id="resume"], input[type="file"][name*="resume"]',
  );
  if (!fileInput) return;

  const resumeDir = path.join(__dirname, '../../data/resume');
  let resumePath = '';

  // Find any PDF in the resume directory
  try {
    const files = fs.readdirSync(resumeDir).filter((f: string) => f.toLowerCase().endsWith('.pdf'));
    if (files.length > 0) {
      resumePath = path.join(resumeDir, files[0]);
    }
  } catch {
    /* dir doesn't exist */
  }

  if (!resumePath) {
    console.log('    No resume PDF found in data/resume/, skipping upload');
    return;
  }

  await fileInput.setInputFiles(resumePath);
  console.log('    Uploaded resume');
  await sleep(1000);
}

export async function applyViaGreenhouse(page: Page, job: ScoredJob): Promise<ApplicationResult> {
  try {
    // Build direct Greenhouse application URL if possible
    const directUrl = getGreenhouseDirectUrl(job);
    const targetUrl = directUrl || job.url;

    console.log(`  Navigating to: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1000);

    // If we landed on a company page (not Greenhouse directly), click Apply
    if (!page.url().includes('greenhouse.io')) {
      const applyBtn = await page.$(
        'a[href*="apply"], a[href*="#app"], a:has-text("Apply for this job"), a:has-text("Apply Now"), a:has-text("Apply"), button:has-text("Apply")',
      );
      if (applyBtn) {
        console.log('  Clicking Apply button...');
        await applyBtn.click();
        await sleep(1500);
      }

      // Check if the form is in an iframe
      const ghFrame = page.frames().find((f) => f.url().includes('greenhouse.io'));
      if (ghFrame) {
        console.log('  Found Greenhouse iframe — switching to it');
        // Navigate directly to the iframe URL instead
        const iframeUrl = ghFrame.url();
        await page.goto(iframeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(1000);
      }
    }

    // Wait for the first_name field
    const nameField = await page
      .waitForSelector('input[id="first_name"], input[id="firstname"], input[name*="first_name"]', {
        timeout: 15000,
      })
      .catch(() => null);
    if (!nameField) {
      console.log('  No application form found (no first_name field)');
      await page
        .screenshot({ path: path.join(__dirname, '../../data/debug-greenhouse-apply.png') })
        .catch(() => null);
      return { success: false, reason: 'No application form found on page' };
    }

    console.log('  Application form found (first_name field detected)');

    // ── Try "Autofill with MyGreenhouse" ──
    const autofillBtn = await page.$(
      'button:has-text("Autofill with"), button:has-text("MyGreenhouse"), button:has-text("Autofill")',
    );
    if (autofillBtn) {
      const btnText = await autofillBtn.textContent().catch(() => '');
      console.log(`  Found autofill button: "${btnText?.trim()}" — clicking...`);
      await autofillBtn.click();
      await sleep(1500);

      // Check if it triggered login or directly filled
      const firstNameValue = await page.$eval('#first_name', (el: any) => el.value).catch(() => '');
      if (firstNameValue) {
        console.log(`  ✓ Autofill worked — first name: "${firstNameValue}"`);
      } else {
        // May need login — wait for user
        console.log('  ⏸ Autofill may need login — waiting...');
        await page
          .waitForFunction(
            () => {
              const el = document.querySelector('#first_name') as HTMLInputElement;
              return el && el.value.length > 0;
            },
            { timeout: 60000 },
          )
          .catch(() => {
            console.log('  Autofill timed out — will fill manually');
          });
      }
      await sleep(500);
    } else {
      console.log('  No Autofill button found — filling manually...');
    }

    // Cover letters are pre-generated in phase4 before browser launch

    // Fill form — wrap in try/catch so errors don't kill the watch loop
    try {
      await handleResumeUpload(page);
      await handleCoverLetterField(page, job);
      console.log('  Filling form fields...');
      await fillFormFields(page, job);
    } catch (err) {
      console.log(`  ⚠ Form fill error (continuing to watch): ${(err as Error).message}`);
    }

    // Check for empty required fields
    try {
      const emptyRequired = await page.evaluate(() => {
        const empties: string[] = [];
        document.querySelectorAll('input, textarea, select').forEach((el: any) => {
          if (el.offsetParent === null) return; // hidden
          if (el.type === 'file' || el.type === 'hidden' || el.type === 'submit') return;
          if (el.role === 'combobox') return;
          const val = el.value?.trim() || '';
          if (!val) {
            const id = el.id || '';
            const label = el.getAttribute('aria-label') || id || el.name || '?';
            const tag = el.tagName?.toLowerCase() || '?';
            const role = el.role || '';
            const type = el.type || '';
            empties.push(`${label} [${tag}${type ? ':' + type : ''}${role ? ' role=' + role : ''}]`);
          }
        });
        return empties;
      });

      if (emptyRequired.length > 0) {
        console.log(`  ⚠ ${emptyRequired.length} empty fields: ${emptyRequired.join(', ')}`);
      } else {
        console.log('  ✓ All visible fields filled');
      }
    } catch (err) {
      console.log(`  ⚠ Field check error (continuing): ${(err as Error).message}`);
    }

    // ── Auto-submit the form ──
    setFormPageUrl(page.url());

    // Capture answers before submitting
    try {
      await captureFormAnswers(page, job);
    } catch { /* skip */ }

    // Click submit button
    // TEMP: Skip auto-submit for testing — set to true to disable submit
    const skipSubmit = true;
    const submitBtn = await page.$('form button[type="submit"], button:has-text("Submit Application"), button:has-text("Submit")');
    if (submitBtn && !skipSubmit) {
      console.log('  Clicking Submit...');
      await submitBtn.click();
      await sleep(3000);

      // Check if submission succeeded
      const success = await detectSubmissionSuccess(page);
      if (success) {
        console.log('  ✓ Application submitted successfully!');
        return { success: true, method: 'greenhouse' };
      }
      console.log('  Submit clicked — waiting for confirmation...');
    } else {
      console.log('  No submit button found — watching for manual submission...');
    }

    console.log('  (Watching for submission confirmation...)');

    const maxWait = 30 * 60 * 1000;
    const start = Date.now();
    let pollCount = 0;
    let answersCaptured = false;

    while (Date.now() - start < maxWait) {
      await sleep(3000);
      pollCount++;

      try {
        // Detect if page/browser was closed
        if (page.isClosed()) {
          console.log('  Page closed by user. Moving to next job.');
          return { success: false, reason: 'Page closed by user' };
        }

        const currentUrl = page.url();
        if (!currentUrl || currentUrl === 'about:blank') continue;

        // Check for submission
        const pageSuccess = await detectSubmissionSuccess(page);
        if (pageSuccess) {
          console.log('  ✓ Submission detected!');
          console.log('  Waiting 15s for verification code...');
          await sleep(15000);
          return { success: true, method: 'greenhouse' };
        }

        // Capture answers ONCE when form is still visible (just before user submits)
        // Overwrite previous capture, don't append
        if (!answersCaptured) {
          const formExists = await page
            .$('input[id="first_name"], form button[type="submit"]')
            .catch(() => null);
          if (formExists) {
            // Wait 30s before first capture — let user fill fields
            if (Date.now() - start > 30000) {
              await captureFormAnswers(page, job);
              answersCaptured = true;
            }
          }
        }

        // Log every 30 polls (~90s)
        if (pollCount % 30 === 0) {
          const elapsed = Math.round((Date.now() - start) / 60000);
          console.log(`  ... still watching (${elapsed} min elapsed)`);
          // Re-capture in case user filled more fields
          const formExists = await page.$('form button[type="submit"]').catch(() => null);
          if (formExists) {
            await captureFormAnswers(page, job);
          }
        }
      } catch (err) {
        const msg = (err as Error).message || '';
        if (msg.includes('closed') || msg.includes('destroyed') || msg.includes('disposed')) {
          console.log('  Page/browser closed. Moving to next job.');
          return { success: false, reason: 'Page closed by user' };
        }
        console.log(`  Watch error (continuing): ${msg}`);
      }
    }

    // Timed out
    console.log('  ⏰ Timed out (30 min). Moving to next job.');
    return { success: false, reason: 'Timed out waiting for submission' };
  } catch (err) {
    console.log(`  ✗ CRITICAL ERROR — this is why the browser closed: ${(err as Error).message}`);
    console.log(`  Stack: ${(err as Error).stack?.slice(0, 300)}`);
    await page
      .screenshot({ path: path.join(__dirname, '../../data/debug-greenhouse-apply.png') })
      .catch(() => null);
    return { success: false, reason: (err as Error).message };
  }
}
