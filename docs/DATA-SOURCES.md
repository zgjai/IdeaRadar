# Data Sources

## Overview

IdeaRadar uses two categories of external data sources:

1. **Idea Collectors** - Collect raw product ideas from community platforms (Hacker News, Reddit, Product Hunt, Google Trends)
2. **SEO APIs (V2)** - Enrich ideas with keyword data, SERP analysis, and competitor intelligence (DataForSEO, SerpAPI)

All collectors share a **Demand Signal Filter** (V2.3) that pre-screens content for genuine product demand signals before saving to the database.

## Collector Architecture

```
src/lib/collectors/
  types.ts          # Shared interfaces (CollectedIdea, CollectorResult)
  signals.ts        # Demand signal filter (V2.3)
  hackernews.ts     # Hacker News collector (Algolia API)
  producthunt.ts    # Product Hunt collector
  googletrends.ts   # Google Trends collector
  reddit.ts         # Reddit collector (V2.3)
  index.ts          # Orchestrator (collectAll)
```

### Interfaces

```typescript
// What each collector produces per idea
interface CollectedIdea {
  title: string;
  description: string;
  url: string;
  source: string;           // 'hackernews' | 'producthunt' | 'google_trends' | 'reddit'
  sourceId: string;         // Original platform ID
  sourceScore: number;      // Upvotes/votes
  sourceComments: number;   // Comment count
  discoveredAt: string;     // ISO timestamp
  metadata?: Record<string, unknown>;
}

// What each collector returns
interface CollectorResult {
  source: string;
  items: CollectedIdea[];
  errors: string[];
  duration: number;         // ms
}
```

### Orchestration

`collectAll()` in `index.ts`:
1. Checks which sources are enabled via Settings (`sources.{name}.enabled`)
2. Runs only enabled collectors in parallel
3. Deduplicates across all sources by URL
4. Inserts new ideas (skips existing URLs)
5. Logs each source's result to `collection_logs`

## Demand Signal Filter (V2.3)

**Status:** Active (shared module)

**Source file:** `src/lib/collectors/signals.ts`

### Overview

The demand signal filter is a keyword-based pre-screening system that scores content for genuine product demand indicators. Applied at collection time to improve signal-to-noise ratio before AI screening.

### Signal Categories

| Category | Weight | Example Patterns |
|----------|--------|-----------------|
| **Pain Points** | 7-9 | "frustrated", "hate", "broken", "wish there was", "nightmare", "struggling with" |
| **Explicit Demand** | 8-10 | "looking for", "alternative to", "better than", "I need", "anyone know", "recommend" |
| **Payment Intent** | 9-10 | "I'd pay", "worth paying", "take my money", "$X/month", "willing to pay" |
| **Product Launch** | 5-8 | "I built", "just launched", "Show HN", "side project", "open source" |
| **Opportunity** | 7-9 | "no good solution", "missing feature", "gap in market", "underserved", "why isn't there" |

### Scoring Algorithm

1. Match all signal patterns against title + description
2. Sum matched pattern weights
3. Apply bonuses:
   - Multi-category bonus: +20% if signals from 3+ categories
   - Payment intent super-boost: +30% if payment signals present
   - Title visibility bonus: +20% if signal appears in title
4. Normalize to 0-100 scale (50 raw points = 100 score)

### Source-Specific Thresholds

| Source | Threshold | Rationale |
|--------|-----------|-----------|
| Hacker News | 20 | Higher noise floor |
| Reddit | 15 | Better subreddit targeting |
| Product Hunt | 10 | Pre-curated by PH |

Items below threshold are filtered out unless they have high source scores (e.g., HN points >= 50, Reddit score >= 20).

### Signal Metadata

Signal data is stored in `ideas.metadata`:
```json
{
  "demandSignalScore": 65,
  "demandSignals": [
    {"text": "looking for", "category": "demand", "weight": 9},
    {"text": "frustrated", "category": "pain", "weight": 8}
  ],
  "demandCategories": {"demand": 1, "pain": 1}
}
```

## Hacker News

**Status:** Active

**Source file:** `src/lib/collectors/hackernews.ts`

**API:** HN Algolia Search API (`https://hn.algolia.com/api/v1`)

### How It Works (V2.3 — Three-Query Strategy)

