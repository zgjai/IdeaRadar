# AI Engine

## Overview

IdeaRadar uses a multi-stage AI pipeline to evaluate product ideas. The V1 pipeline performs screening and deep analysis, while the V2 pipeline adds SEO-validated 4-stage analysis with competitor and monetization assessment. The system is provider-agnostic -- any OpenAI-compatible chat completions endpoint works.

## Architecture

```
                    ┌─────────────────┐
                    │  Settings DB    │
                    │  (ai.* keys)    │
                    └────────┬────────┘
                             │ Config
                             ▼
┌──────────┐    ┌──────────────────────┐    ┌──────────────┐
│  Ideas   │───▶│    IdeaAnalyzer       │───▶│  AI Provider │──▶ External API
│  (DB)    │    │                       │    │              │
│          │◀───│  screenIdea()         │    │  callLLM()   │
│          │    │  deepAnalyzeIdea()    │    │  callWithRetry()│
│          │    │  batchScreen()        │    └──────┬───────┘
│          │    │  analyzeUnanalyzed()  │           │
└──────────┘    └──────────────────────┘           ▼
                                            ┌──────────────┐
                                            │ ai_cost_logs │
                                            └──────────────┘
```

## Provider Configuration

### Supported Providers

| Provider | Base URL | Notes |
|----------|---------|-------|
| OpenRouter | `https://openrouter.ai/api/v1` | Recommended -- access to all major models |
| OpenAI | `https://api.openai.com/v1` | GPT-4o, GPT-4o-mini |
| Anthropic | `https://api.anthropic.com/v1` | Via OpenAI-compatible wrapper |
| Google | Custom endpoint | Gemini models |
| Custom | Any URL | Any OpenAI chat completions-compatible API |

### Configuration Methods

Settings are loaded with this priority:

1. **Database settings** (highest priority) -- set via Settings page UI
2. **Environment variables** -- set in `.env` file

#### Via Settings Page (Runtime)

Navigate to Settings and configure:

- **Provider** -- Select from dropdown (OpenRouter, OpenAI, Anthropic, Google, Custom)
- **Model Name** -- Full model identifier (e.g., `anthropic/claude-sonnet-4.6`)
- **API Key** -- Your provider API key

These are stored as key-value pairs in the `settings` table:

```
ai.screening.provider  = openrouter
ai.screening.model     = anthropic/claude-haiku-4.5
ai.screening.apiKey    = sk-or-v1-...
ai.analysis.provider   = openrouter
ai.analysis.model      = anthropic/claude-sonnet-4.6
ai.analysis.apiKey     = sk-or-v1-...
ai.temperature         = 0.3
ai.dailyBudget         = 5
```

#### Via Environment Variables

```env
AI_GATEWAY_URL=https://openrouter.ai/api/v1
AI_GATEWAY_API_KEY=sk-or-v1-your-key
AI_SCREENING_MODEL=anthropic/claude-haiku-4.5
AI_ANALYSIS_MODEL=anthropic/claude-sonnet-4.6
AI_DAILY_BUDGET=5
```

## Two-Stage Pipeline

### Stage 1: Screening

**Purpose:** Cheap, fast categorization of raw ideas.

**Model:** Configured as `screening` (default: Claude Haiku 4.5)

**Input:** Idea title, description, source, source score

**Output (JSON):**

```json
{
  "category": "Developer Tools",
  "targetUsers": "Software development teams",
  "problemDomain": "code review automation",
  "innovationScore": 72,
  "summary": "AI-powered pull request review tool"
}
```

**Categories:** SaaS, Mobile App, Web App, API/Platform, Developer Tools, E-commerce, MarketPlace, Content/Media, Hardware, Other

**DB Fields Updated:** `category`, `aiTargetUsers`, `aiSummary`

### Stage 2: Deep Analysis

**Purpose:** Comprehensive evaluation for scoring and recommendation.

**Model:** Configured as `analysis` (default: Claude Sonnet 4.6)

**Input:** Idea title, description, comment count, trend data (when available)

**Output (JSON):**

```json
{
  "painPoint": "Code review takes 2-4 hours per PR on average",
  "painPointIntensity": 78,
  "targetUsers": "Engineering teams at companies with 10+ developers",
  "marketSize": "large",
  "coreFeatures": ["automated PR review", "security scanning", "style enforcement"],
  "competitors": ["CodeRabbit", "Codacy", "SonarQube"],
  "differentiationSpace": "Focus on AI-native review with natural language feedback",
  "techFeasibility": 75,
  "mvpEstimateWeeks": 8,
  "demandScore": 78,
  "competitionScore": 45,
  "feasibilityScore": 80,
  "growthScore": 65,
  "recommendation": "Go",
  "reasoning": "Strong market demand with clear differentiation opportunity..."
}
```

**DB Fields Updated:** `aiPainPoint`, `aiTargetUsers`, `aiFeatures`, `aiCompetitors`, `aiTechFeasibility`, `demandScore`, `competitionScore`, `feasibilityScore`, `growthScore`, `analyzedAt`

## Retry & Error Handling

The `callWithRetry()` method implements exponential backoff:

| Attempt | Delay Before Retry |
|---------|-------------------|
| 1st | 0 (immediate) |
| 2nd | 1 second |
| 3rd | 2 seconds |
| 4th | 4 seconds (final attempt) |

