# Architecture

## 1. Current Context

IdeaRadar is a full-stack Next.js application designed as a **business opportunity verification engine** for indie developers. It follows a local-first architecture: all data stays on your machine with zero external infrastructure beyond AI and SEO API calls. The system has evolved through three major phases:

- **V1** (idea discovery): multi-source collection + two-stage AI analysis + 5-dimension scoring
- **V2** (opportunity verification): SEO keyword validation + competitor discovery + monetization signals + 5-stage AI pipeline
- **V2.1** (methodology upgrade): xhs-needs-mining methodology integration with five-dimensional market validation, four-route evidence framework, counter-evidence analysis, and soft-gate verification
- **V2.2** (five-strategy methodology): five-strategy discovery classification (community pain / keyword opportunity / competitor gap / shadow clone / service productization), SOAP service-productization evaluation, shadow clone analysis, five-circle validation model, upgraded to 5-stage AI pipeline

## 2. System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Next.js App (App Router)                        │
│                                                                             │
│  ┌───────────┐  ┌───────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Frontend  │  │  API      │  │  Background      │  │  Site Research   │  │
│  │  (React)   │  │  Routes   │  │  Scheduler       │  │  Module          │  │
│  │           │──▶│           │  │  (node-cron)     │  │  (Crawl+Analyze) │  │
│  └───────────┘  └─────┬─────┘  └────────┬─────────┘  └────────┬─────────┘  │
│                       │                  │                      │            │
│  ┌────────────────────┴──────────────────┴──────────────────────┴────────┐  │
│  │                      Core Business Logic                              │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌───────────────┐          │  │
│  │  │Collectors│ │ V1 AI    │ │ V2 Pipeline│ │ Scoring Engine│          │  │
│  │  │          │ │ Analyzer │ │ (5-stage)  │ │ (V1+V2)      │          │  │
│  │  └────┬─────┘ └────┬─────┘ └──────┬─────┘ └───────────────┘          │  │
│  │       │             │              │                                   │  │
│  │  ┌────┘    ┌────────┘    ┌─────────┘                                  │  │
│  │  │         │             │                                            │  │
│  │  │    ┌────▼──────┐ ┌────▼───────┐ ┌────────────────────┐            │  │
│  │  │    │ Keywords  │ │ Competitor │ │ Budget Manager     │            │  │
│  │  │    │ Processor │ │ Analyzer   │ │ + Multi-Layer Cache│            │  │
│  │  │    └───────────┘ └────────────┘ └────────────────────┘            │  │
│  └──┼────────────────────────────────────────────────────────────────────┘  │
│     │                                                                       │
│  ┌──▼───────────────────────────────────────────────────────────────────┐   │
│  │              SQLite (Drizzle ORM) - 14 Tables                        │   │
│  │  ideas | trend_history | collection_logs | settings                  │   │
│  │  keywords | keyword_clusters | serp_snapshots | competitors          │   │
│  │  monetization_signals | idea_keywords | api_cache                    │   │
│  │  ai_cost_logs | api_cost_logs | site_researches                     │   │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
         │                   │                    │
         ▼                   ▼                    ▼
   Data Sources         AI Providers         SEO APIs
   (HN, PH, etc.)  (OpenRouter, etc.)  (DataForSEO, SerpAPI)
