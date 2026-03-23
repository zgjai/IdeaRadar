# IdeaRadar

AI-powered business opportunity verification engine. Automatically collects product ideas from multiple internet sources, validates them through SEO data, competitor analysis, and monetization assessment, then produces actionable opportunity scores to help indie developers make data-driven build-or-skip decisions.

## Features

### V2.1 -- xhs-needs-mining Methodology Integration
- **Five-Dimensional Market Validation** -- Independent demand/pain/pay/buildFit/competitionRisk scoring (0-10)
- **Four-Route Evidence Framework** -- Help-seeking, alternative-seeking, complaints, transaction intent signal detection
- **Counter-Evidence & Kill Criteria** -- Devil's advocate analysis with quantifiable stop conditions
- **Soft-Gate Verification** -- validated/conditional/needs_evidence/skip status with confidence levels

### V2 -- Business Opportunity Verification
- **SEO-Validated Scoring** -- Traffic(40%) x Monetization(35%) x Execution(25%) weighted geometric mean
- **4-Stage AI Pipeline** -- SEO Analysis -> Competitor Analysis -> Monetization Analysis -> Recommendation
- **Keyword Intelligence** -- Automated keyword extraction, expansion, and SEO metrics enrichment
- **Competitor Discovery** -- SERP-based competitor detection with monetization signal analysis
- **Site Research** -- AI-powered 11-dimension website analysis with multi-strategy content extraction
- **Budget Control** -- Daily/monthly/per-API spending limits with real-time monitoring
- **Multi-Layer Cache** -- Memory LRU + SQLite cache to minimize API costs

### V1 -- Idea Discovery Foundation
- **Multi-Source Data Collection** -- Hacker News, Product Hunt, Google Trends (extensible)
- **Two-Stage AI Analysis** -- Fast screening + deep analysis with configurable models
- **5-Dimension Scoring** -- Trend, Demand, Competition, Feasibility, Growth
- **S/A/B/C/D Ranking** -- Clear quality tiers for quick decision-making
- **Cost Tracking** -- Monitor AI API usage and spending
- **Local-First** -- SQLite database, zero external infrastructure required
- **Fully Configurable** -- AI models, data sources, and schedules via web UI

## Quick Start

### Prerequisites

- Node.js >= 18
- npm or pnpm

### Installation

```bash
git clone git@github.com:zgjai/IdeaRadar.git
cd IdeaRadar
npm install
```

### Configuration

Create a `.env` file in the project root:

```env
# AI Provider (at least one API key is required for analysis)
AI_GATEWAY_API_KEY=your_api_key_here
AI_GATEWAY_URL=https://api.openrouter.ai/api/v1  # Base URL or full endpoint (auto-detected)

# Optional: override default models
AI_SCREENING_MODEL=anthropic/claude-haiku-4.5
AI_ANALYSIS_MODEL=anthropic/claude-sonnet-4.6

# Optional: SEO APIs (V2 - for keyword and competitor analysis)
DATAFORSEO_LOGIN=your_dataforseo_login
DATAFORSEO_PASSWORD=your_dataforseo_password
SERPAPI_KEY=your_serpapi_key

# Optional: Reddit OAuth2 (required for Reddit collection — anonymous API blocked from servers)
# Create an app at https://www.reddit.com/prefs/apps (type: script)
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret

# Optional: Product Hunt API
PRODUCTHUNT_TOKEN=your_producthunt_token

# Optional: Scheduler
SCHEDULER_AUTO_START=false
COLLECT_INTERVAL=0 */6 * * *
ANALYZE_INTERVAL=0 * * * *

# Optional: Database path (defaults to ./data/idearadar.db)
DATABASE_URL=./data/idearadar.db
```

### Run

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

### Usage Workflow

1. **Collect** -- Click "Collect Data" on Dashboard or wait for scheduled collection
2. **Screen** -- Click "Run Analysis" to trigger V1 AI screening on collected ideas
3. **V2 Deep Analysis** -- Click "V2 Deep Analysis" for full SEO + competitor + monetization pipeline
4. **Review** -- Browse Ideas list sorted by opportunity score, filter by rank/source/category
5. **Research** -- Use Site Research to analyze any website with 11-dimension AI analysis
6. **Keywords** -- Explore keyword data in the Keywords Browser page
7. **Dive Deep** -- Click into individual ideas for V2 opportunity scores, verification status, and counter-evidence

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Database | SQLite (better-sqlite3) |
| ORM | Drizzle ORM |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Icons | Lucide React |
| Toasts | Sonner |
| Content Extraction | @mozilla/readability, linkedom, turndown |
| AI Integration | OpenAI-compatible API (OpenRouter, OpenAI, Anthropic, Google, custom) |
| Scheduler | node-cron |

## Project Structure

```
src/
  app/                          # Next.js App Router pages
    api/                        # REST API endpoints
      ideas/                    # Ideas CRUD
      stats/                    # Dashboard statistics
      collect/                  # Trigger data collection
      analyze/                  # V1 AI analysis
      analyze-v2/               # V2 full pipeline analysis
      keywords/                 # Keyword browsing API
      budget/                   # Budget monitoring API
      settings/                 # Configuration CRUD
      site-research/            # Site research (crawl + analyze)
        [id]/                   # Site research detail
    ideas/                      # Ideas list & detail pages
    keywords/                   # Keyword browser page
    research/                   # Site research page
    settings/                   # Settings page
  components/                   # React components
    ui/                         # Reusable UI primitives
    dashboard/                  # Dashboard widgets
    ideas/                      # Ideas page components
    charts/                     # Recharts visualizations
      score-radar.tsx           # V1 5-dimension radar
      five-dim-radar.tsx        # Five-dimensional market validation radar
  lib/                          # Core business logic
    ai/                         # AI provider, analyzer, prompts, V2 pipeline
    api/                        # External API clients (DataForSEO, SerpAPI)
    budget/                     # Budget management and enforcement
    cache/                      # Multi-layer cache (Memory LRU + SQLite)
    collectors/                 # Data source collectors
    competitors/                # Competitor discovery and monetization signals
    keywords/                   # Keyword extraction, expansion, enrichment
    research/                   # Website crawler + AI site analyzer
    scoring/                    # Scoring engine (V1 + V2)
    scheduler/                  # Cron job scheduler
    db/                         # Database schema & connection
    config.ts                   # Environment configuration
  types/                        # TypeScript type declarations
data/                           # SQLite database files (gitignored)
docs/                           # Documentation
```

## Documentation

| Document | Description |
|----------|------------|
| [Architecture](docs/ARCHITECTURE.md) | System architecture, data flow, design decisions, security |
| [Product Design](docs/PRODUCT.md) | Product vision, features, scoring methodology, roadmap |
| [API Reference](docs/API.md) | Complete REST API documentation with examples |
| [AI Engine](docs/AI-ENGINE.md) | AI pipeline, xhs methodology, prompt engineering |
| [Data Sources](docs/DATA-SOURCES.md) | Data source integration and collector development |
| [Development Guide](docs/DEVELOPMENT.md) | Setup, conventions, and contribution guidelines |
| [Changelog](docs/CHANGELOG.md) | Version history and release notes |

## License

MIT
