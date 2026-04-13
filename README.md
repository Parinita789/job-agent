# Job Agent Monorepo

> **This project was developed for personal use.**

An AI-powered job hunting automation platform that scrapes job listings from multiple platforms, scores them for fit, generates tailored cover letters, and automates linkedIn easy apply & Greenhouse job applications with intelligent form filling — all from a single monorepo.

## Architecture

```
packages/
├── shared/    — Mongoose schemas, DB connection, unified LLM client (3 providers)
├── scraper/   — Job scraping, scoring, cover letters, auto-apply (Greenhouse)
├── api/       — NestJS REST API
└── ui/        — React + Vite dashboard
```

## Pipeline

Selectable individually or together from the dashboard:

| Phase              | What it does                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Scrape & Score** | Scrapes LinkedIn (8 queries + alerts), Greenhouse (API), Lever (API). Platform selection per run. Two-layer filtering + LLM scoring. Jobs scoring 5+ → Queue.                        |
| **Gmail Alerts**   | Polls Gmail every 1hr for LinkedIn alert emails via IMAP. Parses job URLs, scrapes + scores automatically.                                                                           |
| **Rescore**        | Re-evaluates all existing jobs with updated profile/rules.                                                                                                                           |
| **Auto Apply**     | Opens Greenhouse application pages, fills forms from profile + saved rules + LLM, generates cover letters, watches silently for submission. Select specific jobs from the Queue tab. |

## Auto Apply (Greenhouse)

The semi-autonomous form filler:

1. **Resolves URL** — converts company career page URLs to direct `job-boards.greenhouse.io` URLs, handles iframes
2. **Clicks "Autofill with MyGreenhouse"** if available
3. **Fills known fields** from candidate profile — name, email, phone, location, LinkedIn, GitHub, experience, education, salary, demographics, work authorization, availability
4. **Handles React Select dropdowns** — opens, reads options from the active menu, picks best match
5. **Yes/No questions** — auto-answers based on field label patterns (work auth, relocation, background check, etc.)
6. **Unknown fields** — Claude (Opus 4.6) generates answers using job context + profile. Answers saved as rules for future auto-fill
7. **Cover letter** — clicks "Enter manually", generates via LLM with few-shot examples, pastes into textarea. Falls back to file upload
8. **"Why interested" questions** — answers using the cover letter as context
9. **Watches silently** — no popups. Captures your answers once before submission, detects "Thank you" page automatically, marks job as applied
10. **Session persistence** — saves/loads Greenhouse cookies between jobs
11. **Anti-detection** — realistic browser fingerprint, human-like typing, geolocation, `navigator.webdriver` override

### Form Answer Learning

- Every answer you provide is saved to `profileanswers` collection
- Next time the same question appears → auto-filled instantly (no LLM needed)
- View and edit all saved rules in **Form Answers → Rules tab**
- Per-job Q&A logs viewable in **Form Answers → Logs tab**

## Dashboard Features

- **Tabs:** Queue, Applied, Accepted, Rejected, Cover Letters
- **Filters:** Search (company/title), Platform (LinkedIn/Greenhouse/Lever), Score (5-9)
- **Select to Auto Apply** — click button in filter bar → checkboxes appear → select jobs → Auto Apply or Generate Cover Letters
- **Mark Applied / Dismiss** — with auto vs manual tracking
- **Status dropdown** on Applied tab — Waiting, Interviewing, Accepted, Declined, No Response
- **Accepted tab** — separate tab for jobs you've been accepted to
- **Cover Letters tab** — full-page split-panel with search, inline copy icon, latest first
- **Job descriptions** — rendered HTML with proper formatting
- **New badge** — jobs scraped within 24h marked "New", sorted to top
- **Posted date** — relative format from LinkedIn
- **Non-blocking pipeline** — floating bottom bar with logs, stop button, expand/collapse. Stays visible after completion
- **Pipeline logs on terminal** — `[pipeline]` prefix output to API console
- **Hamburger menu:** Candidate Profile (resume upload), Form Answers (rules + logs), Keywords, Pipeline

## Tech Stack

- **Language:** TypeScript (full-stack)
- **Monorepo:** npm workspaces
- **Scraping:** Playwright (Chrome, non-headless)
- **LLM:** Claude CLI subprocess / Ollama / Anthropic API (switchable via env)
- **Backend:** NestJS
- **Frontend:** React 18, Vite
- **Database:** MongoDB (Mongoose ODM)
- **Email:** Gmail IMAP (imapflow)

