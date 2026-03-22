# Product Design

## Vision

IdeaRadar is a **business opportunity verification engine** for indie developers. It goes beyond idea discovery to validate whether a product idea has real traffic acquisition potential, viable monetization paths, and achievable execution scope -- helping developers make confident build-or-skip decisions backed by data, not gut feeling.

**Core philosophy:** Find "traffic-product combinations" -- ideas where there's provable search demand AND a viable way to capture and monetize that traffic.

## Target User

Solo developers and small teams who:
- Build tool/SaaS products powered by AI
- Need a structured way to find AND validate ideas worth building
- Want SEO-driven evidence before committing development time
- Prefer local-first tools with low operational overhead

## Core User Journeys

### Journey 1: Idea Discovery Pipeline (V1 -> V2 -> V2.2)
```
Discover ──▶ Screen ──▶ SEO Validate ──▶ Competitor Scan ──▶ Monetize Check ──▶ Strategy Eval ──▶ AI Verdict ──▶ Action
   │            │            │                  │                  │                 │                │            │
   │ Automated  │  Fast AI   │  Keyword data    │  SERP analysis   │  Pricing/ads    │ 5-Strategy     │ 5-stage    │ Build
   │ collection │  screening │  Volume/CPC/KD   │  Real players    │  detection      │ SOAP + Clone   │ pipeline   │ or Skip
   │ from web   │  (Haiku)   │  (DataForSEO)    │  (SERP APIs)     │                 │ 5-Circle Valid │ (Sonnet)   │
```

### Journey 2: Site Research (Competitor/Product Analysis)
```
Input URL ──▶ Crawl Site ──▶ AI Analysis ──▶ Review Results ──▶ Decide
   │              │                │                │               │
   │ Any website  │ Multi-strategy │ 11-dimension   │ Scores +      │ Validate
   │ URL          │ extraction     │ deep analysis  │ Evidence +    │ or pivot
   │              │ (5 strategies) │ (xhs method)   │ Kill criteria │
```

### Opportunity Lifecycle
```
discovered ──▶ screening ──▶ seo_validated ──▶ analyzed ──▶ actionable ──▶ archived
```

## Feature Breakdown

### 1. Dashboard

The entry point providing an at-a-glance overview:

- **KPI Cards** -- Total ideas, analyzed count, sources online, new this week
- **Quick Actions** -- One-click data collection, V1 analysis, and V2 deep analysis triggers
- **API Cost Overview** -- Today/month spend, per-API breakdown (AI, DataForSEO, SerpAPI)
- **Top Ideas** -- Recent high-scoring ideas for immediate review

### 2. Ideas Explorer

A filterable, sortable table for browsing all collected ideas:

- **Filters** -- By source (HN, PH), rank (S/A/B/C/D), category, text search
- **Sorting** -- By final score, opportunity score, trend score, discovery date, source score
- **Pagination** -- Configurable page size, up to 100 per page
- **Score Badges** -- Color-coded rank indicators (S=purple, A=blue, B=green, C=yellow, D=gray)

### 3. Idea Detail

Deep-dive view for individual ideas:

- **V2 Opportunity Score** -- Traffic, Monetization, Execution scores with verdict badge
- **SEO Keyword Data** -- Primary keyword, search volume, difficulty, CPC, competitor count
- **AI Recommendation** -- Product form, MVP features, traffic strategy, monetization path, risks
- **Verification Status** -- Color-coded banner (validated/conditional/needs_evidence/skip) with confidence level
- **Counter-Evidence** -- Failure risks, kill criteria (STOP badges), counter arguments
- **Discovery Strategy Classification** (V2.2) -- Badge-labeled strategy (A-E) with reasoning + 5-circle validation progress bars
- **SOAP Evaluation** (V2.2) -- Service productization score, automation potential bar, process steps, API suggestions
- **Shadow Clone Analysis** (V2.2) -- Best competitor target, weaknesses, differentiation angle, complexity badge
- **V2 Analysis Trigger** -- One-click "Run V2 Analysis" button per idea
- **Radar Chart** -- 5-dimension visual comparison (trend, demand, competition, feasibility, growth)
- **Trend Line** -- Historical score evolution over time
- **V1 AI Analysis** -- Pain point, target users, core features, competitors
- **Source Link** -- Direct link to original discussion

