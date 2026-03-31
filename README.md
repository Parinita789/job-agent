# Job Agent Monorepo

> **This project was developed for personal use.**

An AI-powered job hunting automation platform that scrapes job listings from multiple platforms, scores them for fit using LLMs, generates tailored cover letters, and automates applications — all from a single monorepo.

## Architecture

```
packages/
├── shared/    — Shared TypeScript types and schemas
├── scraper/   — Job scraping, scoring, and application automation
├── api/       — NestJS REST API
└── ui/        — React + Vite dashboard
```

## Pipeline

The system operates in phases, selectable individually or together from the dashboard:

1. **Scrape & Score** — Collects jobs from LinkedIn, Greenhouse, Lever, and Indeed. Platform selection is configurable per run. Filters out deal-breakers, then scores each listing for fit using the Anthropic Claude API. Jobs scoring 5+ go to Queue, below 5 go to Rejected.
2. **LinkedIn Alerts** — Scrapes jobs from LinkedIn saved alert subscriptions.
3. **Email Alerts** — Parses LinkedIn job alert `.eml` files saved locally, visits each job page, and scores them. Drop `.eml` files into `packages/scraper/data/email-alerts/` and run this phase.
4. **Rescore** — Re-evaluates all existing jobs without re-scraping. Useful after updating your profile or scoring preferences.
5. **Cover Letters** — Generates personalized cover letters for jobs scoring 5+.
6. **Auto-Apply** — Automates LinkedIn Easy Apply submissions via Playwright.

## Dashboard Features

- **Non-blocking pipeline** — pipeline runs in a floating bottom bar; browse jobs, apply, and manage your profile while it runs. Stop anytime.
- **Platform filter** — filter the job table by LinkedIn, Greenhouse, Lever, or Indeed.
- **Mark Applied / Dismiss** — mark jobs as applied (tracks auto vs manual) or dismiss expired postings. Dismissed jobs are never re-scraped.
- **Per-job cover letter** — generate or regenerate a cover letter from the job detail modal.
- **Candidate Profile editor** — edit your skills, preferences, deal-breakers, and compensation from the UI (hamburger menu).
- **Form Answers manager** — view and edit rule-based answers used during Easy Apply form filling. See logs of all Q&A from previous auto-apply runs (hamburger menu).
- **New badge** — jobs scraped within the last 24 hours are marked "New" and sorted to the top.

## Tech Stack

- **Language:** TypeScript (full-stack)
- **Monorepo:** npm workspaces
- **Scraping:** Playwright
- **LLM (scoring + cover letters):** Anthropic Claude API (claude-sonnet-4-6)
- **LLM (form filling):** Ollama (llama3, local inference)
- **Backend:** NestJS
- **Frontend:** React 18, Vite
- **Storage:** File-based JSON
- **Scheduling:** macOS launchd (12am + 12pm daily)

## Design Decisions

### Two-tier LLM strategy

- **Claude API** for high-stakes decisions — job fit scoring and cover letter generation. These require strong reasoning and structured JSON output.
- **Ollama (llama3, local)** for repetitive form filling — answering Easy Apply questions. Rule-based matching is tried first; Ollama is the fallback. Running locally eliminates per-call API costs.

### Two-layer filtering

1. **Fast filter (zero LLM cost)** — deal-breaker rules (salary floor, employment type, pure frontend detection) and keyword rejection (wrong stack: Java, .NET, Ruby, PHP, Flutter). Full stack and AI/agent roles pass through.
2. **LLM scoring** — only jobs surviving layer 1 are sent to Claude. Each job gets a 1-10 score, matched/missing skills, and a reason.

### Three-layer deduplication

Jobs are deduplicated by ID, company+title, and URL — across all sources and all previous runs. Applied, rejected, and dismissed jobs are never re-scraped.

### File-based storage over database

Jobs are stored in `packages/scraper/data/jobs.json`. Single user, small dataset, no infrastructure overhead. MongoDB schemas exist in `packages/shared` if scaling is ever needed.

### Concurrency

LLM scoring runs in batches of 2 (`LLM_CONCURRENCY = 2`) with `Promise.all()`. Results are persisted to disk after each batch. On 429 errors, exponential backoff (30s, 60s, 90s). Scraping is sequential per source to avoid bot detection.

### Anti-detection

- Random delays (2-5s) between interactions
- User-agent spoofing
- `navigator.webdriver` override
- Session cookie persistence
- Headless mode only with saved session

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

```bash
cp packages/scraper/profile/candidate.example.json packages/scraper/profile/candidate.json
```

Edit `candidate.json` with your experience, skills, preferences, deal-breakers, and compensation. The agent uses this to score jobs, filter roles, generate cover letters, and fill application forms.

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
npm run scraper               # Scrape + score (all platforms)
npm run scraper:alerts        # LinkedIn alerts
npm run scraper:email-alerts  # Email alerts (.eml files)
npm run scraper:rescore       # Re-evaluate scored jobs
npm run scraper:phase3        # Generate cover letters
npm run scraper:phase4        # Auto-apply (LinkedIn Easy Apply)

# API + UI
npm run api                   # Backend on port 3001
npm run ui                    # Frontend on port 5173
```

### Scheduling

The full pipeline runs automatically at 12am and 12pm daily via macOS launchd.

```bash
# Check status
launchctl list | grep jobagent

# Stop
launchctl unload ~/Library/LaunchAgents/com.jobagent.pipeline.plist

# Restart
launchctl load ~/Library/LaunchAgents/com.jobagent.pipeline.plist
```

### Lint & Format

```bash
npm run lint
npm run format
```
