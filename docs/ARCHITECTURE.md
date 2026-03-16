# Architecture

## Overview

IdeaRadar is a full-stack Next.js application following a local-first architecture. All data stays on your machine with zero external infrastructure beyond AI API calls.

```
┌──────────────────────────────────────────────────────┐
│                    Next.js App                        │
│  ┌───────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │  Frontend  │  │  API      │  │  Background      │  │
│  │  (React)   │  │  Routes   │  │  Scheduler       │  │
│  │           │──▶│           │  │  (node-cron)     │  │
│  └───────────┘  └─────┬─────┘  └────────┬─────────┘  │
│                       │                  │            │
│  ┌────────────────────┴──────────────────┴─────────┐  │
│  │              Core Business Logic                 │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │  │
│  │  │Collectors│ │ Analyzer │ │ Scoring Engine   │ │  │
│  │  │          │ │ (AI)     │ │                  │ │  │
│  │  └────┬─────┘ └────┬─────┘ └──────────────────┘ │  │
│  └───────┼────────────┼────────────────────────────┘  │
│          │            │                               │
│  ┌───────▼────────────▼────────────────────────────┐  │
│  │          SQLite (Drizzle ORM)                    │  │
│  │  ideas | trend_history | collection_logs         │  │
│  │  ai_cost_logs | settings                         │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
         │                        │
         ▼                        ▼
   External APIs             AI Providers
   (HN, PH, etc.)     (OpenRouter, OpenAI, etc.)
```

## Design Decisions

### Local-First with SQLite

SQLite was chosen over PostgreSQL/MySQL for several reasons:

- **Zero ops** - No database server to install, configure, or maintain
- **Single file** - Entire database is one file at `./data/idearadar.db`
- **WAL mode** - Write-Ahead Logging enables concurrent reads during writes
- **Sufficient scale** - Handles thousands of ideas without performance issues

The database connection uses a **lazy initialization pattern** via JavaScript `Proxy` to avoid build-time locking in Next.js multi-worker environments:

```typescript
// db/index.ts
export const db = new Proxy({} as DrizzleDB, {
  get(_target, prop, receiver) {
    const realDb = getDb();  // Initialize on first access
    const value = Reflect.get(realDb, prop, receiver);
    return typeof value === 'function' ? value.bind(realDb) : value;
  },
});
```

### Configurable AI Provider

The AI layer is designed with provider abstraction:

- All providers use the OpenAI-compatible chat completions API format
- Configuration stored in the `settings` database table (runtime-changeable)
- Falls back to environment variables when database settings are absent
- Supports: OpenRouter, OpenAI, Anthropic, Google, and any custom endpoint

### Two-Stage Analysis Pipeline

Ideas go through two distinct AI analysis phases:

1. **Screening** (cheap model, e.g., Claude Haiku) - Quick categorization, target user identification, innovation scoring
2. **Deep Analysis** (quality model, e.g., Claude Sonnet) - Pain point analysis, market assessment, competitor mapping, multi-dimensional scoring

This dual approach optimizes cost: only ideas that pass screening get expensive deep analysis.

### Scoring Architecture

The final score is a weighted composite of 5 dimensions:

| Dimension | Weight | Source |
|-----------|--------|--------|
| Trend | 30% | Source metrics (upvotes, comments) + recency |
| Demand | 25% | AI deep analysis |
| Competition | 20% | AI deep analysis |
| Feasibility | 15% | AI deep analysis |
| Growth | 10% | AI deep analysis |

Scores map to ranks: S (>=85), A (>=70), B (>=55), C (>=40), D (<40).

## Data Flow

### Collection Flow

```
Scheduler/Manual Trigger
    │
    ▼
collectAll()
    │
    ├── collectHackerNews()  ──▶  HN Firebase API
    ├── collectProductHunt() ──▶  PH GraphQL API
    └── (future sources)
    │
    ▼
Deduplicate by URL
    │
    ▼
Insert new ideas into SQLite
    │
    ▼
rankAllIdeas()  (recalculate trend scores)
```

### Analysis Flow

```
Scheduler/Manual Trigger
    │
    ▼
analyzeUnanalyzed()
    │
    ├── batchScreen()        ──▶  Screening Model (cheap)
    │   └── screenIdea()          - Category
    │                              - Target Users
    │                              - Innovation Score
    │
    └── deepAnalyzeIdea()    ──▶  Analysis Model (quality)
        └── Updates:               - Pain Point
            - demandScore           - Market Size
            - competitionScore      - Core Features
            - feasibilityScore      - Competitors
            - growthScore           - Recommendation
    │
    ▼
rankAllIdeas()  (recalculate final scores + ranks)
```

## Database Schema

### Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `ideas` | Core idea data + AI analysis + scores | id, title, url, source, finalScore, rankCategory |
| `trend_history` | Historical score snapshots | ideaId, date, score |
| `collection_logs` | Data collection audit trail | source, status, itemsCount |
| `ai_cost_logs` | AI API usage tracking | model, inputTokens, outputTokens, costUsd |
| `settings` | Key-value configuration store | key, value |

### Indexes

- `idx_ideas_source` - Filter by data source
- `idx_ideas_final_score` - Sort by score (DESC)
- `idx_ideas_discovered_at` - Sort by discovery time (DESC)
- `idx_ideas_category` - Filter by category
- `idx_trend_history_idea_id` - Trend lookups
- `idx_ai_cost_logs_created_at` - Cost analysis by time

## Frontend Architecture

The frontend follows Next.js App Router conventions:

- **Server-rendered layout** with client-side interactive pages
- **Component hierarchy**: Pages > Feature Components > UI Primitives
- **State management**: Local `useState` per page (no global state library needed)
- **API communication**: Direct `fetch()` to Next.js API routes

### Page Structure

| Route | Component | Description |
|-------|-----------|------------|
| `/` | `DashboardPage` | KPI cards, quick actions, top ideas |
| `/ideas` | `IdeasPage` | Filterable/sortable ideas table with pagination |
| `/ideas/[id]` | `IdeaDetailPage` | Radar chart, trend line, full analysis details |
| `/settings` | `SettingsPage` | AI models, data sources, scheduler config |

## Error Handling

- **API routes**: Try/catch with structured JSON error responses
- **AI calls**: Exponential backoff retry (3 attempts, 1s/2s/4s delays)
- **Collectors**: Per-source error isolation; one source failing doesn't block others
- **Database**: WAL mode + busy_timeout prevents locking under concurrent access