```

## 3. Design Decisions

### 3.1 Local-First with SQLite

SQLite was chosen over PostgreSQL/MySQL for several reasons:

- **Zero ops** -- No database server to install, configure, or maintain
- **Single file** -- Entire database is one file at `./data/idearadar.db`
- **WAL mode** -- Write-Ahead Logging enables concurrent reads during writes
- **Sufficient scale** -- Handles thousands of ideas without performance issues

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

**Trade-off:** SQLite limits the app to a single machine. If multi-user or team collaboration is needed in the future, a migration to PostgreSQL would be required. The Drizzle ORM abstraction makes this migration straightforward.

### 3.2 Configurable AI Provider

The AI layer is designed with provider abstraction:

- All providers use the OpenAI-compatible chat completions API format
- Configuration stored in the `settings` database table (runtime-changeable)
- Falls back to environment variables when database settings are absent
- Supports: OpenRouter, OpenAI, Anthropic, Google, and any custom endpoint

**Why:** Developers use different AI providers based on cost, availability, and preference. Runtime configuration avoids code changes and redeployments.

### 3.3 Two-Stage V1 Analysis Pipeline

Ideas go through two distinct AI analysis phases:

1. **Screening** (cheap model, e.g., Claude Haiku) -- Quick categorization, target user identification, innovation scoring
2. **Deep Analysis** (quality model, e.g., Claude Sonnet) -- Pain point analysis, market assessment, competitor mapping, multi-dimensional scoring

**Why:** This dual approach optimizes cost: only ideas that pass screening get expensive deep analysis. At typical usage, screening costs ~$0.002/idea vs ~$0.03/idea for deep analysis.

### 3.4 V2 Four-Stage AI Pipeline

V2 adds a comprehensive SEO-driven verification pipeline:

1. **Keyword Extraction + SEO Enrichment** -- Extract seed keywords, expand via DataForSEO, enrich with search volume/difficulty/CPC
2. **Competitor Discovery** -- SERP analysis to identify real competitors from search results
3. **Monetization Signal Detection** -- Analyze competitor domains for pricing pages, ads, affiliate indicators
4. **AI 4-Stage Analysis** -- SEO Analysis -> Competitor Analysis -> Monetization Analysis -> Actionable Recommendation

**Why:** V1 relied solely on AI judgment. V2 grounds verdicts in observable market data (search volume, competitor pricing, SERP landscape), making recommendations evidence-based rather than speculative.

### 3.5 Multiplication Scoring Model (V2)

V2 uses a weighted geometric mean instead of V1's additive model:

```
Score = (Traffic/100)^0.4 x (Monetization/100)^0.35 x (Execution/100)^0.25 x 100
```

**Why:** The multiplication model means a zero in any dimension produces a low overall score. An idea with great traffic potential but zero monetization path correctly scores low, preventing "false positive" recommendations.

### 3.6 Multi-Strategy Content Extraction (Site Research)

The site research crawler uses 5 extraction strategies in parallel, picking the best result:

1. **Mozilla Readability** -- Standard article extraction (preferred when sufficient)
2. **CSS Selector Probing** -- Targeted extraction using common content selectors
3. **JSON-LD Structured Data** -- Extract from schema.org markup
4. **Next.js `__NEXT_DATA__`** -- Extract from SSR-hydrated page props
5. **Full-page Fallback** -- Regex-based HTML stripping (last resort)

**Why:** No single extraction strategy works reliably across all websites. The multi-strategy approach (inspired by agent-fetch) maximizes content quality by running all strategies and selecting the winner based on content length and method preference.

### 3.7 xhs-needs-mining Methodology Integration

Analysis now incorporates methodologies from the xhs-needs-mining project:

- **Five-dimensional scoring** (demand/pain/pay/buildFit/competitionRisk, each 0-10)
- **Four-route evidence framework** (help_seeking/alternative_seeking/complaints/transaction_intent)
- **Counter-evidence with kill criteria** (devil's advocate analysis)
- **Soft-gate verification status** (validated/conditional/needs_evidence/skip)

**Why:** The xhs methodology provides rigorous, structured validation that forces honest assessment. Counter-evidence and kill criteria prevent confirmation bias. The four-route evidence framework ensures demand signals are verified from multiple angles.

### 3.8 Multi-Layer Cache

To minimize SEO API costs, a 3-layer cache strategy is used:

1. **Memory LRU** (5-minute TTL) -- Fast in-process cache for hot data
2. **SQLite `api_cache` table** (7-30 day TTL) -- Persistent cross-restart cache
3. **API Call** -- Only when both cache layers miss

TTL by data type: keywords 30d, SERP 7d, traffic 14d, AI analysis 7d.

### 3.9 Budget Management

Hard spending limits enforced before every API call:

- **Daily limit** (default: $5/day)
- **Monthly limit** (default: $100/month)
- **Per-API limits** (DataForSEO: $30/month, SerpAPI: $30/month, AI: $50/month)

The `withBudgetCheck()` wrapper automatically blocks API calls when limits are exceeded.

## 4. Technical Design

### 4.1 Data Flow

#### Collection Flow

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

#### V1 Analysis Flow

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

#### V2 Analysis Flow

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
Step 4: runV2Analysis()  (5-stage AI pipeline)
    ├── SEO Analysis               ──▶ trafficScore
    ├── Competitor Analysis         ──▶ competitionIntensity
    ├── Monetization Analysis       ──▶ monetizationScore
    └── Recommendation             ──▶ verdict + counterEvidence + verificationStatus
    │
    ▼
Step 5: updateIdeaScore()
    └── Calculate opportunityScore (weighted geometric mean)
```

