# Job Agent Monorepo

> **This project was developed for personal use.**

An AI-powered job hunting automation platform that scrapes job listings from multiple platforms, scores them for fit, generates tailored cover letters, pre-scrapes application forms for review, and automates LinkedIn Easy Apply & Greenhouse job applications with intelligent form filling — all from a single monorepo.

## Architecture

```
packages/
├── shared/    — Mongoose schemas, DB connection, unified LLM client (3 providers)
├── scraper/   — Job scraping, scoring, cover letters, form pre-scraping, auto-apply
├── api/       — NestJS REST API
└── ui/        — React + Vite dashboard
```

## Pipeline

Selectable individually or together from the dashboard:

| Phase              | What it does                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scrape & Score** | Scrapes LinkedIn (8 queries + alerts), Greenhouse (API), Lever (API). Two-layer filtering + LLM scoring. Jobs scoring 7+ get forms pre-scraped automatically. |
| **Gmail Alerts**   | Polls Gmail for LinkedIn alert emails via IMAP. Parses job URLs, scrapes + scores per alert keyword for real-time results.                                    |
| **Rescore**        | Re-evaluates all existing jobs with updated profile/rules.                                                                                                    |
| **Auto Apply**     | Opens Greenhouse pages, fills ALL fields from pre-scraped answers instantly (zero LLM calls). Falls back to profile + rules for fields not pre-scraped.       |

## Prepare Tab — Pre-Scrape & Review Before Apply

The core workflow: review every answer BEFORE the bot fills the form.

### How it works

1. **During scraping** — jobs scoring 7+ automatically get their Greenhouse application forms pre-scraped (parallel, 5 at a time)
2. **Form fields extracted** — every input, dropdown, radio, checkbox, textarea captured with their labels, types, and available options
3. **Auto-answered** — profile data, saved rules, and smart matching fill answers. Priority: saved rules → profile defaults → LLM (only during pre-scrape, never during auto-apply)
4. **Shown in Prepare tab** — expandable table showing all fields with answers, options as clickable chips, required fields marked with red `*`
5. **Review & edit** — click Edit on any field to change the answer. Edits saved as rules for all future applications
6. **Auto Apply** — one click fills the Greenhouse form instantly using reviewed answers. Zero LLM calls, zero surprises

### Prepare tab features

- **Status indicators** — Ready (all fields answered) / Needs Review (has unknowns)
- **"X Ready — Click to Apply"** button — batch auto-apply all ready jobs
- **Select to Apply** mode — checkboxes for selecting specific jobs
- **Per-job Auto Apply** button — apply to individual jobs
- **Dismiss** (×) button — remove jobs you don't want to apply to
- **Required fields** — detected from `*` in labels + known required patterns (name, email, sponsorship, etc.)
- **Dropdown options visible** — shown as chips under each field so you can see all available choices
- **Multi-select checkboxes** — for "select all that apply" questions, shown as checkable list in edit mode
- **Cover letter preview** — shown in expanded view, auto-generated during pre-scrape

### What gets filtered out

- **Phone country code pickers** — detected by `+\d+` in options, skipped automatically
- **Phone radio groups** — garbage `["Country*", "Phone*"]` fields filtered
- **Cover Letter file field** — hidden from review (auto-generated separately)

## Auto Apply (Greenhouse)

The form filler during auto-apply:

1. **Loads pre-scraped answers** — from `applicationFields` collection (reviewed in Prepare tab)
2. **Resolves URL** — converts company career page URLs to direct `job-boards.greenhouse.io` URLs, handles iframes
3. **Clicks "Autofill with MyGreenhouse"** if available
4. **Uploads resume + cover letter** — cover letter loaded from pre-scraped data or DB, no LLM regeneration
5. **Fills all fields instantly** — pre-scraped answers filled via `input.fill()` (not character-by-character typing)
6. **Dropdown selection** — scoped to each dropdown's `aria-controls` menu (avoids phone picker interference), type-to-filter + click
7. **Two-pass combobox scan** — scrolls form, scans twice to catch lazy-loaded dropdowns below the fold
8. **Fill-by-ID fallback** — any pre-scraped combobox field missed by the main handler is found directly by its element ID and filled
9. **Checkbox support** — "select all that apply" questions handled with multi-select
10. **Auto-submit** — clicks Submit automatically after filling, detects success page, marks job as applied
11. **Applied jobs removed** — jobs successfully applied are removed from the Prepare tab automatically
12. **Zero LLM calls** — all answers come from pre-scraped data, saved rules, or profile. Never guesses
13. **Separate LinkedIn sessions** — scraping uses test account (`linkedin-session.json`), auto-apply uses real account (`linkedin-session-apply.json`)
14. **Page close detection** — exits cleanly when you close the browser tab or window
15. **Session persistence** — saves/loads Greenhouse + LinkedIn cookies between jobs

