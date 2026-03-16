# IdeaRadar

AI-powered product idea discovery and analysis platform. Automatically collects product ideas from multiple internet sources, analyzes them with configurable AI models, and outputs reliability rankings to help indie developers identify high-potential opportunities.

## Features

- **Multi-Source Data Collection** - Hacker News, Product Hunt, Google Trends (extensible)
- **Two-Stage AI Analysis** - Fast screening + deep analysis with configurable models
- **5-Dimension Scoring** - Trend, Demand, Competition, Feasibility, Growth
- **S/A/B/C/D Ranking** - Clear quality tiers for quick decision-making
- **Cost Tracking** - Monitor AI API usage and spending
- **Local-First** - SQLite database, zero external infrastructure required
- **Fully Configurable** - AI models, data sources, and schedules via web UI

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
AI_GATEWAY_URL=https://api.openrouter.ai/api/v1

# Optional: override default models
AI_SCREENING_MODEL=anthropic/claude-haiku-4.5
AI_ANALYSIS_MODEL=anthropic/claude-sonnet-4.6

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

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Usage Workflow

1. **Collect** - Click "Collect Data" on Dashboard or wait for scheduled collection
2. **Analyze** - Click "Run Analysis" to trigger AI analysis on collected ideas
3. **Review** - Browse Ideas list sorted by score, filter by rank/source/category
4. **Dive Deep** - Click into individual ideas for radar charts and detailed breakdowns

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | SQLite (better-sqlite3) |
| ORM | Drizzle ORM |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Icons | Lucide React |
| AI Integration | OpenAI-compatible API (OpenRouter, OpenAI, Anthropic, Google, custom) |
| Scheduler | node-cron |

## Project Structure

```
src/
  app/                      # Next.js App Router pages
    api/                    # REST API endpoints
      ideas/                # Ideas CRUD
      stats/                # Dashboard statistics
      collect/              # Trigger data collection
      analyze/              # Trigger AI analysis
      settings/             # Configuration CRUD
    ideas/                  # Ideas list & detail pages
    settings/               # Settings page
  components/               # React components
    ui/                     # Reusable UI primitives
    dashboard/              # Dashboard widgets
    ideas/                  # Ideas page components
    charts/                 # Recharts visualizations
  lib/                      # Core business logic
    ai/                     # AI provider, analyzer, prompts
    collectors/             # Data source collectors
    scoring/                # Scoring engine
    scheduler/              # Cron job scheduler
    db/                     # Database schema & connection
    config.ts               # Environment configuration
data/                       # SQLite database files (gitignored)
docs/                       # Documentation
```

## Documentation

| Document | Description |
|----------|------------|
| [Architecture](docs/ARCHITECTURE.md) | System architecture, data flow, and design decisions |
| [Product Design](docs/PRODUCT.md) | Product vision, features, and scoring methodology |
| [API Reference](docs/API.md) | Complete REST API documentation |
| [AI Engine](docs/AI-ENGINE.md) | AI model configuration and analysis pipeline |
| [Data Sources](docs/DATA-SOURCES.md) | Data source integration and collector development |
| [Development Guide](docs/DEVELOPMENT.md) | Setup, conventions, and contribution guidelines |

## License

MIT