#### Site Research Flow

```
POST /api/site-research
    │
    ▼
Step 1: crawlSite(url)
    ├── fetchPage(mainUrl)           Fetch main page HTML
    ├── extractMetadata(doc)         OG tags, JSON-LD, tech signals
    ├── extractPage(html)            5-strategy parallel extraction
    │   ├── Readability
    │   ├── CSS Selectors
    │   ├── JSON-LD
    │   ├── Next.js __NEXT_DATA__
    │   └── Full-page fallback
    ├── pickBestCandidate()          Select highest-quality extraction
    ├── discoverSubpageLinks()       Find /about, /pricing, /features etc.
    └── Parallel fetch + extract     Up to 4 subpages
    │
    ▼
Step 2: analyzeSite(crawlResult)
    └── AI analysis prompt with 11 dimensions:
        ├── 1. Product overview
        ├── 2. Product design analysis
        ├── 3. User persona
        ├── 4. Business model
        ├── 5. Strengths
        ├── 6. Weaknesses
        ├── 7. Market opportunities
        ├── 8. Five-dimensional market validation scores
        ├── 9. Four-route evidence framework
        ├── 10. Counter-evidence & kill criteria
        └── 11. Verification status judgment
    │
    ▼
Step 3: Save to site_researches table
```

### 4.2 Database Schema

#### Core Tables (V1)

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `ideas` | Core idea data + AI analysis + V1/V2 scores | id, title, url, source, status, finalScore, opportunityScore, rankCategory |
| `trend_history` | Historical score snapshots | ideaId, date, score |
| `collection_logs` | Data collection audit trail | source, status, itemsCount |
| `ai_cost_logs` | AI API usage tracking | model, inputTokens, outputTokens, costUsd |
| `settings` | Key-value configuration store | key, value |

#### V2 Tables

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

#### Site Research Table

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `site_researches` | Website analysis records | id, url, domain, title, status, pageContent, aiAnalysis (JSON), ideaId |

#### V2 Fields on `ideas` Table

| Field Group | Fields |
|-------------|--------|
| Lifecycle | status (discovered/screening/seo_validated/analyzed/actionable/archived) |
| V2 Scores | trafficScore, monetizationScore, executionScore, opportunityScore |
| SEO Data | primaryKeyword, targetSearchVolume, targetKeywordDifficulty, targetCpc, estimatedTraffic, competitorCount |
| V2 AI Analysis | aiSeoAnalysis (JSON), aiCompetitorAnalysis (JSON), aiMonetizationAnalysis (JSON), aiRecommendation (JSON) |

#### Indexes

V1 indexes:
- `idx_ideas_source`, `idx_ideas_final_score`, `idx_ideas_discovered_at`, `idx_ideas_category`
- `idx_trend_history_idea_id`, `idx_ai_cost_logs_created_at`

V2 indexes:
- `idx_ideas_status`, `idx_ideas_opportunity_score`, `idx_ideas_primary_keyword`
- `idx_keywords_keyword`, `idx_keywords_search_volume`, `idx_keywords_difficulty`
- `idx_serp_keyword`, `idx_competitors_idea_id`, `idx_competitors_domain`
- `idx_monetization_domain`, `idx_idea_keywords_idea_id`, `idx_idea_keywords_keyword_id`
- `idx_api_cache_key`, `idx_api_cache_expires`, `idx_api_cost_api_name`, `idx_api_cost_created_at`

### 4.3 Scoring Architecture

**V1 Score** -- Weighted additive of 5 dimensions:

| Dimension | Weight | Source |
|-----------|--------|--------|
| Trend | 30% | Source metrics (upvotes, comments) + recency |
| Demand | 25% | AI deep analysis |
| Competition | 20% | AI deep analysis |
| Feasibility | 15% | AI deep analysis |
| Growth | 10% | AI deep analysis |

