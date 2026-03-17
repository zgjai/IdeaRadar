# Architecture

## Overview

IdeaRadar is a full-stack Next.js application following a local-first architecture. All data stays on your machine with zero external infrastructure beyond AI and SEO API calls.

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Next.js App                                │
│  ┌───────────┐  ┌───────────┐  ┌──────────────────┐                │
│  │  Frontend  │  │  API      │  │  Background      │                │
│  │  (React)   │  │  Routes   │  │  Scheduler       │                │
│  │           │──▶│           │  │  (node-cron)     │                │
│  └───────────┘  └─────┬─────┘  └────────┬─────────┘                │
│                       │                  │                          │
│  ┌────────────────────┴──────────────────┴───────────────────────┐  │
│  │                  Core Business Logic                           │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌───────────────┐  │  │
│  │  │Collectors│ │ V1 AI    │ │ V2 Pipeline│ │ Scoring Engine│  │  │
│  │  │          │ │ Analyzer │ │ (4-stage)  │ │ (V1+V2)      │  │  │
│  │  └────┬─────┘ └────┬─────┘ └──────┬─────┘ └───────────────┘  │  │
│  │       │             │              │                           │  │
│  │  ┌────┘    ┌────────┘    ┌─────────┘                          │  │
│  │  │         │             │                                    │  │
│  │  │    ┌────▼──────┐ ┌────▼───────┐ ┌────────────────────┐    │  │
│  │  │    │ Keywords  │ │ Competitor │ │ Budget Manager     │    │  │
│  │  │    │ Processor │ │ Analyzer   │ │ + Multi-Layer Cache│    │  │
│  │  │    └───────────┘ └────────────┘ └────────────────────┘    │  │
│  └──┼────────────────────────────────────────────────────────────┘  │
│     │                                                               │
│  ┌──▼───────────────────────────────────────────────────────────┐   │
│  │              SQLite (Drizzle ORM) - 13 Tables                 │   │
│  │  ideas | trend_history | collection_logs | settings           │   │
│  │  keywords | keyword_clusters | serp_snapshots | competitors   │   │
│  │  monetization_signals | idea_keywords | api_cache             │   │
│  │  ai_cost_logs | api_cost_logs                                 │   │
│  └───────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
         │                   │                    │
         ▼                   ▼                    ▼
   Data Sources         AI Providers         SEO APIs
   (HN, PH, etc.)  (OpenRouter, etc.)  (DataForSEO, SerpAPI)
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

### Two-Stage Analysis Pipeline (V1)

Ideas go through two distinct AI analysis phases:

1. **Screening** (cheap model, e.g., Claude Haiku) - Quick categorization, target user identification, innovation scoring
2. **Deep Analysis** (quality model, e.g., Claude Sonnet) - Pain point analysis, market assessment, competitor mapping, multi-dimensional scoring

This dual approach optimizes cost: only ideas that pass screening get expensive deep analysis.

### V2 Analysis Pipeline (4-Stage)

V2 adds a comprehensive SEO-driven verification pipeline on top of V1:

1. **Keyword Extraction + SEO Enrichment** - Extract seed keywords, expand via DataForSEO, enrich with search volume/difficulty/CPC
2. **Competitor Discovery** - SERP analysis to identify real competitors from search results
3. **Monetization Signal Detection** - Analyze competitor domains for pricing pages, ads, affiliate indicators
4. **AI 4-Stage Analysis** - SEO Analysis -> Competitor Analysis -> Monetization Analysis -> Actionable Recommendation

### Scoring Architecture

**V1 Score** - Weighted additive of 5 dimensions:

| Dimension | Weight | Source |
|-----------|--------|--------|
| Trend | 30% | Source metrics (upvotes, comments) + recency |
| Demand | 25% | AI deep analysis |
| Competition | 20% | AI deep analysis |
| Feasibility | 15% | AI deep analysis |
| Growth | 10% | AI deep analysis |

**V2 Opportunity Score** - Weighted geometric mean (multiplication model):

| Dimension | Weight | Source |
|-----------|--------|--------|
| Traffic | 40% | SEO keyword analysis (volume, difficulty, competition) |
| Monetization | 35% | Competitor monetization signals + AI assessment |
| Execution | 25% | AI evaluation of MVP feasibility |

Formula: `Score = (Traffic/100)^0.4 × (Monetization/100)^0.35 × (Execution/100)^0.25 × 100`

The multiplication model means a zero in any dimension produces a low overall score -- all three factors must be viable.

Scores map to ranks: S (>=85), A (>=70), B (>=55), C (>=40), D (<40). V2 opportunityScore is used for ranking when available, with V1 finalScore as fallback.

### Multi-Layer Cache

To minimize SEO API costs, a 3-layer cache strategy is used:

1. **Memory LRU** (5-minute TTL) - Fast in-process cache for hot data
2. **SQLite `api_cache` table** (7-30 day TTL) - Persistent cross-restart cache
3. **API Call** - Only when both cache layers miss

TTL by data type: keywords 30d, SERP 7d, traffic 14d, AI analysis 7d.

### Budget Management

Hard spending limits enforced before every API call:

- **Daily limit** (default: $5/day)
- **Monthly limit** (default: $100/month)
- **Per-API limits** (DataForSEO: $30/month, SerpAPI: $30/month, AI: $50/month)

