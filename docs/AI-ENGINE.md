# AI Engine

## Overview

IdeaRadar uses a multi-stage AI pipeline to evaluate product ideas and analyze websites. The system has three analysis modes:

1. **V1 Pipeline** -- Screening + deep analysis for idea scoring
2. **V2 Pipeline** -- 5-stage SEO-driven analysis with strategy evaluation, counter-evidence and verification
3. **Site Research** -- 11-dimension website analysis with xhs-needs-mining methodology

The system is provider-agnostic -- any OpenAI-compatible chat completions endpoint works.

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
┌──────────┐    ┌──────────────────────┐    │ ai_cost_logs │
│  Ideas+  │───▶│   V2 Pipeline        │    └──────────────┘
│  Keywords│    │  runV2Analysis()     │───▶  AI Provider
│  +Comps  │    │  (4-stage)           │
└──────────┘    └──────────────────────┘

┌──────────┐    ┌──────────────────────┐
│  Crawled │───▶│   Site Analyzer      │───▶  AI Provider
│  Content │    │  analyzeSite()       │
└──────────┘    │  (11-dimension)      │
                └──────────────────────┘
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

## V1 Two-Stage Pipeline

**Source file:** `src/lib/ai/analyzer.ts`, `src/lib/ai/prompts.ts`

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

## V2 Five-Stage Pipeline

**Source file:** `src/lib/ai/pipeline-v2.ts`