## LLM Providers

Controlled by `LLM_PROVIDER` in `.env`:

| Provider     | How                                                   | Quality                     | Cost              |
| ------------ | ----------------------------------------------------- | --------------------------- | ----------------- |
| `claude-cli` | Spawns `claude -p --model claude-opus-4-6` subprocess | Best (Opus 4.6, 1M context) | $0 (subscription) |
| `ollama`     | Local/remote Ollama server                            | Decent                      | $0                |
| `anthropic`  | Anthropic API                                         | Great                       | Per-token         |

All consumers use `llmChat()` from `@job-agent/shared` — scoring, cover letters, form filling, resume parsing all switch automatically.

## Design Decisions

### Cover Letter Generation

- 3 gold-standard Claude-generated cover letters hardcoded as few-shot examples
- AI skills highlighted when job mentions AI/agents/LLM/prompt engineering
- Company-specific closing: "I would be grateful for the opportunity to discuss..."
- Humble tone, no banned phrases, 2 paragraphs + closing

### Scoring

- Two-layer: fast filter (zero LLM cost) → LLM scoring (batches of 3)
- Full candidate skill profile in prompt to avoid false "missing skills"
- Staff-level roles not penalized for seniority — scored on tech stack fit
- Jobs outside US auto-rejected
- Full stack and AI/agent roles pass through filters

### Deduplication

Three layers: ID, company+title, URL — across all sources and runs. Applied, rejected, and dismissed jobs never re-scraped.

### Form Answer Deduplication

- Q&A logged per job — updates existing answers instead of appending duplicates
- Phone code values (`+1`, `+93`) filtered from recording
- Country lists (>100 options) skipped from dropdown handling
- Bot-internal questions ("Review the form...") not saved as rules

### Anti-Detection

- Full-screen Chrome with realistic fingerprint (plugins, hardware, geolocation, screen)
- `navigator.webdriver` set to `undefined`
- Human-like typing with variable delay
- Session cookie persistence (LinkedIn + Greenhouse)
- `domcontentloaded` navigation (faster, less detectable than `networkidle`)

## Getting Started

### Prerequisites

- Node.js, npm
- MongoDB (local or Docker)
- Claude Code CLI (for `claude-cli` provider) or Ollama (for `ollama` provider)

### Install

```bash
npm install
```

### Candidate Profile

Upload a resume (PDF) through the UI to auto-generate a profile, or copy the example:

```bash
cp packages/scraper/profile/candidate.example.json packages/scraper/profile/candidate.json
```

Place your resume PDF in `packages/scraper/data/resume/`.

### Environment

Create a `.env` file at the root:

```
MONGO_URI=mongodb://localhost:27017/job-tracker
API_PORT=3001
LLM_PROVIDER=claude-cli
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3:latest
ANTHROPIC_API_KEY=
GMAIL_EMAIL=your-job-alerts@gmail.com
GMAIL_APP_PASSWORD=your-app-password
```

### Run

```bash
# API + UI
npm run api                     # Backend on port 3001
npm run ui                      # Frontend on port 5173

# Pipeline (from CLI)
npm run scraper                 # Scrape + score (LinkedIn + Greenhouse + Lever)
npm run scraper:gmail-alerts    # Gmail alerts (polls every 1hr)
npm run scraper:rescore         # Re-evaluate scored jobs
npm run scraper:phase4          # Auto-apply
```

### Gmail Alerts

1. Forward LinkedIn job alert emails to your Gmail
2. Set `GMAIL_EMAIL` and `GMAIL_APP_PASSWORD` in `.env`
3. Run "Gmail Alerts" from the pipeline UI — checks every hour automatically

### Rebuild Shared Package

After modifying `packages/shared/`:

```bash
npx tsc --project packages/shared/tsconfig.json
```

### Lint & Format

```bash
npm run lint
npm run format
```

## Database Collections

| Collection        | Purpose                                        |
| ----------------- | ---------------------------------------------- |
| `jobs`            | All scraped jobs with scores, status, metadata |
| `coverletters`    | Generated cover letters linked to jobs         |
| `users`           | Candidate profile (one document)               |
| `profileanswers`  | Reusable form answer rules (question → answer) |
| `questionanswers` | Per-job Q&A logs from auto-apply               |