The `withBudgetCheck()` wrapper automatically blocks API calls when limits are exceeded.

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

### V1 Analysis Flow

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

### V2 Analysis Flow

```
POST /api/analyze-v2 (single or batch)
    │
    ▼
Step 1: processIdeaKeywords()
    ├── extractSeedKeywords()      (from title/category)
    ├── expandKeywords()           (via DataForSEO API)
    ├── cleanKeywords()            (filter stop words)
    ├── enrichKeywords()           (fetch SEO metrics: volume, difficulty, CPC)
    └── saveKeywords() + linkToIdea()
    │
    ▼
Step 2: discoverCompetitors()
    ├── fetchSerpForKeyword()      (DataForSEO or SerpAPI)
    ├── Filter generic domains     (exclude Google, Wikipedia, etc.)
    └── Save to competitors table
    │
    ▼
Step 3: detectMonetizationSignals()
    └── Analyze top 10 competitors for pricing/ads/affiliate signals
    │
    ▼
Step 4: runV2Analysis()  (4-stage AI pipeline)
    ├── SEO Analysis               ──▶ trafficScore
    ├── Competitor Analysis         ──▶ competitionIntensity
    ├── Monetization Analysis       ──▶ monetizationScore
    └── Recommendation              ──▶ verdict (strong_go/go/cautious/skip)
    │
    ▼
Step 5: updateIdeaScore()
    └── Calculate opportunityScore (weighted geometric mean)
```

## Database Schema

### Core Tables (V1)

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `ideas` | Core idea data + AI analysis + V1/V2 scores | id, title, url, source, status, finalScore, opportunityScore, rankCategory |
| `trend_history` | Historical score snapshots | ideaId, date, score |
| `collection_logs` | Data collection audit trail | source, status, itemsCount |
| `ai_cost_logs` | AI API usage tracking | model, inputTokens, outputTokens, costUsd |
| `settings` | Key-value configuration store | key, value |

### V2 Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `keywords` | SEO keyword data | keyword, searchVolume, difficulty, cpc |
| `keyword_clusters` | Keyword groupings | name, parentId |
| `serp_snapshots` | SERP result snapshots | keyword, results (JSON), serpFeatures |
| `competitors` | Discovered competitor domains | domain, ideaId, trafficEstimate |
| `monetization_signals` | Competitor monetization indicators | domain, signalType, details |
| `idea_keywords` | Many-to-many idea<->keyword links | ideaId, keywordId, relevanceScore |
| `api_cache` | Multi-layer cache storage | cacheKey, data, expiresAt |
| `api_cost_logs` | Per-API cost tracking (SEO APIs) | apiName, endpoint, costUsd |

### V2 Fields on `ideas` Table

| Field Group | Fields |
|-------------|--------|
| Lifecycle | status (discovered/screening/seo_validated/analyzed/actionable/archived) |
| V2 Scores | trafficScore, monetizationScore, executionScore, opportunityScore |
| SEO Data | primaryKeyword, targetSearchVolume, targetKeywordDifficulty, targetCpc, estimatedTraffic, competitorCount |
| V2 AI Analysis | aiSeoAnalysis (JSON), aiCompetitorAnalysis (JSON), aiMonetizationAnalysis (JSON), aiRecommendation (JSON) |

### Indexes

V1 indexes:
- `idx_ideas_source`, `idx_ideas_final_score`, `idx_ideas_discovered_at`, `idx_ideas_category`
- `idx_trend_history_idea_id`, `idx_ai_cost_logs_created_at`

V2 indexes:
- `idx_ideas_status`, `idx_ideas_opportunity_score`, `idx_ideas_primary_keyword`
- `idx_keywords_keyword`, `idx_keywords_search_volume`, `idx_keywords_difficulty`
- `idx_serp_keyword`, `idx_competitors_idea_id`, `idx_competitors_domain`
- `idx_monetization_domain`, `idx_idea_keywords_idea_id`, `idx_idea_keywords_keyword_id`
- `idx_api_cache_key`, `idx_api_cache_expires`, `idx_api_cost_api_name`, `idx_api_cost_created_at`

## Frontend Architecture

The frontend follows Next.js App Router conventions:

- **Server-rendered layout** with client-side interactive pages
- **Component hierarchy**: Pages > Feature Components > UI Primitives
- **State management**: Local `useState` per page (no global state library needed)
- **API communication**: Direct `fetch()` to Next.js API routes

### Page Structure

| Route | Component | Description |
|-------|-----------|------------|
| `/` | `DashboardPage` | KPI cards, quick actions, V2 analysis trigger, API cost overview, top ideas |
| `/ideas` | `IdeasPage` | Filterable/sortable ideas table with pagination |
| `/ideas/[id]` | `IdeaDetailPage` | V2 opportunity scores, SEO data, AI recommendations, radar chart, trend line |
| `/keywords` | `KeywordsPage` | Keyword browser with search, sort, pagination, color-coded difficulty |
| `/settings` | `SettingsPage` | AI models, SEO APIs, data sources, scheduler config |

## Error Handling

- **API routes**: Try/catch with structured JSON error responses
- **AI calls**: Exponential backoff retry (3 attempts, 1s/2s/4s delays)
- **Collectors**: Per-source error isolation; one source failing doesn't block others
- **Database**: WAL mode + busy_timeout prevents locking under concurrent access