1. **Show HN query** — Fetches Show HN posts from last 7 days (`tags=show_hn`, up to 50 results)
2. **Ask HN query** — Fetches Ask HN posts from last 7 days with `points>10` (up to 30 results)
3. **Demand keyword search** — Searches for 5 demand signal phrases ("looking for", "alternative to", "better than", "need a tool", "recommend") in recent stories, 10 results each
4. Deduplicates across all 3 queries by `objectID`
5. Applies demand signal filter
6. Keeps items that match ANY of:
   - Is a Show HN post (always kept — explicit product launches)
   - Has points >= 50 (high community validation)
   - Demand signal score >= 20

### Rate Limiting

- 1-second delay between keyword search queries
- 15-second timeout per request
- No auth required (Algolia HN API is public)

### Configuration

Enabled by default. Toggle via Settings page.

```env
# No API key required -- HN Algolia API is public
```

Settings key: `sources.hackernews.enabled`

## Reddit

**Status:** Active (V2.3, no auth required)

**Source file:** `src/lib/collectors/reddit.ts`

**API:** Reddit JSON API (unauthenticated, `https://www.reddit.com/r/{sub}/{sort}.json`)

### Target Subreddits

| Subreddit | Value |
|-----------|-------|
| r/SaaS | SaaS products, pricing, marketing discussions |
| r/startups | Startup ideas, founder problems, validation |
| r/SideProject | Indie projects, side hustles, launches |
| r/selfhosted | Self-hosted tools, privacy software |
| r/Entrepreneur | Business opportunities, service ideas |

### How It Works

1. For each subreddit, fetches **hot** (25 posts) + **top of the week** (25 posts)
2. Deduplicates within subreddit by post ID
3. Pre-filters for quality:
   - Score >= 5, comments >= 2
   - Upvote ratio >= 0.6
   - Not image/video-only, not stickied, not NSFW
   - Excludes META/MOD flairs
4. Applies demand signal filter
5. Keeps items with demand signal score >= 15 OR Reddit score >= 20

### Rate Limiting

- 1.5-second delay between all Reddit requests
- 10-second timeout per request
- Descriptive User-Agent header to avoid blocking

### Configuration

Disabled by default. Toggle via Settings page.

```env
# No API key required -- uses public Reddit JSON API
```

Settings key: `sources.reddit.enabled`

## Product Hunt

**Status:** Placeholder (requires API token)

**Source file:** `src/lib/collectors/producthunt.ts`

**API:** Product Hunt GraphQL API

### How It Works

1. Queries today's posts via GraphQL
2. Extracts: name, tagline, URL, votes count, comments count
3. Gracefully returns empty result if no API token is configured

### Configuration

```env
PRODUCTHUNT_TOKEN=your_product_hunt_api_token
```

Settings keys:
- `sources.producthunt.enabled`
- `sources.producthunt.apiToken`

### Getting a Product Hunt API Token