### 4. Keywords Browser (V2)

Dedicated keyword intelligence page:

- **Search** -- Full-text search across all discovered keywords
- **Filters** -- Minimum volume, maximum difficulty
- **Sorting** -- By search volume, difficulty, CPC, keyword name
- **Stats Cards** -- Total keywords, average volume, average difficulty
- **Color-Coded Difficulty** -- Green (easy <30), yellow (medium 30-70), red (hard >70)
- **Pagination** -- Configurable page size

### 5. Site Research

AI-powered website analysis for competitor research and product teardowns:

- **URL Input** -- Enter any website URL to start analysis
- **Crawl Status** -- Real-time progress indicator (crawling -> analyzing -> completed)
- **Product Overview** -- Name, one-liner, category, core value, problem solved
- **Verification Status Banner** -- Color-coded gradient card (green/yellow/blue/red) with confidence badge
- **Five-Dimensional Scores** -- 5 circular score indicators (demand/pain/pay/buildFit/competitionRisk) + radar chart
- **Product Design Analysis** -- Core features, user flow, tech stack, design highlights
- **User Persona** -- Primary/secondary audience, use cases, user needs
- **Business Model** -- Monetization, pricing strategy, revenue streams, market size
- **Strengths & Weaknesses** -- Detailed analysis with specific reasoning
- **Four-Route Evidence Framework** -- 2x2 grid with strength badges for help-seeking, alternative-seeking, complaints, transaction intent
- **Counter-Evidence & Kill Criteria** -- Failure reasons, quantifiable stop criteria, counter arguments, validation plan
- **Market Opportunities** -- Market gaps, improvements, startup inspirations
- **Research History** -- List of previously analyzed sites

### 6. Settings

Full runtime configuration without code changes:

- **AI Models** -- Provider, model name, API key for both screening and analysis
- **API Base URL** -- Shared endpoint for AI providers
- **Parameters** -- Temperature, daily budget cap
- **SEO APIs (V2)** -- DataForSEO login/password, SerpAPI key
- **Data Sources** -- Enable/disable HN, Product Hunt, Google Trends
- **Scheduler** -- Collection and analysis intervals (cron expressions)

## Scoring Methodology

### V1 Scoring: Weighted Additive

| Dimension | Weight | What It Measures | Score Source |
|-----------|--------|-----------------|-------------|
| **Trend** | 30% | Current market momentum and community interest | Source metrics (upvotes, comments) + recency boost |
| **Demand** | 25% | How strongly users need this solution | AI analysis of pain point intensity and market size |
| **Competition** | 20% | Opportunity in the competitive landscape | AI assessment of existing competitors and differentiation potential |
| **Feasibility** | 15% | How achievable the idea is to build | AI evaluation of technical complexity and MVP timeline |
| **Growth** | 10% | Potential for viral/organic growth at scale | AI prediction of scalability and distribution potential |

### V2 Scoring: Weighted Geometric Mean (Multiplication Model)

| Dimension | Weight | What It Measures | Score Source |
|-----------|--------|-----------------|-------------|
| **Traffic** | 40% | Can you actually acquire users through search? | SEO keyword analysis: search volume, difficulty, competition, SERP opportunity |
| **Monetization** | 35% | Can you make money from this? | Competitor monetization signals + AI assessment of revenue models |
| **Execution** | 25% | Can you realistically build and launch this? | AI evaluation of MVP scope, tech feasibility, time-to-market |

**Formula:** `Score = (Traffic/100)^0.4 x (Monetization/100)^0.35 x (Execution/100)^0.25 x 100`

The multiplication model is key -- unlike V1's additive approach, a near-zero score in any V2 dimension drags the entire opportunity score down. This prevents "false positives" where great traffic potential masks zero monetization viability.

### Five-Dimensional Market Validation (Site Research)

