import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// =============================================================================
// V1 Tables (preserved)
// =============================================================================

export const ideas = sqliteTable('ideas', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  url: text('url').unique().notNull(),
  category: text('category'),
  source: text('source').notNull(), // hackernews/producthunt/google_trends
  sourceId: text('source_id').notNull(),
  sourceScore: integer('source_score').default(0),
  sourceComments: integer('source_comments').default(0),

  // Lifecycle status: discovered -> screening -> seo_validated -> analyzed -> actionable -> archived
  status: text('status').notNull().default('discovered'),

  // AI Analysis Results
  aiSummary: text('ai_summary'),
  aiPainPoint: text('ai_pain_point'),
  aiTargetUsers: text('ai_target_users'),
  aiFeatures: text('ai_features'), // JSON array
  aiCompetitors: text('ai_competitors'), // JSON array
  aiTechFeasibility: real('ai_tech_feasibility'),

  // V1 Scores (preserved for backward compat)
  trendScore: real('trend_score').default(0),
  demandScore: real('demand_score').default(0),
  competitionScore: real('competition_score').default(0),
  feasibilityScore: real('feasibility_score').default(0),
  growthScore: real('growth_score').default(0),
  finalScore: real('final_score').default(0),

  // V2 Scores (traffic-product combination)
  trafficScore: real('traffic_score').default(0),
  monetizationScore: real('monetization_score').default(0),
  executionScore: real('execution_score').default(0),
  opportunityScore: real('opportunity_score').default(0), // final V2 score

  // V2 SEO fields
  primaryKeyword: text('primary_keyword'),
  targetSearchVolume: integer('target_search_volume'),
  targetKeywordDifficulty: real('target_keyword_difficulty'),
  targetCpc: real('target_cpc'),
  estimatedTraffic: integer('estimated_traffic'),
  competitorCount: integer('competitor_count'),

  // V2 AI analysis (richer structured output)
  aiSeoAnalysis: text('ai_seo_analysis'), // JSON
  aiCompetitorAnalysis: text('ai_competitor_analysis'), // JSON
  aiMonetizationAnalysis: text('ai_monetization_analysis'), // JSON
  aiRecommendation: text('ai_recommendation'), // JSON

  // Ranking
  rankCategory: text('rank_category'), // S/A/B/C/D
  confidence: real('confidence').default(0),

  // Timestamps
  discoveredAt: text('discovered_at').notNull(),
  analyzedAt: text('analyzed_at'),
  seoValidatedAt: text('seo_validated_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const trendHistory = sqliteTable('trend_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ideaId: text('idea_id').notNull().references(() => ideas.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  source: text('source').notNull(),
  score: real('score').notNull(),
  metadata: text('metadata'), // JSON
});

export const collectionLogs = sqliteTable('collection_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  source: text('source').notNull(),
  status: text('status').notNull(), // success/failed/partial
  itemsCount: integer('items_count').default(0),
  errorMessage: text('error_message'),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
});