1. Go to [Product Hunt API Dashboard](https://www.producthunt.com/v2/oauth/applications)
2. Create a new application
3. Use the Developer Token (no OAuth flow needed)

## Google Trends

**Status:** Active (requires SerpAPI key)

**Source file:** `src/lib/collectors/googletrends.ts`

**API:** SerpAPI Google Trends endpoints

### How It Works

1. Calls SerpAPI `engine=google_trends_trending_now` for daily trending searches
2. Filters for tech/startup-related trends using keyword matching (TECH_KEYWORDS set)
3. Converts to `CollectedIdea` format with Google Trends explore URL and traffic-based score

### Trend Mining (/trends page)

Additionally, the **Trend Mining** feature (`src/app/trends/page.tsx`) provides a seed-word-to-rising-query discovery workflow:

1. User provides seed words (e.g., "AI", "SaaS", "generator")
2. System calls `getRisingQueries()` for each seed via SerpAPI (`engine=google_trends`, `data_type=RELATED_QUERIES`)
3. Enriches top results with SEO data from DataForSEO (volume, KD, CPC)
4. Stores in `trend_discoveries` table for validation and conversion to ideas

Settings key: `sources.googleTrends.enabled`

## Adding a New Collector

To add a new data source:

### 1. Create the collector file

```typescript
// src/lib/collectors/newcollector.ts
import type { CollectedIdea, CollectorResult } from './types';
import { scoreDemandSignals, enrichWithSignals, SOURCE_THRESHOLDS } from './signals';

export async function collectNewSource(): Promise<CollectorResult> {
  const startTime = Date.now();
  const items: CollectedIdea[] = [];
  const errors: string[] = [];

  try {
    // 1. Fetch data from the source API
    // 2. Pre-filter for basic quality
    // 3. Apply demand signal filter
    // 4. Convert to CollectedIdea format with enrichWithSignals()
  } catch (error) {
    errors.push(`API error: ${error}`);
  }

  return { source: 'newsource', items, errors, duration: Date.now() - startTime };
}
```

### 2. Register in the orchestrator

Edit `src/lib/collectors/index.ts` — import and add to the settings-driven collector array.

### 3. Add trend score calculation

Update `src/lib/scoring/engine.ts` with source-specific scoring formula.

### 4. Add settings UI

Add a toggle in `src/app/settings/page.tsx` following the existing pattern.

## SEO APIs (V2)

### DataForSEO

**Status:** Active (requires account)

**Source file:** `src/lib/api/dataforseo.ts`

**API:** DataForSEO REST API (`https://api.dataforseo.com/v3`)

#### Capabilities

| Method | Endpoint | Cost | Description |
|--------|----------|------|-------------|
| `getKeywordData()` | Keywords Data | ~$0.0003/keyword | Batch keyword metrics (volume, difficulty, CPC) |
| `getRelatedKeywords()` | Related Keywords | ~$0.001/request | Expand seed keywords |
| `getSerpResults()` | SERP | ~$0.005/query | Search result analysis |

#### Authentication

HTTP Basic Auth with login (email) and password.

#### Configuration

```env
DATAFORSEO_LOGIN=your@email.com
DATAFORSEO_PASSWORD=your_password
```

Settings keys: `seo.dataforseo.login`, `seo.dataforseo.password`

#### Getting an Account

1. Register at [dataforseo.com](https://dataforseo.com)
2. Free tier includes $1 credit for testing
3. Pay-as-you-go pricing after that

### SerpAPI

**Status:** Active (requires API key, used as fallback)

**Source file:** `src/lib/api/serpapi.ts`

**API:** SerpAPI (`https://serpapi.com/search`)

#### Capabilities

| Method | Cost | Description |
|--------|------|-------------|
| `search()` | $0.01/search | Google SERP results with organic results, PAA, related searches, SERP features |

#### Configuration

```env
SERPAPI_KEY=your_serpapi_key
```

Settings key: `seo.serpapi.apiKey`

#### Getting an API Key

1. Register at [serpapi.com](https://serpapi.com)
2. Free tier: 100 searches/month
3. Paid plans start at $50/month

### Graceful Degradation

The V2 pipeline works without any SEO APIs configured:
- Keyword extraction still works (uses title/category-based seeds only)
- SERP analysis and competitor discovery are skipped
- AI analysis runs with reduced context (lower confidence)

When only one API is configured, the system uses it as the primary source. When both are configured, DataForSEO is preferred for keywords and SerpAPI is used as fallback for SERP data.

## Strategy-Source Mapping (V2.2)

The V2.2 five-strategy discovery methodology maps data sources to strategies:

| Strategy | Primary Data Sources | How IdeaRadar Uses It |
|----------|---------------------|----------------------|
| A. Community Pain | HN collector, PH collector, **Reddit collector** | Automated collection from forums/communities |
| B. Keyword Opportunity | Google Trends collector, Trend Mining, DataForSEO | Rising queries, search volume, keyword expansion |
| C. Competitor Gap | SerpAPI SERP results, Site Research crawler | Competitor discovery, pricing analysis, weakness identification |
| D. Shadow Clone | V2 Competitor Analysis stage, Site Research AI | AI identifies best clone targets and their weaknesses |
| E. Service Productization | V2.2 Strategy Analysis stage (SOAP evaluation) | AI evaluates automation potential against Fiverr/Upwork benchmarks |

Each idea is classified into one of these strategies during the V2 analysis pipeline (Stage 4: Strategy Analysis). The classification is stored in `ideas.discovery_strategy` and displayed on the idea detail page.

## Collection Logs

Every collection run is logged to `collection_logs`:

| Field | Description |
|-------|-------------|
| `source` | Collector name (e.g., `hackernews`, `reddit`) |
| `status` | `success`, `failed`, or `partial` |
| `items_count` | Number of new ideas inserted |
| `error_message` | Error details if any |
| `started_at` | Collection start timestamp |
| `completed_at` | Collection end timestamp |

These logs power the "Sources Online" indicator on the Dashboard -- a source is considered online if it had a successful collection within the last 24 hours.

## API Cost Tracking (V2)

SEO API calls are tracked in the `api_cost_logs` table:

| Field | Description |
|-------|-------------|
| `api_name` | API identifier (`dataforseo`, `serpapi`) |
| `endpoint` | Specific endpoint called |
| `cost_usd` | Estimated cost of the call |
| `created_at` | Timestamp |

This data powers the Budget page and cost monitoring on the Dashboard.