### Answer Priority (consistent everywhere)

| Priority | Source               | Description                                                                |
| -------- | -------------------- | -------------------------------------------------------------------------- |
| 1        | **Pre-scraped**      | Reviewed in Prepare tab, stored in `applicationFields`                     |
| 2        | **Saved rules**      | User corrections from Form Answers, Prepare tab edits, previous form fills |
| 3        | **Profile defaults** | Hardcoded mappings (name, email, demographics, work auth)                  |
| 4        | **LLM**              | Only during pre-scraping phase, never during auto-apply                    |

### Smart Option Matching (`smartMatchOption`)

Deterministic matching without LLM for common field types:

| Answer              | Dropdown Options                                           | Match Method                             |
| ------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| `"United States"`   | `"US"`, `"USA"`, `"United States of America"`              | Country aliases                          |
| `"Yes"` / `"No"`    | `"Yes, I am authorized..."`, `"No, I will not require..."` | Starts-with + positive/negative phrasing |
| `"Female"`          | `"Female"`, `"Woman"`, `"Female (she/her)"`                | Gender aliases (Female ↔ Woman)          |
| `"Asian"`           | `"South Asian (inclusive of...)"`, `"Asian"`               | Prefers South Asian, falls back to Asian |
| `"Heterosexual"`    | `"Straight"`, `"Straight/Heterosexual"`, `"Cisgender"`     | Sexual orientation aliases               |
| `"No"` (veteran)    | `"I am not a protected veteran"`                           | Label-aware negative matching            |
| `"No"` (disability) | `"No, I do not have a disability..."`                      | Label-aware negative matching            |

### Profile-Based Auto-Answers

Questions answered automatically from candidate profile:

