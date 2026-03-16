# Product Design

## Vision

IdeaRadar is a personal intelligence tool for indie developers who want to systematically discover, evaluate, and rank product ideas from across the internet -- replacing ad-hoc browsing with data-driven decision-making.

## Target User

Solo developers and small teams who:
- Build tool/SaaS products powered by AI
- Need a structured way to find ideas worth building
- Want to minimize time spent on manual research
- Prefer local-first tools with low operational overhead

## Core User Journey

```
Discover  ──▶  Screen  ──▶  Analyze  ──▶  Rank  ──▶  Decide
   │              │             │            │           │
   │  Automated   │   Fast AI   │  Deep AI   │  Scoring  │  Human
   │  collection  │  screening  │  analysis  │  engine   │  judgment
   │  from web    │  (Haiku)    │  (Sonnet)  │           │
```

## Feature Breakdown

### 1. Dashboard

The entry point providing an at-a-glance overview:

- **KPI Cards** - Total ideas, analyzed count, sources online, new this week
- **Quick Actions** - One-click data collection and analysis triggers
- **Top Ideas** - Recent high-scoring ideas for immediate review

### 2. Ideas Explorer

A filterable, sortable table for browsing all collected ideas:

- **Filters** - By source (HN, PH), rank (S/A/B/C/D), category, text search
- **Sorting** - By final score, trend score, discovery date, source score
- **Pagination** - Configurable page size, up to 100 per page
- **Score Badges** - Color-coded rank indicators (S=purple, A=blue, B=green, C=yellow, D=gray)

### 3. Idea Detail

Deep-dive view for individual ideas:

- **Radar Chart** - 5-dimension visual comparison (trend, demand, competition, feasibility, growth)
- **Trend Line** - Historical score evolution over time
- **AI Analysis** - Pain point, target users, core features, competitors
- **Recommendation** - Go / Cautious / Stop with reasoning
- **Source Link** - Direct link to original discussion

### 4. Settings

Full runtime configuration without code changes:

- **AI Models** - Provider, model name, API key for both screening and analysis
- **Parameters** - Temperature, daily budget cap
- **Data Sources** - Enable/disable HN, Product Hunt, Google Trends
- **Scheduler** - Collection and analysis intervals (cron expressions)

## Scoring Methodology

### Dimension Definitions

| Dimension | Weight | What It Measures | Score Source |
|-----------|--------|-----------------|-------------|
| **Trend** | 30% | Current market momentum and community interest | Source metrics (upvotes, comments) + recency boost |
| **Demand** | 25% | How strongly users need this solution | AI analysis of pain point intensity and market size |
| **Competition** | 20% | Opportunity in the competitive landscape | AI assessment of existing competitors and differentiation potential |
| **Feasibility** | 15% | How achievable the idea is to build | AI evaluation of technical complexity and MVP timeline |
| **Growth** | 10% | Potential for viral/organic growth at scale | AI prediction of scalability and distribution potential |

### Ranking Tiers

| Rank | Score Range | Interpretation |
|------|------------|----------------|
| **S** | >= 85 | Exceptional opportunity, strong signal across all dimensions |
| **A** | 70 - 84 | High potential, worth serious consideration |
| **B** | 55 - 69 | Moderate potential, may need a unique angle |
| **C** | 40 - 54 | Below average, significant challenges identified |
| **D** | < 40 | Low potential based on available data |

### Confidence Score

Each idea also receives a confidence score (0-100%) based on data completeness:

| Data Available | Confidence Contribution |
|---------------|------------------------|
| Base data (title, URL, source) | +20% |
| Source metrics (score > 0) | +15% |
| AI screening (category assigned) | +20% |
| AI deep analysis (pain point + features + full analysis) | +45% |

A low confidence score means the ranking may not be reliable -- more data or analysis is needed.

### Trend Score Algorithm

The trend score has source-specific calculations:

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
| AI Screening | category, aiSummary, aiTargetUsers | Screening AI |
| AI Analysis | aiPainPoint, aiFeatures, aiCompetitors, aiTechFeasibility | Analysis AI |
| Scores | trendScore, demandScore, competitionScore, feasibilityScore, growthScore | Scoring Engine |
| Ranking | finalScore, rankCategory, confidence | Scoring Engine |
| Timestamps | discoveredAt, analyzedAt, createdAt, updatedAt | System |

## Future Roadmap

- **Google Trends integration** - Correlation with search trend data
- **Reddit collector** - r/startups, r/SideProject, r/indiehackers
- **Twitter/X collector** - Product launch announcements
- **Export functionality** - CSV/JSON export of filtered ideas
- **Comparison mode** - Side-by-side idea comparison
- **Custom scoring weights** - User-adjustable dimension weights via UI
- **Notification system** - Alerts for S-rank discoveries
- **Idea notes** - Personal annotations on individual ideas
