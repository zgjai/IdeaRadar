# Data Sources

## Overview

IdeaRadar collects product ideas from multiple internet sources through a pluggable collector architecture. Each collector implements a common interface and runs independently.

## Collector Architecture

```
src/lib/collectors/
  types.ts          # Shared interfaces
  hackernews.ts     # Hacker News collector
  producthunt.ts    # Product Hunt collector
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

**Status:** Planned (not yet implemented)

**Concept:** Monitor trending search terms in technology/startup categories and cross-reference with other data sources.

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
