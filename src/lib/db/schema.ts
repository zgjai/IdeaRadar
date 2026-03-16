import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

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

  // AI Analysis Results
  aiSummary: text('ai_summary'),
  aiPainPoint: text('ai_pain_point'),
  aiTargetUsers: text('ai_target_users'),
  aiFeatures: text('ai_features'), // JSON array
  aiCompetitors: text('ai_competitors'), // JSON array
  aiTechFeasibility: real('ai_tech_feasibility'),

  // Scores
  trendScore: real('trend_score').default(0),
  demandScore: real('demand_score').default(0),
  competitionScore: real('competition_score').default(0),
  feasibilityScore: real('feasibility_score').default(0),
  growthScore: real('growth_score').default(0),
  finalScore: real('final_score').default(0),

  // Ranking
  rankCategory: text('rank_category'), // S/A/B/C/D
  confidence: real('confidence').default(0),

  // Timestamps
  discoveredAt: text('discovered_at').notNull(),
  analyzedAt: text('analyzed_at'),
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
  analysisType: text('analysis_type'), // screening/deep
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type Idea = typeof ideas.$inferSelect;
export type NewIdea = typeof ideas.$inferInsert;
export type TrendHistory = typeof trendHistory.$inferSelect;
export type CollectionLog = typeof collectionLogs.$inferSelect;
export type AICostLog = typeof aiCostLogs.$inferSelect;
export type Setting = typeof settings.$inferSelect;
