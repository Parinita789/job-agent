# Job Agent Monorepo

> **This project was developed for personal use.**

An AI-powered job hunting automation platform that scrapes job listings, scores them for fit using LLMs, generates tailored cover letters, and automates applications — all from a single monorepo.

## Architecture

```
packages/
├── shared/    — Shared TypeScript types and schemas
├── scraper/   — Job scraping, scoring, and application automation
├── api/       — NestJS REST API
└── ui/        — React + Vite dashboard
```

## Pipeline

The system operates in phases:

1. **Scrape & Score** — Collects jobs from LinkedIn, Greenhouse, and Lever. Filters out deal-breakers, then scores each listing for fit using the Anthropic Claude API.
2. **Cover Letters** — Generates personalized cover letters for high-scoring jobs (7+).
3. **Auto-Apply** — Automates LinkedIn Easy Apply submissions via Playwright.
4. **Alerts** — Monitors LinkedIn job alert subscriptions for new postings.

## Tech Stack

- **Language:** TypeScript (full-stack)
- **Monorepo:** npm workspaces
- **Scraping:** Playwright
- **LLM (scoring):** Anthropic Claude API (claude-sonnet-4-6, temp 0.1)
- **LLM (form filling):** Ollama (llama3, local inference)
- **Backend:** NestJS
- **Frontend:** React 18, Vite
- **Storage:** File-based JSON

## Design Decisions

### Two-tier LLM strategy

The system uses two different LLMs for different purposes:

- **Claude API** for high-stakes decisions — job fit scoring and cover letter generation. These require strong reasoning and structured JSON output, so a cloud model is worth the cost.
- **Ollama (llama3, local)** for low-stakes, repetitive tasks — answering Easy Apply form questions during automated applications. Rule-based matching is tried first; Ollama is the fallback. Running locally eliminates per-call API costs for questions that don't need frontier-level reasoning.

### Two-layer filtering

Jobs pass through two filtering layers before reaching the "to apply" queue:

1. **Fast filter (zero LLM cost)** — deal-breaker rules (salary floor, employment type, frontend-heavy role detection) and keyword rejection (wrong stack: Java, .NET, Ruby, PHP, Flutter). This eliminates ~70% of scraped jobs instantly.
2. **LLM scoring** — only jobs surviving layer 1 are sent to Claude for fit evaluation. Each job gets a 1-10 score, matched/missing skills, and an apply recommendation.

This keeps API costs proportional to the number of genuinely relevant jobs, not the total scraped.

### File-based storage over database

Jobs are stored in a flat JSON file (`packages/scraper/data/jobs.json`) rather than MongoDB. This was a deliberate choice:

- Single user, single process at a time — no concurrent write conflicts.
- Dataset stays small (hundreds of jobs, ~2MB).
- No infrastructure to manage — no daemon, no migrations, no connection strings.
- Easy to inspect, grep, and version control if needed.

MongoDB schemas exist in `packages/shared` if the project ever needs to scale, but for personal use the overhead isn't justified.

### Concurrency

LLM scoring runs in batches of 2 concurrent requests (`LLM_CONCURRENCY = 2`), using `Promise.all()` with manual array slicing. After each batch completes, results are persisted to disk before the next batch starts. This provides:

- **Progress checkpointing** — if the process crashes mid-run, scored jobs are already saved.
- **Rate limit safety** — stays within Claude API limits. On 429 errors, exponential backoff kicks in (30s, 60s, 90s retries).

Scraping is sequential per source to avoid bot detection. No external concurrency libraries are used.

### Anti-detection measures

LinkedIn scraping uses several techniques to avoid being flagged:

- Random delays (2-5s) between page interactions.
- User-agent spoofing (Chrome on macOS).
- `navigator.webdriver` property override.
- Session cookie persistence to avoid repeated logins.
- Headless mode only when a saved session exists; visible browser for initial login.

## Getting Started

### Prerequisites

- Node.js
- npm
- Ollama running locally (for Easy Apply form filling)

### Install

```bash
npm install
```

### Candidate Profile

The scraper needs a candidate profile to score jobs and generate cover letters. Copy the example and fill in your details:

```bash
cp packages/scraper/profile/candidate.example.json packages/scraper/profile/candidate.json
```

Edit `candidate.json` with your experience, skills, preferences, deal-breakers, and compensation requirements. The agent uses this to:

- Score job fit (matched/missing skills, salary floor checks)
- Filter out irrelevant roles (deal-breaker rules)
- Generate tailored cover letters (achievements, strengths)
- Answer Easy Apply form questions (work history, preferences)

### Environment

Create a `.env` file at the root:

```
ANTHROPIC_API_KEY=your-key
OLLAMA_BASE_URL=http://localhost:11434/v1
API_PORT=3001
```

### Run

```bash
# Pipeline phases
npm run scraper             # Phase 2: scrape + score
npm run scraper:phase3      # Phase 3: generate cover letters
npm run scraper:phase4      # Phase 4: auto-apply
npm run scraper:alerts      # Monitor job alerts
npm run scraper:rescore     # Re-evaluate scored jobs

# API + UI
npm run api                 # Backend on port 3001
npm run ui                  # Frontend on port 5173
```

### Lint & Format

```bash
npm run lint
npm run format
```