Independent 0-10 scores for five dimensions, inspired by the xhs-needs-mining methodology:

| Dimension | What It Measures |
|-----------|-----------------|
| **Demand** (demand_score) | Frequency and urgency of the need |
| **Pain** (pain_score) | Severity of the problem being solved |
| **Pay** (pay_score) | Willingness and ability to pay |
| **Build Fit** (build_fit_score) | Development feasibility and timeline |
| **Competition Risk** (competition_risk_score) | Market saturation and competitive barriers |

These are deliberately **not combined** into a single score. Each dimension tells a different story, and the radar chart visualization makes it easy to spot dimensional imbalances.

### Ranking Tiers

| Rank | Score Range | Interpretation |
|------|------------|----------------|
| **S** | >= 85 | Exceptional opportunity, strong signal across all dimensions |
| **A** | 70 - 84 | High potential, worth serious consideration |
| **B** | 55 - 69 | Moderate potential, may need a unique angle |
| **C** | 40 - 54 | Below average, significant challenges identified |
| **D** | < 40 | Low potential based on available data |

V2 `opportunityScore` is used for ranking when available. V1 `finalScore` is used as fallback for ideas that haven't been V2-analyzed yet.

### Confidence Score

Each idea receives a confidence score (0-100%) based on data completeness:

| Data Available | Confidence Contribution |
|---------------|------------------------|
| Base data (title, URL, source) | +10% |
| Source metrics (score > 0) | +10% |
| AI screening (category assigned) | +10% |
| AI deep analysis (pain point + features) | +20% |
| SEO validation (primary keyword + search volume) | +20% |
| V2 analysis (SEO + competitor + monetization analysis) | +30% |

### Trend Score Algorithm

Source-specific calculations:

**Hacker News:**
- Base: `min(sourceScore / 500, 1.0) * 100 * 0.7` (upvotes, capped at 500)
- Comments: `min(sourceComments / 100, 1.0) * 100 * 0.3`
- Recency: Up to 50% boost for ideas < 7 days old

**Product Hunt:**
- Base: `min(sourceScore / 200, 1.0) * 100 * 0.8`
- Comments: `min(sourceComments / 50, 1.0) * 100 * 0.2`
- Recency: Same 7-day boost formula

## Data Model

Each idea tracks:

| Field Group | Fields | Source |
|------------|--------|--------|
| Identity | title, description, url | Collection |
| Source Metadata | source, sourceId, sourceScore, sourceComments | Collection |
| Lifecycle | status (discovered/screening/seo_validated/analyzed/actionable/archived) | System |
| AI Screening | category, aiSummary, aiTargetUsers | V1 Screening AI |
| AI Analysis | aiPainPoint, aiFeatures, aiCompetitors, aiTechFeasibility | V1 Analysis AI |
| V1 Scores | trendScore, demandScore, competitionScore, feasibilityScore, growthScore | V1 Scoring Engine |
| SEO Data | primaryKeyword, targetSearchVolume, targetKeywordDifficulty, targetCpc, estimatedTraffic, competitorCount | V2 Keyword Pipeline |
| V2 Scores | trafficScore, monetizationScore, executionScore, opportunityScore | V2 AI Pipeline |
| V2 AI Analysis | aiSeoAnalysis, aiCompetitorAnalysis, aiMonetizationAnalysis, aiStrategyAnalysis, aiRecommendation (all JSON) | V2 5-Stage Pipeline |
| V2.2 Strategy | discoveryStrategy, automationPotential | V2 Strategy Analysis Stage |
| Ranking | finalScore (V1), opportunityScore (V2), rankCategory, confidence | Scoring Engine |
| Timestamps | discoveredAt, analyzedAt, seoValidatedAt, createdAt, updatedAt | System |

## Five-Strategy Discovery Methodology (V2.2)

The V2.2 upgrade integrates a comprehensive five-strategy framework for SaaS idea discovery and validation, derived from the methodology article "如何找到并验证有利可图的产品idea".

### Five Discovery Strategies