The V2 pipeline runs after keyword and competitor data has been collected. It performs 5 sequential AI analysis stages, each building on the context from previous stages. V2.2 added the Strategy & Productization Analysis stage, integrating a five-strategy discovery methodology (forums, keywords, competitor gaps, shadow cloning, service productization).

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
  "targetKeywords": [{"keyword": "...", "priority": "high", "reason": "..."}],
  "contentStrategy": ["Content strategy items"],
  "competitionLevel": "medium",
  "competitorWeaknesses": ["Weakness 1"],
  "estimatedMonthlyTraffic": 5000,
  "seoDifficulty": 45,
  "trafficScore": 72
}
```

**Scoring Criteria:**
- 90+: High volume (>10K/month), low difficulty (<30), high CPC
- 70-89: Medium volume (1K-10K), moderate difficulty (30-50)
- 50-69: Traffic opportunity exists but competition is high or volume is low
- <50: Traffic acquisition is difficult

### Stage 2: Competitor Analysis

**Prompt:** Evaluate market structure and competitive intensity.

**Output:**
```json
{
  "marketStructure": "fragmented",
  "topCompetitors": [{"name": "...", "domain": "...", "strengths": [], "weaknesses": []}],
  "trafficChannels": [{"channel": "organic_search", "viability": "high"}],
  "differentiationOpportunities": ["Opportunity 1"],
  "competitionIntensity": 65
}
```

### Stage 3: Monetization Analysis

**Prompt:** Assess revenue model viability based on competitor signals and CPC data.

**Output:**
```json
{
  "recommendedModel": "freemium",
  "reasoning": "Why this model is recommended",
  "pricingStrategy": {"primary": "$29/mo", "tiers": ["$9/mo basic", "$29/mo pro"]},
  "alternativeRevenue": ["Affiliate", "API access"],
  "breakEvenTraffic": 1000,
  "monetizationScore": 68
}
```

**Scoring Criteria:**
- 90+: High CPC (>$5), proven willingness to pay, clear pricing space
- 70-89: Medium CPC ($1-5), validated monetization model
- 50-69: Low CPC or unclear monetization path
- <50: Monetization is difficult

### Stage 4: Strategy & Productization Analysis (V2.2)

**Prompt:** Classify the idea's discovery strategy, evaluate service productization (SOAP) potential, identify shadow clone opportunities, and score on a 5-circle validation model.

This stage integrates the "five-strategy discovery methodology":

| Strategy | Key | Description |
|----------|-----|-------------|
| A | `community_pain` | Forum/community pain points (Reddit, HN, PH) |
| B | `keyword_opportunity` | Search trends and keyword demand (Google Trends, SEO) |
| C | `competitor_gap` | Competitive gaps found via 1-star reviews, pricing analysis |
| D | `shadow_clone` | Improving existing successful products ("精准剪裁+痛点补洞") |
| E | `service_productization` | Automating Fiverr/Upwork manual services into SaaS (SOAP model) |

**Output:**
```json
{
  "discoveryStrategy": {
    "primary": "service_productization",
    "secondary": "shadow_clone",
    "reasoning": "Why this strategy classification"
  },
  "soapEvaluation": {
    "hasExistingService": true,
    "serviceExamples": ["Fiverr Logo Design", "Upwork Brand Identity"],
    "processSteps": ["Step 1: Collect requirements", "Step 2: Generate designs", "Step 3: Deliver assets"],
    "automationPotential": 85,
    "automationApis": ["OpenAI API", "Canva API", "Replicate"],
    "packagingModel": "tiered",
    "soapScore": 82
  },
  "shadowClone": {
    "bestTarget": "Competitor X",
    "targetWeaknesses": ["Expensive pricing", "Poor mobile experience"],
    "differentiationAngle": "AI-first approach with 10x speed",
    "cloneComplexity": "medium",
    "estimatedAdvantage": "5x faster delivery at 1/3 price"
  },
  "fiveCircleValidation": {
    "marketDemand": 8,
    "toolFeasibility": 7,
    "differentiation": 6,
    "businessViability": 8,
    "personalFit": 7
  }
}
```

**SOAP Model (Screen -> Optimize -> Automate -> Package):**

| Phase | What to Do | Validation Criteria |
|-------|-----------|-------------------|
| Screen | Find Fiverr services with 300+ monthly orders | Service steps can be decomposed into <= 5 standard steps |
| Optimize | Analyze service workflow, find automatable 80% | 80% of process achievable with API/tools |
| Automate | Build with vibe coding + APIs | End-to-end flow works from submission to delivery |
| Package | SaaS product with subscription pricing | 3-5 paying users, monthly retention >= 60% |

**SOAP Score Criteria:**
- 80+: High-frequency service exists with 80%+ automation potential (e.g., Looka = Logo design)
- 50-79: Service exists but automation has some challenges
- 30-49: Service exists but low automation ratio
- <30: No clear service benchmark or hard to productize

**Five-Circle Validation (0-10 each):**
- Market Demand: Pain intensity x user scale
- Tool Feasibility: Can be built with existing tech stack (AI API + low-code)
- Differentiation: Unique angle vs competitors
- Business Viability: Willingness to pay x pricing space x retention
- Personal Fit: Solo dev / small team can execute (tech + ops + acquisition)

**DB Fields Updated:** `discoveryStrategy`, `automationPotential`, `aiStrategyAnalysis` (JSON)

### Stage 5: Recommendation (with Counter-Evidence)

**Prompt:** Synthesize all analyses (including strategy data) into an actionable recommendation with devil's advocate analysis. Now enhanced with strategy context: discovery strategy classification, SOAP score, automation potential, shadow clone target, differentiation angle, and five-circle validation scores.

**Output:**
```json
{
  "verdict": "go",
  "productForm": "VS Code extension + web dashboard",
  "mvpFeatures": ["PR review", "security scanning", "style checks"],
  "trafficStrategy": "Content marketing targeting comparison keywords",
  "monetizationPath": "Free tier -> team plan at $29/user/month",
  "timeToMvp": "6-8 weeks",
  "risks": ["OpenAI dependency", "Enterprise sales cycle"],
  "reasoning": "Strong keyword opportunity with viable monetization...",
  "counterEvidence": {
    "failure_reasons": ["Market saturation in AI code review space", "Long enterprise sales cycles"],
    "kill_criteria": ["<500 organic visits/month after 3 months", "<2% trial-to-paid conversion"],
    "counter_arguments": ["GitHub Copilot could add native review features"]
  },
  "verificationStatus": {
    "status": "conditional",
    "reasoning": "Traffic and monetization signals are strong, but execution risk from competition",
    "confidence_level": 72
  }
}
```

**Verdict Values:**

| Verdict | Criteria |
|---------|---------|
| `strong_go` | Traffic + monetization + execution all strong; verification = validated |
| `go` | Overall positive, some risks to watch; verification = validated or conditional |
| `cautious` | Opportunity exists but significant risks; verification = conditional or needs_evidence |
| `skip` | Hard blockers in traffic or monetization; verification = skip |

**Counter-Evidence Requirements:**
- `failure_reasons`: Specific, concrete reasons (not generic platitudes)
- `kill_criteria`: Must be quantifiable and time-bound (e.g., "MVP 3-month organic traffic < 500/month")
- `counter_arguments`: The strongest case against pursuing this opportunity

### Opportunity Score Calculation

After all 5 stages complete, the opportunity score is calculated using a **weighted geometric mean**:

```
opportunityScore = (traffic/100)^0.4 x (monetization/100)^0.35 x (execution/100)^0.25 x 100
```

Where `execution = 100 - competitionIntensity`.

This multiplication model ensures all three dimensions must be viable -- a zero in any dimension produces a low overall score.

### Graceful Degradation

If any AI stage fails:
- Default scores (50) are used for the failed stage
- The pipeline continues with remaining stages
- Results are still saved with whatever data was obtained

## Site Research Analysis (11-Dimension)

**Source file:** `src/lib/research/analyzer.ts`

The site research module performs comprehensive AI-powered analysis of any website using 11 analytical dimensions. This integrates the xhs-needs-mining methodology for rigorous opportunity validation.

### Input

Crawled website content assembled by `buildPrompt()`:
- Main page + up to 4 subpages (markdown format)
- Site metadata (OG tags, JSON-LD, tech signals)
- Total content truncated to 40KB for context window

### 11 Analysis Dimensions

| # | Dimension | Output Field | Description |
|---|-----------|-------------|-------------|
| 1 | Product Overview | `overview` | Name, one-liner, category, core value, problem solved |
| 2 | Product Design | `productDesign` | Core features, user flow, tech stack guess, design highlights |
| 3 | User Persona | `userPersona` | Primary/secondary audience, use cases, needs, journey |
| 4 | Business Model | `businessModel` | Monetization, pricing strategy, revenue streams, market size |
| 5 | Strengths | `strengths` | 3-5 specific advantages with reasoning |
| 6 | Weaknesses | `weaknesses` | 3-5 specific issues with impact and improvement direction |
| 7 | Market Opportunities | `opportunities` | Market gaps, improvements, startup inspirations |
| 8 | Five-Dimensional Scores | `fiveDimensionalScores` | Independent 0-10 scores for demand/pain/pay/buildFit/competitionRisk |
| 9 | Four-Route Evidence | `evidenceFramework` | Help-seeking, alternative-seeking, complaints, transaction intent signals |
| 10 | Counter-Evidence | `counterEvidence` | Failure reasons, kill criteria, counter arguments, validation plan |
| 11 | Verification Status | `verificationStatus` | Validated/conditional/needs_evidence/skip with confidence level |

### Five-Dimensional Market Validation (Dimension 8)

Each dimension is scored independently on a 0-10 scale:

| Dimension | Score 9-10 | Score 7-8 | Score 4-6 | Score 1-3 |
|-----------|-----------|-----------|-----------|-----------|
| **Demand** | High-frequency must-have, heavy search volume | Mid-high frequency, clear scenarios | Exists but not urgent | Low-frequency or pseudo-need |
| **Pain** | Severely impacts efficiency, users urgently need a solution | Noticeable pain, willing to try solutions | Inconvenient but acceptable | Mild dissatisfaction |
| **Pay** | High ticket (>$100/mo), validated | Medium ($20-100/mo), precedent exists | Low price or freemium | Hard to monetize |
| **Build Fit** | 2-4 week MVP, no special requirements | 1-3 months, moderate complexity | 3-6 months, needs specialized skills | Needs large team or special resources |
| **Competition Risk** | Red ocean, monopoly/oligopoly | Intense but differentiation possible | Fragmented, no clear leader | Blue ocean or emerging market |

### Four-Route Evidence Framework (Dimension 9)

Searches for 4 types of demand signals in crawled content:

| Route | Signal Type | Examples |
|-------|-----------|---------|
| **Help-seeking** | Users actively seeking solutions | "How to...", "Need help with...", "Recommend a..." |
| **Alternative-seeking** | Users looking for alternatives | "Alternative to X", "Better than X", "Migrating from X" |
| **Complaints** | Dissatisfaction with current solutions | Negative reviews, feature gaps, UX issues |
| **Transaction intent** | Willingness to pay | Pricing pages, purchase inquiries, plan comparisons |

Each route includes: signals list, strength (strong/moderate/weak/none), concrete examples.

### Counter-Evidence & Kill Criteria (Dimension 10)

Devil's advocate analysis requiring specific, actionable insights:

- **Failure reasons** (3-5): Concrete reasons this product might fail
- **Kill criteria** (3-5): Quantifiable conditions to abandon the project
- **Counter arguments**: Facts that could invalidate the opportunity
- **Validation plan**: Next steps, critical assumptions, timeline

### Verification Status (Dimension 11)

Final judgment based on all preceding analysis:

| Status | Criteria |
|--------|---------|
| `validated` | Most dimensions >= 7, 3+ evidence routes strong/moderate, opportunity > risk |
| `conditional` | Has strengths but needs specific conditions met; partial evidence coverage |
| `needs_evidence` | Signals unclear, lacking key evidence; most scores < 6 |
| `skip` | Clear hard blockers; counter-evidence stronger than positive evidence |

Includes confidence level (0-100) and list of evidence gaps.

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
  analysis_type TEXT,   -- 'screening', 'deep', 'seo', 'competitor', 'monetization', 'strategy', 'recommendation', 'site-research'
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
- Stage 4 (strategy) evaluates discovery strategy, SOAP potential, shadow clone targets, and 5-circle validation
- Stage 5 (recommendation) includes strategy context, counter-evidence and verification requirements with detailed rubrics

### Site Research Prompts

Site research prompts are built in `src/lib/research/analyzer.ts`. They:

- Include **all 11 dimensions** with detailed rubrics and examples
- Provide **complete JSON schema** as output template
- Include **scoring criteria** for five-dimensional validation
- Require **concrete examples** for evidence framework
- Enforce **quantifiable** kill criteria in counter-evidence
- Content truncated to **40KB** to fit within context window