**V2 Opportunity Score** -- Weighted geometric mean (multiplication model):

| Dimension | Weight | Source |
|-----------|--------|--------|
| Traffic | 40% | SEO keyword analysis (volume, difficulty, competition) |
| Monetization | 35% | Competitor monetization signals + AI assessment |
| Execution | 25% | 100 - competitionIntensity (AI evaluation) |

Formula: `Score = (Traffic/100)^0.4 x (Monetization/100)^0.35 x (Execution/100)^0.25 x 100`

Scores map to ranks: S (>=85), A (>=70), B (>=55), C (>=40), D (<40). V2 opportunityScore is used for ranking when available, with V1 finalScore as fallback.

### 4.4 Frontend Architecture

The frontend follows Next.js App Router conventions:

- **Server-rendered layout** with client-side interactive pages
- **Component hierarchy**: Pages > Feature Components > UI Primitives
- **State management**: Local `useState` per page (no global state library needed)
- **API communication**: Direct `fetch()` to Next.js API routes

#### Page Structure

| Route | Component | Description |
|-------|-----------|------------|
| `/` | `DashboardPage` | KPI cards, quick actions, V2 analysis trigger, API cost overview, top ideas |
| `/ideas` | `IdeasPage` | Filterable/sortable ideas table with pagination |
| `/ideas/[id]` | `IdeaDetailPage` | V2 opportunity scores, SEO data, AI recommendations, radar chart, verification status, counter-evidence |
| `/keywords` | `KeywordsPage` | Keyword browser with search, sort, pagination, color-coded difficulty |
| `/research` | `ResearchPage` | Site research: URL input, crawl + analyze, 11-dimension analysis display |
| `/settings` | `SettingsPage` | AI models, SEO APIs, data sources, scheduler config |

## 5. Module Structure

```
src/
  app/                          # Next.js App Router
    api/
      ideas/                    # Ideas CRUD
      stats/                    # Dashboard statistics
      collect/                  # Data collection trigger
      analyze/                  # V1 AI analysis
      analyze-v2/               # V2 full pipeline
      keywords/                 # Keyword browsing
      budget/                   # Budget monitoring
      settings/                 # Configuration CRUD
      site-research/            # Site research (POST + GET list)
        [id]/                   # Site research detail (GET)
    ideas/[id]/                 # Idea detail page
    keywords/                   # Keyword browser page
    research/                   # Site research page
    settings/                   # Settings page
  components/
    ui/                         # Reusable primitives (Badge, Card, etc.)
    dashboard/                  # Dashboard widgets
    ideas/                      # Ideas page components
    charts/                     # Recharts visualizations
      score-radar.tsx           # V1 5-dimension radar
      five-dim-radar.tsx        # Five-dimensional market validation radar
  lib/
    ai/
      provider.ts               # AI provider abstraction + retry logic
      analyzer.ts               # V1 screening + deep analysis
      prompts.ts                # V1 prompt templates
      pipeline-v2.ts            # V2 5-stage AI pipeline + scoring
    api/
      dataforseo.ts             # DataForSEO client
      serpapi.ts                # SerpAPI client
    budget/
      manager.ts                # Budget enforcement + tracking
    cache/
      multi-layer.ts            # Memory LRU + SQLite cache
    collectors/
      hackernews.ts             # HN collector
      producthunt.ts            # PH collector
      index.ts                  # collectAll() orchestrator
    competitors/
      discovery.ts              # SERP-based competitor detection
      monetization.ts           # Pricing/ads signal detection
    keywords/
      extractor.ts              # Seed keyword extraction
      expander.ts               # Keyword expansion (DataForSEO)
      enricher.ts               # SEO metrics enrichment
      pipeline.ts               # processIdeaKeywords() orchestrator
    research/
      crawler.ts                # Multi-strategy website crawler
      analyzer.ts               # AI-powered site analysis (11 dimensions)
    scoring/
      engine.ts                 # V1 + V2 scoring + ranking
    scheduler/
      index.ts                  # Cron job management
    db/
      index.ts                  # Database connection (lazy proxy)
      schema.ts                 # Drizzle schema (14 tables)
    config.ts                   # Environment configuration
  types/
    turndown.d.ts               # Type declarations for turndown + gfm plugin
```

