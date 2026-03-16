# API Reference

All API endpoints are Next.js Route Handlers under `/src/app/api/`. Responses are JSON.

## Base URL

```
http://localhost:3000/api
```

---

## Ideas

### GET /api/ideas

List ideas with filtering, sorting, and pagination.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `sort` | string | `finalScore` | Sort field: `finalScore`, `trendScore`, `discoveredAt`, `sourceScore` |
| `order` | string | `desc` | Sort order: `asc` or `desc` |
| `category` | string | - | Filter by category (e.g., `SaaS`, `Developer Tools`) |
| `source` | string | - | Filter by source: `hackernews`, `producthunt` |
| `rank` | string | - | Filter by rank: `S`, `A`, `B`, `C`, `D` |
| `search` | string | - | Full-text search on title and description |

**Response:**

```json
{
  "ideas": [
    {
      "id": "abc123",
      "title": "Show HN: AI-powered code review tool",
      "description": "...",
      "url": "https://example.com",
      "category": "Developer Tools",
      "source": "hackernews",
      "sourceId": "12345678",
      "sourceScore": 245,
      "sourceComments": 89,
      "aiSummary": "An AI tool that reviews pull requests...",
      "aiPainPoint": "Code review is time-consuming...",
      "aiTargetUsers": "Software development teams",
      "aiFeatures": "[\"automated PR review\", \"security scanning\"]",
      "aiCompetitors": "[\"CodeRabbit\", \"Codacy\"]",
      "aiTechFeasibility": 75,
      "trendScore": 82.5,
      "demandScore": 78,
      "competitionScore": 45,
      "feasibilityScore": 80,
      "growthScore": 65,
      "finalScore": 72.35,
      "rankCategory": "A",
      "confidence": 100,
      "discoveredAt": "2025-03-15T10:00:00.000Z",
      "analyzedAt": "2025-03-15T11:00:00.000Z",
      "createdAt": "2025-03-15T10:00:00.000Z",
      "updatedAt": "2025-03-15T11:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8,
    "hasMore": true
  }
}
```

### GET /api/ideas/:id

Get a single idea with trend history and parsed JSON fields.

**Response:**

```json
{
  "id": "abc123",
  "title": "...",
  "aiFeatures": ["feature1", "feature2"],
  "aiCompetitors": ["competitor1", "competitor2"],
  "trendHistory": [
    {
      "id": 1,
      "ideaId": "abc123",
      "date": "2025-03-15T10:00:00.000Z",
      "source": "hackernews",
      "score": 82.5,
      "metadata": "{\"finalScore\":72.35,\"rankCategory\":\"A\"}"
    }
  ]
}
```

**Error (404):**

```json
{ "error": "Idea not found" }
```

---

## Statistics

### GET /api/stats

Get dashboard statistics.

**Response:**

```json
{
  "totalIdeas": 156,
  "analyzedCount": 42,
  "unanalyzedCount": 114,
  "recentCount": 12,
  "sourceBreakdown": [
    { "source": "hackernews", "count": 138 },
    { "source": "producthunt", "count": 18 }
  ],
  "rankDistribution": [
    { "rank": "S", "count": 2 },
    { "rank": "A", "count": 8 },
    { "rank": "B", "count": 15 },
    { "rank": "C", "count": 12 },
    { "rank": "D", "count": 5 }
  ],
  "aiCosts": {
    "totalCost": 0.42,
    "totalInputTokens": 125000,
    "totalOutputTokens": 45000,
    "last7Days": 0.15
  },
  "sourcesOnline": ["hackernews"],
  "recentCollections": [
    {
      "id": 1,
      "source": "hackernews",
      "status": "success",
      "itemsCount": 38,
      "errorMessage": null,
      "startedAt": "2025-03-15T10:00:00.000Z",
      "completedAt": "2025-03-15T10:01:23.000Z"
    }
  ]
}
```

---

## Collection

### POST /api/collect

Trigger data collection from all enabled sources.

**Request:** No body required.

**Response (success):**

```json
{
  "success": true,
  "message": "Collected 38 new ideas",
  "summary": {
    "new": 38,
    "duplicates": 12,
    "total": 50,
    "sources": [
      {
        "source": "hackernews",
        "items": 38,
        "errors": [],
        "duration": 4523
      }
    ]
  }
}
```

**What happens:**
1. Runs all enabled collectors in parallel
2. Deduplicates results by URL
3. Inserts new ideas into the database
4. Recalculates trend scores for all ideas via `rankAllIdeas()`
5. Logs collection results to `collection_logs`

---

## Analysis

### POST /api/analyze

Trigger AI analysis on unanalyzed ideas.

**Request Body:**

```json
{
  "mode": "all",
  "limit": 10
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `mode` | string | `all` | Analysis mode: `screen` (screening only), `deep` (deep analysis only), `all` (both) |
| `limit` | number | 10 | Maximum ideas to process (max 50) |

**Response:**

```json
{
  "success": true,
  "screened": 8,
  "analyzed": 5,
  "message": "Screened 8 ideas, deeply analyzed 5 ideas"
}
```

**What happens:**
1. Fetches unanalyzed ideas (those without `analyzedAt`)
2. In `screen` or `all` mode: batch-screens unscreened ideas (3 concurrent)
3. In `deep` or `all` mode: deep-analyzes up to 5 ideas (sequential, 2s delay between)
4. Recalculates all scores and ranks via `rankAllIdeas()`

---

## Settings

### GET /api/settings

Get all configuration settings.

**Response:**

```json
{
  "settings": {
    "ai.screening.provider": "openrouter",
    "ai.screening.model": "anthropic/claude-haiku-4.5",
    "ai.screening.apiKey": "sk-...",
    "ai.analysis.provider": "openrouter",
    "ai.analysis.model": "anthropic/claude-sonnet-4.6",
    "ai.analysis.apiKey": "sk-...",
    "ai.temperature": "0.3",
    "ai.dailyBudget": "5",
    "sources.hackernews.enabled": "true",
    "sources.producthunt.enabled": "false",
    "sources.producthunt.apiToken": "",
    "sources.googleTrends.enabled": "false",
    "scheduler.collectInterval": "0 */6 * * *",
    "scheduler.analyzeInterval": "0 */6 * * *"
  }
}
```

### PUT /api/settings

Update configuration settings.

**Request Body:**

```json
{
  "settings": {
    "ai.screening.model": "anthropic/claude-haiku-4.5",
    "ai.analysis.model": "anthropic/claude-sonnet-4.6",
    "sources.hackernews.enabled": "true"
  }
}
```

All values must be strings.

**Response:**

```json
{
  "success": true,
  "message": "Updated 3 settings",
  "updates": [
    { "key": "ai.screening.model", "value": "anthropic/claude-haiku-4.5" },
    { "key": "ai.analysis.model", "value": "anthropic/claude-sonnet-4.6" },
    { "key": "sources.hackernews.enabled", "value": "true" }
  ]
}
```

---

## Error Response Format

All endpoints return errors in this format:

```json
{
  "error": "Human-readable error message",
  "details": "Technical error details (from Error.message)"
}
```

HTTP status codes:
- `200` - Success
- `400` - Bad request (invalid parameters)
- `404` - Resource not found
- `500` - Internal server error
