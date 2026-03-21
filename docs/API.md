# API Reference

All API endpoints are Next.js Route Handlers under `/src/app/api/`. Responses are JSON.

## Base URL

```
http://localhost:8080/api
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

## V2 Analysis

### POST /api/analyze-v2

Run the full V2 analysis pipeline (keywords + competitors + monetization + AI 4-stage analysis).

**Request Body (single idea):**

```json
{
  "ideaId": "abc123"
}
```

**Request Body (batch mode):**

```json
{
  "mode": "batch",
  "limit": 5
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `ideaId` | string | - | Analyze a specific idea |
| `mode` | string | - | Set to `"batch"` for batch processing |
| `limit` | number | 5 | Max ideas to process in batch (max 20) |

**Response (single):**

```json
{
  "success": true,
  "ideaId": "abc123",
  "ideaTitle": "AI Code Review Tool",
  "duration": 45000,
  "keywords": { "seeds": 5, "expanded": 25, "enriched": 20, "saved": 18 },
  "competitorCount": 8,
  "analysis": {
    "trafficScore": 72,
    "monetizationScore": 68,
    "executionScore": 75,
    "opportunityScore": 71.5,
    "verdict": "go"
  }
}
```

**What happens:**
1. Keyword extraction + SEO data enrichment via DataForSEO
2. Competitor discovery from SERP results
3. Monetization signal detection on top 10 competitor domains
4. AI 4-stage analysis (SEO -> Competitor -> Monetization -> Recommendation)
5. Recommendation now includes counter-evidence (failure reasons, kill criteria) and verification status
6. Score update with opportunityScore (weighted geometric mean)

**Note:** This endpoint has `maxDuration: 300` (5 minutes) as the full pipeline can take significant time.

---

## Site Research

### GET /api/site-research

List all site research records, most recent first.

**Response:**

```json
{
  "researches": [
    {
      "id": 1,
      "url": "https://example.com",
      "domain": "example.com",
      "title": "Example Product",
      "status": "completed",
      "createdAt": "2025-03-20T10:00:00.000Z"
    }
  ]
}
```

Returns the 50 most recent records. Each record includes only summary fields (no full analysis).

### POST /api/site-research

Start a new site research analysis. Crawls the target website and runs AI-powered 11-dimension analysis.

**Request Body:**

```json
{
  "url": "https://example.com",
  "ideaId": "abc123"
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Target website URL (auto-prepends `https://` if missing) |
| `ideaId` | string | No | Optional link to an existing idea record |

**Response (success):**

```json
{
  "id": 1,
  "status": "completed",
  "analysis": {
    "overview": {
      "name": "Product Name",
      "oneLiner": "One-line description",
      "category": "SaaS",
      "coreValue": "Core value proposition",
      "problemSolved": "Core problem solved"
    },
    "productDesign": {
      "coreFeatures": ["Feature 1", "Feature 2"],
      "userFlow": "User flow description",
      "techStackGuess": ["React", "Node.js"],
      "designStyle": "Design style description",
      "highlights": ["Highlight 1"]
    },
    "userPersona": {
      "primaryAudience": "Primary audience",
      "secondaryAudience": "Secondary audience",
      "useCases": ["Use case 1"],
      "userNeeds": ["Need 1"],
      "userJourney": "Journey description"
    },
    "businessModel": {
      "monetization": "SaaS subscription",
      "pricingStrategy": "Freemium with paid tiers",
      "revenueStreams": ["Subscriptions"],
      "marketSize": "Market size estimate"
    },
    "strengths": ["Strength 1"],
    "weaknesses": ["Weakness 1"],
    "opportunities": {
      "marketGaps": ["Gap 1"],
      "improvements": ["Improvement 1"],
      "inspirations": ["Inspiration 1"]
    },
    "fiveDimensionalScores": {
      "demand_score": 8,
      "pain_score": 7,
      "pay_score": 6,
      "build_fit_score": 9,
      "competition_risk_score": 5
    },
    "evidenceFramework": {
      "help_seeking": {
        "signals": ["Signal 1"],
        "strength": "strong",
        "examples": ["Example 1"]
      },
      "alternative_seeking": {
        "signals": ["Signal 1"],
        "strength": "moderate",
        "examples": ["Example 1"]
      },
      "complaints": {
        "signals": ["Signal 1"],
        "strength": "strong",
        "examples": ["Example 1"]
      },
      "transaction_intent": {
        "signals": ["Signal 1"],
        "strength": "strong",
        "examples": ["Example 1"]
      },
      "coverage_summary": "Coverage summary text"
    },
    "counterEvidence": {
      "failure_reasons": ["Reason 1", "Reason 2"],
      "kill_criteria": ["Quantifiable stop criterion 1"],
      "counter_arguments": ["Counter argument 1"],
      "validation_plan": {
        "next_steps": ["Step 1"],
        "critical_assumptions": ["Assumption 1"],
        "timeline": "Validation timeline"
      }
    },
    "verificationStatus": {
      "status": "conditional",
      "reasoning": "Reasoning text",
      "confidence_level": 65,
      "evidence_gaps": ["Gap 1"]
    },
    "overallRating": 8,
    "summary": "Summary text"
  }
}
```

**Response (error):**

```json
{
  "id": 1,
  "error": "Error message"
}
```

**What happens:**
1. Validates and normalizes the URL
2. Creates a `site_researches` record with status `crawling`
3. Crawls the main page + up to 4 subpages using multi-strategy extraction
4. Updates status to `analyzing`, runs 11-dimension AI analysis
5. Saves analysis JSON and updates status to `completed` (or `failed` on error)

**Status Lifecycle:** `crawling` -> `analyzing` -> `completed` | `failed`

### GET /api/site-research/:id

Get a single site research with full analysis data.

**Response:**

```json
{
  "id": 1,
  "url": "https://example.com",
  "domain": "example.com",
  "title": "Product Name",
  "status": "completed",
  "pageContent": "Crawled page content...",
  "aiAnalysis": { "...parsed JSON..." },
  "ideaId": null,
  "errorMessage": null,
  "createdAt": "2025-03-20T10:00:00.000Z",
  "updatedAt": "2025-03-20T10:02:00.000Z"
}
```

The `aiAnalysis` field is automatically parsed from JSON string to object. Returns `null` if analysis hasn't completed.

**Error (400):**

```json
{ "error": "无效的 ID" }
```

**Error (404):**

```json
{ "error": "未找到该调研记录" }
```

---

## Keywords

### GET /api/keywords

List keywords with pagination, sorting, and filtering.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Items per page (max 200) |
| `sort` | string | `search_volume` | Sort field: `search_volume`, `difficulty`, `cpc`, `keyword` |
| `order` | string | `desc` | Sort order: `asc` or `desc` |
| `search` | string | - | Search keyword text |
| `minVolume` | number | 0 | Minimum search volume filter |
| `maxDifficulty` | number | 100 | Maximum difficulty filter |
| `ideaId` | string | - | Filter keywords linked to a specific idea |

**Response:**

```json
{
  "keywords": [
    {
      "id": 1,
      "keyword": "ai code review",
      "searchVolume": 12000,
      "difficulty": 45.2,
      "cpc": 3.50,
      "clusterId": null,
      "dataSource": "dataforseo",
      "lastUpdated": "2025-03-15T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 234,
    "totalPages": 5
  }
}
```

---

## Budget

### GET /api/budget

Get budget overview with daily/monthly spend and per-API breakdown.

**Response:**

```json
{
  "daily": {
    "spent": 1.25,
    "limit": 5,
    "remaining": 3.75,
    "percentage": 25
  },
  "monthly": {
    "spent": 18.50,
    "limit": 100,
    "remaining": 81.50,
    "percentage": 18.5
  },
  "byApi": {
    "dataforseo": { "spent": 5.20, "limit": 30 },
    "serpapi": { "spent": 3.10, "limit": 30 },
    "ai": { "spent": 10.20, "limit": 50 }
  }
}
```

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
