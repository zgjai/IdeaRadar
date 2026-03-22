# Data Sources

## Overview

IdeaRadar uses two categories of external data sources:

1. **Idea Collectors** - Collect raw product ideas from community platforms (Hacker News, Product Hunt)
2. **SEO APIs (V2)** - Enrich ideas with keyword data, SERP analysis, and competitor intelligence (DataForSEO, SerpAPI)

## Collector Architecture

```
src/lib/collectors/
  types.ts          # Shared interfaces
  hackernews.ts     # Hacker News collector
  producthunt.ts    # Product Hunt collector
  googletrends.ts   # Google Trends collector
  index.ts          # Orchestrator (collectAll)
```

### Interfaces

```typescript
// What each collector produces per idea
interface CollectedIdea {
  title: string;
  description: string;
  url: string;
  source: string;           // e.g., 'hackernews'
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
1. Runs all enabled collectors in parallel
2. Collects results from each
3. Deduplicates across all sources by URL
4. Inserts new ideas (skips existing URLs)
5. Logs each source's result to `collection_logs`

## Hacker News

**Status:** Active

**Source file:** `src/lib/collectors/hackernews.ts`

**API:** HN Firebase API (`https://hacker-news.firebaseio.com/v0`)

### How It Works

1. Fetches top 30 story IDs from `/topstories.json`
2. Fetches top 20 story IDs from `/beststories.json`
3. Deduplicates and caps at 50 total stories
4. Fetches individual story details in batches of 5 (concurrent)
5. Filters for:
   - "Show HN" posts (title starts with "Show HN")
   - OR stories with score >= 50
6. Extracts: title, description (from `text` or title), URL, score, comment count

### Rate Limiting

- 100ms delay between individual story fetches
- Batch size of 5 concurrent requests
- 10-second timeout per request

### Configuration

Enabled by default. Toggle via Settings page or environment:

```env
# No API key required -- HN API is public
```

Settings key: `sources.hackernews.enabled`

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
// src/lib/collectors/reddit.ts
import type { CollectedIdea, CollectorResult } from './types';

export async function collectReddit(): Promise<CollectorResult> {
  const startTime = Date.now();
  const items: CollectedIdea[] = [];
  const errors: string[] = [];

  try {
    // 1. Fetch data from the source API
    // 2. Filter for relevant items
    // 3. Convert to CollectedIdea format

    items.push({
      title: 'Example Post',
      description: 'Description of the product idea',
      url: 'https://reddit.com/r/startups/...',
      source: 'reddit',
      sourceId: 'post_id',
      sourceScore: 150,
      sourceComments: 42,
      discoveredAt: new Date().toISOString(),
      metadata: { subreddit: 'startups' },
    });
  } catch (error) {
    errors.push(`Reddit API error: ${error}`);
  }

  return {
    source: 'reddit',
    items,
    errors,
    duration: Date.now() - startTime,
  };
}
```

### 2. Register in the orchestrator

Edit `src/lib/collectors/index.ts`:

```typescript
import { collectReddit } from './reddit';

// Add to the collectors array in collectAll()
const results = await Promise.allSettled([
  collectHackerNews(),
  collectProductHunt(),
  collectReddit(),  // Add here
]);
```

### 3. Add trend score calculation

If the new source has different scoring metrics, update `src/lib/scoring/engine.ts`:

```typescript
function calculateTrendScore(idea: Idea): number {
  // ... existing code
  } else if (idea.source === 'reddit') {
    const redditScore = Math.min((srcScore / 300) * 100, 100);
    score += redditScore * 0.7;
    const commentScore = Math.min((srcComments / 80) * 100, 100);
    score += commentScore * 0.3;
  }
  // ...
}
```

### 4. Add settings UI (optional)

Add a toggle in `src/app/settings/page.tsx` following the existing pattern for hackernews/producthunt.

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
| A. Community Pain | HN collector, PH collector | Automated collection from forums/communities |
| B. Keyword Opportunity | Google Trends collector, Trend Mining, DataForSEO | Rising queries, search volume, keyword expansion |
| C. Competitor Gap | SerpAPI SERP results, Site Research crawler | Competitor discovery, pricing analysis, weakness identification |
| D. Shadow Clone | V2 Competitor Analysis stage, Site Research AI | AI identifies best clone targets and their weaknesses |
| E. Service Productization | V2.2 Strategy Analysis stage (SOAP evaluation) | AI evaluates automation potential against Fiverr/Upwork benchmarks |

Each idea is classified into one of these strategies during the V2 analysis pipeline (Stage 4: Strategy Analysis). The classification is stored in `ideas.discovery_strategy` and displayed on the idea detail page.

## Collection Logs

Every collection run is logged to `collection_logs`:

| Field | Description |
|-------|-------------|
| `source` | Collector name (e.g., `hackernews`) |
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