| Strategy | Code | IdeaRadar Coverage | Method |
|----------|------|-------------------|--------|
| A. Forums/Communities | `community_pain` | HN + PH collectors | Find pain points in community discussions ("I wish there was...", "why isn't there...") |
| B. Keywords/Trends | `keyword_opportunity` | Google Trends + Keyword pipeline + Trend Mining | Discover demand via search volume, rising queries, "alternative to X" patterns |
| C. Competitive Analysis | `competitor_gap` | Site Research + Competitor discovery | Analyze 1-star reviews, pricing gaps, underserved niches |
| D. Shadow Cloning | `shadow_clone` | V2.2 AI analysis stage | Study successful products, find weaknesses, "精准剪裁+痛点补洞" (precision tailoring + pain point patching) |
| E. Service Productization | `service_productization` | V2.2 SOAP evaluation | Turn high-frequency Fiverr/Upwork services into SaaS ("抄热门服务 + 自动化80% + SaaS产品化") |

### SOAP Model (Service Productization)

**Screen -> Optimize -> Automate -> Package**

The SOAP model evaluates whether a product idea could be built by automating an existing manual service:

1. **Screen**: Find Fiverr/Upwork services with 300+ monthly orders
2. **Optimize**: Decompose service into 3-5 standard steps, identify automatable portions
3. **Automate**: Build using AI APIs + low-code tools (target 80% automation)
4. **Package**: Wrap as SaaS with subscription pricing

**Typical Success Stories:**

| Product | Service Benchmark | Automation Highlight | Result |
|---------|------------------|---------------------|--------|
| Looka | Fiverr Logo Design | AI-generated Logo + Brand Kit | Solo founder, 7-figure annual revenue |
| Grammarly | Human Proofreading | Real-time grammar check + writing suggestions | $13B valuation |
| Canva | Designer Outsourcing | Template design + drag-and-drop editor | $40B valuation |
| Calendly | Manual Scheduling | Automated calendar coordination | $100M+ annual revenue |
| Loom | Video Production Outsourcing | One-click recording + auto-share | Acquired by Atlassian |

### Five-Circle Validation Model

Each idea is scored on 5 independent dimensions (0-10):

| Dimension | What It Measures | High Score (7-10) | Low Score (1-4) |
|-----------|-----------------|-------------------|-----------------|
| Market Demand | Pain intensity x user scale | Frequent, urgent need | Rare or weak demand |
| Tool Feasibility | Can be built with AI API + low-code | 2-4 week MVP | Needs large team |
| Differentiation | Unique angle vs competitors | Clear niche advantage | Me-too product |
| Business Viability | Willingness to pay x pricing space | Proven payment model | Hard to monetize |
| Personal Fit | Solo dev can execute (tech + ops) | Full-stack capable | Needs specialized team |

The intersection of all 5 dimensions at high scores = "有利可图的SaaS产品" (profitable SaaS product).

## Future Roadmap

### Near-Term
- **Google Trends integration** -- Correlation with search trend data
- **Reverse discovery** -- Keyword -> product opportunity (find keywords with traffic but no good products)
- **Opportunity snapshot export** -- One-click PDF/image export for sharing
- **Competitor auto-monitoring** -- Track competitor changes over time
- **Keyword trend alerts** -- Notify when tracked keywords spike in volume

### Medium-Term
- **Reddit collector** -- r/startups, r/SideProject, r/indiehackers
- **Twitter/X collector** -- Product launch announcements
- **Social media demand mining** -- Apply xhs-needs-mining methodology to Reddit/Twitter for demand signal extraction
- **Comparison mode** -- Side-by-side idea comparison
- **Custom scoring weights** -- User-adjustable dimension weights via UI
- **Notification system** -- Alerts for S-rank discoveries

### Long-Term
- **Export functionality** -- CSV/JSON export of filtered ideas
- **Idea notes** -- Personal annotations on individual ideas
- **Team collaboration** -- Shared idea evaluation with voting
- **Automated pipeline** -- End-to-end collect -> analyze -> alert without manual triggers
- **Multi-language support** -- English UI option alongside Chinese