export const aiCostLogs = sqliteTable('ai_cost_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  costUsd: real('cost_usd').notNull(),
  ideaId: text('idea_id').references(() => ideas.id),
  analysisType: text('analysis_type'), // screening/deep/seo/competitor/monetization
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// =============================================================================
// V2 New Tables
// =============================================================================

// Keyword data with SEO metrics
export const keywords = sqliteTable('keywords', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  keyword: text('keyword').notNull().unique(),
  language: text('language').notNull().default('en'),
  locationCode: integer('location_code').notNull().default(2840), // US
  searchVolume: integer('search_volume'),
  difficulty: real('difficulty'), // 0-100
  cpc: real('cpc'),
  competition: text('competition'), // LOW/MEDIUM/HIGH
  trend: text('trend'), // JSON: [{month, volume}]
  intent: text('intent'), // informational/commercial/transactional/navigational
  clusterId: integer('cluster_id'),
  dataSource: text('data_source'), // dataforseo/google/ahrefs
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Keyword clusters (grouped by semantic similarity)
export const keywordClusters = sqliteTable('keyword_clusters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  centroidKeyword: text('centroid_keyword'),
  totalVolume: integer('total_volume').default(0),
  avgDifficulty: real('avg_difficulty'),
  avgCpc: real('avg_cpc'),
  keywordCount: integer('keyword_count').default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// SERP snapshots (cached search results)
export const serpSnapshots = sqliteTable('serp_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  keyword: text('keyword').notNull(),
  position: integer('position').notNull(),
  url: text('url').notNull(),
  domain: text('domain').notNull(),
  title: text('title'),
  description: text('description'),
  serpFeatures: text('serp_features'), // JSON: ['featured_snippet', 'people_also_ask']
  snapshotDate: text('snapshot_date').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Competitor domains
export const competitors = sqliteTable('competitors', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  domain: text('domain').notNull().unique(),
  name: text('name'),
  description: text('description'),
  monthlyVisits: integer('monthly_visits'),
  trafficSources: text('traffic_sources'), // JSON: {search: 60, direct: 20, ...}
  topKeywords: text('top_keywords'), // JSON array
  pricingModel: text('pricing_model'), // subscription/one-time/freemium/ads
  priceRange: text('price_range'),
  hasAds: integer('has_ads', { mode: 'boolean' }).default(false),
  techStack: text('tech_stack'), // JSON array
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Monetization signals detected from competitor analysis
export const monetizationSignals = sqliteTable('monetization_signals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  domain: text('domain').notNull(),
  hasPricing: integer('has_pricing', { mode: 'boolean' }).default(false),
  hasAds: integer('has_ads', { mode: 'boolean' }).default(false),
  adDensity: real('ad_density'), // 0-1
  pricingModel: text('pricing_model'), // subscription/one-time/freemium
  priceRange: text('price_range'),
  hasAffiliate: integer('has_affiliate', { mode: 'boolean' }).default(false),
  avgCpc: real('avg_cpc'), // from keyword data
  detectedAt: text('detected_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Many-to-many: ideas <-> keywords
export const ideaKeywords = sqliteTable('idea_keywords', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ideaId: text('idea_id').notNull().references(() => ideas.id, { onDelete: 'cascade' }),
  keywordId: integer('keyword_id').notNull().references(() => keywords.id, { onDelete: 'cascade' }),
  relevanceScore: real('relevance_score'), // AI-rated 0-1
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// API response cache to avoid redundant calls
export const apiCache = sqliteTable('api_cache', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cacheKey: text('cache_key').notNull().unique(),
  apiName: text('api_name').notNull(), // dataforseo/serpapi/ai
  response: text('response').notNull(), // JSON
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// API cost tracking (extends ai_cost_logs for non-AI APIs)
export const apiCostLogs = sqliteTable('api_cost_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  apiName: text('api_name').notNull(), // dataforseo/serpapi/ahrefs
  endpoint: text('endpoint'),
  itemCount: integer('item_count').default(1),
  costUsd: real('cost_usd').notNull(),
  metadata: text('metadata'), // JSON
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// =============================================================================
// V3: Site Research
// =============================================================================

export const siteResearches = sqliteTable('site_researches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  url: text('url').notNull(),
  domain: text('domain').notNull(),
  title: text('title'),
  status: text('status').notNull().default('pending'), // pending/crawling/analyzing/completed/failed
  pageContent: text('page_content'), // crawled text content
  aiAnalysis: text('ai_analysis'), // JSON: structured analysis result
  errorMessage: text('error_message'),
  ideaId: text('idea_id').references(() => ideas.id),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// =============================================================================
// V4: Trend Mining (New Word Discovery)
// =============================================================================

export const trendDiscoveries = sqliteTable('trend_discoveries', {
  id: text('id').primaryKey(),
  keyword: text('keyword').notNull(),
  seedWord: text('seed_word'),
  source: text('source').notNull().default('google_trends_rising'), // google_trends_rising / manual
  growthRate: text('growth_rate'), // "+2,800%", "Breakout"
  growthNumeric: integer('growth_numeric').default(0), // parsed numeric value

  // SEO validation data (enriched via DataForSEO)
  searchVolume: integer('search_volume'),
  difficulty: real('difficulty'),
  cpc: real('cpc'),
  serpCompetition: text('serp_competition'), // weak/mixed/strong

  // Status
  validationStatus: text('validation_status').notNull().default('pending'), // pending/validated/rejected/converted
  ideaId: text('idea_id').references(() => ideas.id),

  // Extra data
  metadata: text('metadata'), // JSON: SERP results, related queries, etc.
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// =============================================================================
// Type Exports
// =============================================================================

export type Idea = typeof ideas.$inferSelect;
export type NewIdea = typeof ideas.$inferInsert;
export type TrendHistory = typeof trendHistory.$inferSelect;
export type CollectionLog = typeof collectionLogs.$inferSelect;
export type AICostLog = typeof aiCostLogs.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type Keyword = typeof keywords.$inferSelect;
export type NewKeyword = typeof keywords.$inferInsert;
export type KeywordCluster = typeof keywordClusters.$inferSelect;
export type SerpSnapshot = typeof serpSnapshots.$inferSelect;
export type Competitor = typeof competitors.$inferSelect;
export type MonetizationSignal = typeof monetizationSignals.$inferSelect;
export type IdeaKeyword = typeof ideaKeywords.$inferSelect;
export type ApiCacheEntry = typeof apiCache.$inferSelect;
export type ApiCostLog = typeof apiCostLogs.$inferSelect;
export type SiteResearch = typeof siteResearches.$inferSelect;
export type TrendDiscovery = typeof trendDiscoveries.$inferSelect;
export type NewTrendDiscovery = typeof trendDiscoveries.$inferInsert;
