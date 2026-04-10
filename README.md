# Job Agent Monorepo

> **This project was developed for personal use.**

An AI-powered job hunting automation platform that scrapes job listings from multiple platforms, scores them for fit using LLMs, generates tailored cover letters, and automates applications — all from a single monorepo.

## Architecture

```
packages/
├── shared/    — Shared types, Mongoose schemas, DB connection, LLM clients
├── scraper/   — Job scraping, scoring, and application automation
├── api/       — NestJS REST API
└── ui/        — React + Vite dashboard
```

## Pipeline

The system operates in phases, selectable individually or together from the dashboard:

1. **Scrape & Score** — Collects jobs from LinkedIn, Greenhouse, Lever, and Indeed. Platform selection is configurable per run. Filters out deal-breakers, then scores each listing using the LLM. Jobs scoring 5+ go to Queue, below 5 go to Rejected.
2. **LinkedIn Alerts** — Scrapes jobs from LinkedIn saved alert subscriptions.
3. **Email Alerts** — Parses LinkedIn job alert `.eml` files saved locally, visits each job page, and scores them.
4. **Gmail Alerts** — Auto-fetches LinkedIn job alert emails from a Gmail inbox via IMAP, parses job URLs, scrapes and scores them. No manual download needed.
5. **Rescore** — Re-evaluates all existing jobs without re-scraping. Useful after updating your profile or scoring preferences.
6. **Cover Letters** — Generates personalized cover letters for jobs scoring 5+.
7. **Auto-Apply** — Automates LinkedIn Easy Apply submissions via Playwright.

## Dashboard Features

- **Non-blocking pipeline** — runs in a floating bottom bar with stop button; browse jobs, apply, and manage your profile while it runs.
- **Search** — search jobs by company name or title across all tabs.
- **Platform filter** — filter by LinkedIn, Greenhouse, Lever, or Indeed.
- **Score filter** — filter jobs by exact score (5, 6, 7, 8, 9).
- **Mark Applied / Dismiss** — mark jobs as applied (tracks auto vs manual) or dismiss expired postings. Dismissed jobs are never re-scraped.
- **Cover Letters tab** — dedicated full-page view with search, split-panel layout, and copy-to-clipboard.
- **Per-job cover letter** — generate or regenerate from the job detail modal with inline copy icon.
- **Job descriptions** — rendered HTML descriptions with proper formatting (headings, lists, links).
- **Candidate Profile editor** — edit skills, preferences, deal-breakers, compensation (hamburger menu). Upload a resume (PDF) to auto-generate a profile using LLM.
- **Form Answers manager** — view/edit rule-based answers, browse Q&A logs from auto-apply runs (hamburger menu).
- **New badge** — jobs scraped within the last 24 hours are marked "New" and sorted to the top.
- **Posted date** — shows when the job was posted (relative format: "2d ago", "1w ago").

## Tech Stack

- **Language:** TypeScript (full-stack)
- **Monorepo:** npm workspaces
- **Scraping:** Playwright
- **LLM:** Ollama (dev) / Anthropic Claude API (prod) — auto-switches based on `NODE_ENV`
- **Backend:** NestJS
- **Frontend:** React 18, Vite
- **Database:** MongoDB (Mongoose ODM)
- **Email:** Gmail IMAP (imapflow)
- **Scheduling:** macOS launchd

## Design Decisions

### Environment-based LLM switching

A unified `llmChat()` function in `@job-agent/shared` routes to the right provider based on `NODE_ENV`:
- **Development** (default) — uses Ollama (llama3, local inference). Zero API cost.
- **Production** (`NODE_ENV=production`) — uses Anthropic Claude API (claude-sonnet-4-6). Higher quality.

Both clients are lazy-initialized singletons shared across all packages.

### Two-layer filtering

1. **Fast filter (zero LLM cost)** — deal-breaker rules (salary floor, employment type, pure frontend detection) and keyword rejection (wrong stack: Java, .NET, Ruby, PHP, Flutter). Full stack and AI/agent roles pass through.
2. **LLM scoring** — only jobs surviving layer 1 are sent to the LLM. Each job gets a 1-10 score, matched/missing skills, and a reason. The scorer receives the full candidate skill profile to avoid false "missing skills".

### Three-layer deduplication

Jobs are deduplicated by ID, company+title, and URL — across all sources and all previous runs. Applied, rejected, and dismissed jobs are never re-scraped.

### MongoDB storage

Five collections: `jobs`, `coverletters`, `users`, `questionanswers`, `profileanswers`. The shared package provides Mongoose schemas and a connection module used by both the API and scraper scripts.

### Concurrency

LLM scoring runs in batches of 2 (`LLM_CONCURRENCY = 2`) with `Promise.all()`. Results are persisted after each batch. Retry with exponential backoff on errors. Scraping is sequential per source to avoid bot detection.

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
- MongoDB (local or Docker)
- Ollama (for dev mode — local or remote machine)

### Install

```bash
npm install
```

### Candidate Profile

Upload a resume (PDF) through the UI to auto-generate a profile, or create one manually:

```bash
cp packages/scraper/profile/candidate.example.json packages/scraper/profile/candidate.json
```

### Environment

Create a `.env` file at the root:

```
ANTHROPIC_API_KEY=your-key
OLLAMA_BASE_URL=http://localhost:11434/v1
MONGO_URI=mongodb://localhost:27017/job-tracker
API_PORT=3001
GMAIL_EMAIL=your-job-alerts@gmail.com
GMAIL_APP_PASSWORD=your-app-password
```

For Gmail alerts, generate an App Password at https://myaccount.google.com/apppasswords.

### Migrate existing data (if upgrading from file-based storage)

```bash
npm run migrate
```

### Run

```bash
# Dev mode (Ollama)
npm run api                     # Backend on port 3001
npm run ui                      # Frontend on port 5173

# Production mode (Claude API)
npm run api:prod                # Backend with Anthropic

# Pipeline phases
npm run scraper                 # Scrape + score (all platforms)
npm run scraper:alerts          # LinkedIn alerts
npm run scraper:email-alerts    # Email alerts (.eml files)
npm run scraper:gmail-alerts    # Gmail alerts (auto-fetch)
npm run scraper:rescore         # Re-evaluate scored jobs
npm run scraper:phase3          # Generate cover letters
npm run scraper:phase4          # Auto-apply (LinkedIn Easy Apply)
```

### Gmail Alerts

1. Forward LinkedIn job alert emails to your dedicated Gmail (e.g., `jobhunt2k26@gmail.com`)
2. Set `GMAIL_EMAIL` and `GMAIL_APP_PASSWORD` in `.env`
3. Run "Gmail Alerts" from the pipeline UI

The fetcher reads all emails from the last 7 days, extracts LinkedIn job URLs, scrapes details, and scores them.

### Email Alerts (manual)

1. Download a LinkedIn alert email as `.eml` (Gmail → Show original → Download)
2. Drop into `packages/scraper/data/email-alerts/`
3. Run "Email Alerts" from the pipeline UI

### Scheduling

```bash
# Enable (12am + 12pm daily)
launchctl load ~/Library/LaunchAgents/com.jobagent.pipeline.plist

# Disable
launchctl unload ~/Library/LaunchAgents/com.jobagent.pipeline.plist

# Check status
launchctl list | grep jobagent
```

### Lint & Format

```bash
npm run lint
npm run format
```
