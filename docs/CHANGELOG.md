# Changelog

All notable changes to IdeaRadar are documented in this file.

## [2.1.0] - 2026-03-21

### Added
- Five-dimensional market validation scoring (demand/pain/pay/buildFit/competitionRisk) for site research
- Four-route evidence framework (help-seeking, alternative-seeking, complaints, transaction intent) for demand signal detection
- Counter-evidence analysis with kill criteria and devil's advocate reasoning
- Soft-gate verification status (validated/conditional/needs_evidence/skip) with confidence levels
- Radar chart component (`five-dim-radar.tsx`) for five-dimensional score visualization
- Verification status banner on idea detail page for V2 recommendations
- Counter-evidence card on idea detail page showing failure risks and kill criteria

### Changed
- Site research AI analysis expanded from 7 to 11 dimensions
- V2 recommendation prompt now requests counter-evidence and verification status
- V2 `OpportunityRecommendation` interface extended with `counterEvidence` and `verificationStatus` fields

**Commit:** `d92bcac` -- feat: integrate xhs-needs-mining methodology into analysis system

## [2.0.2] - 2026-03-20

### Changed
- Crawler rewritten with multi-strategy content extraction (inspired by agent-fetch)
  - Strategy 1: Mozilla Readability (preferred for articles)
  - Strategy 2: CSS selector probing (common content selectors)
  - Strategy 3: JSON-LD structured data extraction
  - Strategy 4: Next.js `__NEXT_DATA__` extraction
  - Strategy 5: Full-page regex fallback
- Best candidate selection based on content length and method priority

### Added
- `@mozilla/readability`, `linkedom`, `turndown` dependencies for server-side content extraction
- `turndown.d.ts` type declarations for TypeScript compatibility

**Commit:** `ef7df58` -- feat: upgrade crawler with multi-strategy extraction

## [2.0.1] - 2026-03-20

### Added
- Site Research module (`/research` page)
- Website crawler with subpage discovery (/about, /pricing, /features)
- AI-powered site analysis with product overview, user persona, business model, SWOT
- Site research API endpoints (POST/GET `/api/site-research`, GET `/api/site-research/[id]`)
- `site_researches` database table for storing crawl and analysis results

**Commit:** `24da08f` -- feat: add site research - AI-powered website analysis

## [2.0.0] - 2026-03-19

### Added
- V2 analysis pipeline: 4-stage AI analysis (SEO -> Competitor -> Monetization -> Recommendation)
- Keyword intelligence: automated extraction, expansion (DataForSEO), SEO metrics enrichment
- Competitor discovery from SERP results with monetization signal detection
- Opportunity score: weighted geometric mean `(Traffic^0.4 x Monetization^0.35 x Execution^0.25) x 100`
- Keywords browser page (`/keywords`) with search, sort, and color-coded difficulty
- Budget management with daily/monthly/per-API spending limits
- Multi-layer cache (Memory LRU + SQLite) for API cost reduction
- V2-specific database tables: keywords, keyword_clusters, serp_snapshots, competitors, monetization_signals, idea_keywords, api_cache, api_cost_logs
- V2 fields on ideas table: trafficScore, monetizationScore, executionScore, opportunityScore, SEO data fields
- Opportunity lifecycle: discovered -> screening -> seo_validated -> analyzed -> actionable -> archived

### Changed
- Dashboard updated with V2 analysis trigger and API cost overview
- Idea detail page redesigned with V2 opportunity scores, SEO data, and AI recommendations
- Ranking now uses V2 opportunityScore when available (V1 finalScore as fallback)

**Commit:** `994eca2` -- feat: implement IdeaRadar V2

## [1.0.1] - 2026-03-18

### Fixed
- Mobile layout responsiveness (dashboard, ideas list, detail page)
- Toast feedback for user actions (sonner integration)
- Badge redesign with consistent color scheme
- N+1 query fix in ideas listing

**Commit:** `94b9cb5` -- fix: address review issues

## [1.0.0] - 2026-03-17

### Added
- Multi-source data collection (Hacker News, Product Hunt)
- Two-stage AI analysis pipeline (screening + deep analysis)
- 5-dimension scoring: Trend, Demand, Competition, Feasibility, Growth
- S/A/B/C/D ranking tiers
- Configurable AI providers (OpenRouter, OpenAI, Anthropic, Google, custom)
- Settings page for runtime configuration
- Dashboard with KPI cards and quick actions
- Ideas explorer with filtering, sorting, and pagination
- Idea detail page with radar chart and trend line
- AI cost tracking with per-model breakdown
- Cron-based scheduler for automated collection and analysis
- Local-first SQLite database with Drizzle ORM

### Fixed
- AI gateway URL normalization to prevent double `/chat/completions` path
- AI 401 auth error resolution with proper header formatting
- Chinese localization for all UI text

**Commits:** `8a4be18` through `8fce71b`