Common errors and handling:

| Error | Handling |
|-------|---------|
| Rate limit (429) | Retried with backoff |
| Timeout (60s) | Retried with backoff |
| Invalid JSON response | Logged, idea skipped |
| API key invalid (401) | Logged, not retried |

## Cost Tracking

Every AI API call is logged to `ai_cost_logs`:

```sql
ai_cost_logs (
  model TEXT,           -- e.g., 'anthropic/claude-haiku-4.5'
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd REAL,        -- Calculated from model pricing table
  idea_id TEXT,         -- Which idea this call was for
  analysis_type TEXT,   -- 'screening' or 'deep'
  created_at TEXT
)
```

### Cost Estimation

If the API response includes `usage` data, actual token counts are used. Otherwise, tokens are estimated at ~4 characters per token.

Built-in pricing table (per 1M tokens):

| Model | Input | Output |
|-------|-------|--------|
| claude-sonnet-4.6 | $3.00 | $15.00 |
| claude-haiku-4.5 | $0.80 | $4.00 |
| claude-opus-4.6 | $15.00 | $75.00 |
| gpt-4o | $2.50 | $10.00 |
| gpt-4o-mini | $0.15 | $0.60 |
| gemini-2.0-flash | $0.075 | $0.30 |
| (default) | $1.00 | $5.00 |

### Batch Processing

Screening uses batch processing with configurable concurrency (default: 3 concurrent). Deep analysis runs sequentially with a 2-second delay between calls to respect rate limits.

## V2 Analysis Pipeline (4-Stage)

**Source file:** `src/lib/ai/pipeline-v2.ts`

The V2 pipeline runs after keyword and competitor data has been collected. It performs 4 sequential AI analysis stages, each building on the context from previous stages.

### Context Assembly

Before running AI stages, `buildContext()` assembles all available data:
- Idea title, description, source metrics
- Keywords with SEO metrics (search volume, difficulty, CPC)
- SERP snapshots (top ranking pages, SERP features)
- Competitor data (domains, traffic estimates)
- Monetization signals (pricing pages, ads, affiliate indicators)

### Stage 1: SEO Analysis

**Prompt:** Analyze traffic acquisition potential based on keyword data and SERP landscape.

**Output:**
```json
{
  "trafficScore": 72,
  "keywordStrategy": "Long-tail focus on 'ai code review for teams'",
  "contentPlan": "Technical blog posts targeting comparison keywords",
  "serpOpportunity": "Low competition for informational queries"
}
```

### Stage 2: Competitor Analysis

**Prompt:** Evaluate market structure and competitive intensity.

**Output:**
```json
{
  "competitionIntensity": 65,
  "topCompetitors": ["CodeRabbit", "Codacy"],
  "marketGaps": "No competitor focuses on team-level workflow",
  "differentiationAngle": "AI-native with natural language feedback"
}
```

### Stage 3: Monetization Analysis

**Prompt:** Assess revenue model viability based on competitor signals.

**Output:**
```json
{
  "monetizationScore": 68,
  "recommendedModel": "freemium SaaS with team pricing",
  "pricingRange": "$15-49/user/month",
  "revenueTimeline": "6-12 months to first revenue"
}
```

### Stage 4: Recommendation

**Prompt:** Synthesize all analyses into an actionable recommendation.

**Output:**
```json
{
  "verdict": "go",
  "productForm": "VS Code extension + web dashboard",
  "mvpFeatures": ["PR review", "security scanning", "style checks"],
  "trafficStrategy": "Content marketing targeting comparison keywords",
  "monetizationPath": "Free tier -> team plan at $29/user/month",
  "risks": ["OpenAI dependency", "Enterprise sales cycle"],
  "reasoning": "Strong keyword opportunity with viable monetization..."
}
```

Verdict values: `strong_go`, `go`, `cautious`, `skip`

### Opportunity Score Calculation

After all 4 stages complete, the opportunity score is calculated using a **weighted geometric mean**:

```
opportunityScore = (traffic/100)^0.4 × (monetization/100)^0.35 × (execution/100)^0.25 × 100
```

This multiplication model ensures all three dimensions must be viable -- a zero in any dimension produces a low overall score.

### Graceful Degradation

If any AI stage fails:
- Default scores (50) are used for the failed stage
- The pipeline continues with remaining stages
- Results are still saved with whatever data was obtained

## Prompt Engineering

### V1 Prompts

Prompts are defined in `src/lib/ai/prompts.ts`. Both V1 prompts:

- Request **JSON-only output** to enable reliable parsing
- Include **scoring guidelines** to ensure consistent evaluation
- Provide **category/enum constraints** for structured responses
- Support a **JSON extraction fallback** that handles markdown code blocks

The JSON parser (`parseJSON()`) in `analyzer.ts` handles two response formats:
1. Raw JSON string
2. JSON wrapped in markdown code blocks (`` ```json ... ``` ``)

### V2 Prompts

V2 prompts are defined inline in `src/lib/ai/pipeline-v2.ts`. They:

- Are written in **Chinese** for consistency with the target user base
- Include the full assembled context (keywords, SERP data, competitors, signals)
- Request structured JSON output with specific field names
- Each stage prompt references results from previous stages for coherent analysis