- **Identity** — name, email, phone, LinkedIn, GitHub
- **Work authorization** — "Yes" (authorized), "No" (no sponsorship needed)
- **Location** — city/state from profile, "United States" for country
- **Demographics** — Female, Asian/South Asian, She/Her, Heterosexual/Cisgender, not veteran, no disability, not Hispanic
- **Employment history** — "Have you worked for X?" checks resume work history against company name
- **Consent/acknowledgment** — "By checking this box, I consent..." → always Yes
- **Hybrid/remote/onsite** — Yes to all work arrangement questions
- **Salary** — from profile compensation preferences
- **Education** — degree, school, major, graduation year from profile
- **How did you hear** — LinkedIn
- **Optional links** — Twitter, Portfolio, Other Links left empty (won't guess)

### Form Answer Learning

- Answers you edit in Prepare tab → saved as rules for all future applications
- LLM answers during pre-scraping are NOT auto-saved as rules (prevents garbage)
- Form captures during auto-apply filter out: phone codes, country names, numeric IDs, short labels
- View and edit all saved rules in **Hamburger menu → Saved Rules**

## Dashboard Features

- **Tabs:** Queue, Prepare, Applied, Accepted, Rejected, Cover Letters
- **Filters:** Search (company/title), Platform (LinkedIn/Greenhouse/Lever), Score (5-9)
- **Select to Auto Apply** — checkboxes → select jobs → Auto Apply or Generate Cover Letters
- **Mark Applied / Dismiss** — with auto vs manual tracking
- **Status dropdown** on Applied tab — Waiting, Interviewing, Accepted, Declined, No Response
- **Cover Letters tab** — split-panel with search, inline copy, latest first
- **Cover letter section hidden** for rejected/declined jobs
- **New badge** — jobs scraped within 24h marked "New", sorted to top
- **Non-blocking pipeline** — floating bottom bar with logs, stop button
- **Hamburger menu:** Candidate Profile, Saved Rules (with add/edit/delete), Keywords, Pipeline
- **Compact layout** — full-width, minimal padding, maximizes space for job listings

## Tech Stack

- **Language:** TypeScript (full-stack)
- **Monorepo:** npm workspaces
- **Scraping:** Playwright (Chrome, non-headless for apply, headless for pre-scrape)
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

All consumers use `llmChat()` from `@job-agent/shared` — scoring, cover letters, form pre-answering, resume parsing all switch automatically.

## Design Decisions

### Pre-Scrape vs Real-Time Form Filling

**Problem:** LLM-based form filling during auto-apply was slow (5-30s per field), error-prone (wrong country, wrong gender), and not reviewable.

**Solution:** Pre-scrape forms during scoring → review in UI → auto-apply uses pre-verified answers instantly.

- Forms scraped headlessly in parallel (5 at a time) during phase 2 scoring
- Only for 7+ scored jobs (not all 200+ scraped jobs)
- Dropdown options captured by clicking each combobox and reading the menu
- Answers matched to options using `smartMatchOption` (deterministic, no LLM)
- All answers reviewable and editable in Prepare tab before applying

### Zero LLM During Auto-Apply

**Problem:** LLM guesses during form filling produced wrong answers (India instead of US, Male instead of Female) and added 10-30s per field.

**Solution:** Complete separation — LLM runs once during pre-scraping (offline), never during the time-sensitive browser fill.

- Pre-scraped answers, saved rules, and profile handle 100% of known fields
- Unknown fields left empty for user to fill manually (better than wrong LLM guess)
- Only exception: "why interested" textarea questions use cover letter as context

### Dropdown Menu Scoping

**Problem:** Greenhouse forms have a phone country code picker (`id="country"`) that's always in the DOM. Every `querySelectorAll('[role="option"]')` returned 246 phone code options instead of the actual dropdown's options.

**Solution:** Use `aria-controls` attribute to scope option reading to the correct menu.

- Each React Select combobox has `aria-controls="react-select-{id}-listbox"`
- Read options only from that specific listbox element
- Phone code pickers detected by `+\d+` pattern in options and skipped
- Two-pass combobox scan with scrolling catches lazy-loaded fields below the fold
- Fill-by-ID fallback finds any remaining unfilled pre-scraped combobox fields directly by element ID

### Auto-Submit

**Problem:** After filling the form, the bot waited silently for manual submission — requiring the user to review and click submit for every job.

**Solution:** Bot clicks Submit automatically after filling, then detects the success page.

- Captures form answers before submitting
- Clicks `button[type="submit"]` or `button:has-text("Submit Application")`
- Detects submission success (submit button gone + form gone + "thank you" text)
- Marks job as `applied` in both `jobs` and `applicationFields` collections
- Applied jobs automatically removed from the Prepare tab

### Separate LinkedIn Sessions

**Problem:** Using the same LinkedIn account for scraping and applying exposed the real account to rate limiting and bot detection during scraping.

**Solution:** Separate session files for scraping and applying.

- `linkedin-session.json` — test account for scraping (phase 2, Gmail alerts)
- `linkedin-session-apply.json` — real account for auto-apply (phase 4)
- Sessions saved automatically after each job
- Manual apply ("Apply" link in UI) uses default browser — always your real account

### Required Field Detection

**Problem:** Optional unknown fields (like "Other Links") made jobs show as "Needs Review" even when all required fields were answered.

**Solution:** Detect required fields from `*` in labels + known patterns, only count required unknowns.

- Labels keep `*` during scraping (not stripped until conversion step)
- `*` anywhere in label → required
- Known required patterns: name, email, phone, resume, sponsorship, visa, authorization, country, gender
- Unknown count only includes required non-file fields

### Cover Letter Generation

- 3 gold-standard Claude-generated cover letters hardcoded as few-shot examples
- AI skills highlighted when job mentions AI/agents/LLM/prompt engineering
- Generated during pre-scrape, loaded from DB during auto-apply (no regeneration)
- Falls back to file upload if textarea not found

### Scoring

- Two-layer: fast filter (zero LLM cost) → LLM scoring (batches of 3)
- Per-source, per-company scoring for real-time UI updates
- Gmail alerts scored per alert keyword (not all at once)
- Staff-level roles not penalized for seniority
- Jobs outside US auto-rejected

### Deduplication

Three layers: ID, company+title, URL — across all sources and runs.

### Anti-Detection

- Full-screen Chrome with realistic fingerprint (plugins, hardware, geolocation, screen)
- `navigator.webdriver` set to `undefined`
- Session cookie persistence (LinkedIn + Greenhouse)
- Browser disconnect detection — clean exit when user closes tab or window

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
npm run scraper:gmail-alerts    # Gmail alerts
npm run scraper:rescore         # Re-evaluate scored jobs
npm run scraper:phase4          # Auto-apply
```

### Gmail Alerts

1. Forward LinkedIn job alert emails to your Gmail
2. Set `GMAIL_EMAIL` and `GMAIL_APP_PASSWORD` in `.env`
3. Run "Gmail Alerts" from the pipeline UI

### Rebuild Shared Package

After modifying `packages/shared/`:

```bash
npx tsc --project packages/shared/tsconfig.json
```

## Database Collections

| Collection          | Purpose                                        |
| ------------------- | ---------------------------------------------- |
| `jobs`              | All scraped jobs with scores, status, metadata |
| `coverletters`      | Generated cover letters linked to jobs         |
| `users`             | Candidate profile (one document)               |
| `profileanswers`    | Reusable form answer rules (question → answer) |
| `questionanswers`   | Per-job Q&A logs from auto-apply               |
| `applicationfields` | Pre-scraped form fields with answers per job   |