## 6. Error Handling

| Layer | Strategy |
|-------|---------|
| **API routes** | Try/catch with structured JSON error responses (`{ error, details }`) |
| **AI calls** | Exponential backoff retry (4 attempts: 0s/1s/2s/4s delays) |
| **V2 pipeline stages** | Per-stage try/catch; failed stage uses defaults (score 50), pipeline continues |
| **Site research** | Status tracking in DB (crawling/analyzing/completed/failed); error message saved |
| **Collectors** | Per-source error isolation; one source failing doesn't block others |
| **Database** | WAL mode + busy_timeout prevents locking under concurrent access |
| **Content extraction** | 5 strategies with fallback; raw-strip as last resort |

## 7. Security Considerations

### API Keys
- All API keys stored in SQLite `settings` table or environment variables
- Keys are never exposed to the client (all API calls happen server-side in Route Handlers)
- No authentication system -- the app is designed for single-user local deployment

### Input Validation
- URL validation in site research (`new URL()` check before processing)
- Domain blocklist for site research (prevents crawling social media platforms)
- Request body validation in all POST endpoints
- Integer parsing with `NaN` check for ID parameters

### External Requests
- 20-second timeout on all external HTTP fetches (crawler)
- User-Agent spoofing to avoid bot detection (standard Chrome UA)
- Content-type checking (only processes `text/html` responses)
- Content size limits: main page 20KB markdown, subpages 10KB each, AI prompt 40KB total

### Data Safety
- SQLite database stored locally, never transmitted
- No telemetry, no cloud sync, no external data sharing
- AI analysis prompts contain only idea metadata and crawled public web content

## 8. Dependencies

### Runtime

| Package | Purpose | Version |
|---------|---------|---------|
| next | Framework | 16.1.6 |
| react / react-dom | UI | 19.x |
| better-sqlite3 | SQLite driver | ^11.x |
| drizzle-orm | ORM | ^0.39.x |
| recharts | Charts | ^2.x |
| lucide-react | Icons | ^0.x |
| node-cron | Scheduler | ^3.x |
| sonner | Toast notifications | ^2.x |
| @mozilla/readability | Content extraction (Readability) | ^0.5.x |
| linkedom | Server-side DOM | ^0.18.x |
| turndown | HTML to Markdown | ^7.x |
| turndown-plugin-gfm | GFM support | ^1.x |

### Development

| Package | Purpose |
|---------|---------|
| typescript | Type safety |
| tailwindcss | Styling (v4) |
| drizzle-kit | Schema migrations |
| @types/* | Type definitions |

### External APIs

| API | Purpose | Cost Model |
|-----|---------|-----------|
| OpenRouter / OpenAI / Anthropic | AI analysis | Per-token |
| DataForSEO | Keyword data + SERP | Per-request |
| SerpAPI | SERP fallback | Per-request |
| Hacker News Firebase | Idea collection | Free |
| Product Hunt GraphQL | Idea collection | Free (with token) |

## 9. Observability

### Cost Tracking
- `ai_cost_logs` table: every AI call logged with model, tokens, cost, idea reference
- `api_cost_logs` table: every SEO API call logged with endpoint and cost
- Dashboard displays today/month spend breakdown by API

### Console Logging
- `[V2 Pipeline]` prefixed logs for each pipeline stage
- `[SiteResearch]` prefixed logs for crawl and analysis operations
- Error details logged with full stack traces in development

### Status Tracking
- Ideas: `status` field tracks lifecycle (discovered -> analyzed -> actionable)
- Site researches: `status` field tracks progress (crawling -> analyzing -> completed/failed)
- Collection logs: per-source success/failure with item counts and durations

## 10. Future Considerations

- **PostgreSQL migration path**: Drizzle ORM makes switching databases straightforward if multi-user is needed
- **Async processing**: Site research currently runs synchronously; can be moved to background jobs for large-scale usage
- **Rate limiting**: No rate limiting on API routes since it's single-user; would need to add if exposed publicly
- **Authentication**: No auth layer currently; would need to add if deployed as a shared service
- **Social media mining**: The xhs-needs-mining methodology could be extended to mine demand signals from Reddit, Twitter, and other platforms
