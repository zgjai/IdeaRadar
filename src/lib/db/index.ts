import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = process.env.DATABASE_URL || './data/idearadar.db';

let _sqlite: Database.Database | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _initialized = false;

function getSqlite(): Database.Database {
  if (!_sqlite) {
    const dbDir = dirname(DB_PATH);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    _sqlite = new Database(DB_PATH);
    _sqlite.pragma('journal_mode = WAL');
    _sqlite.pragma('busy_timeout = 5000');
    _sqlite.pragma('foreign_keys = ON');
  }
  return _sqlite;
}

function getDb() {
  if (!_db) {
    _db = drizzle(getSqlite(), { schema });
  }
  if (!_initialized) {
    _initialized = true;
    initializeDatabase();
  }
  return _db;
}

// Safely add a column if it doesn't exist yet
function addColumnIfNotExists(sqlite: Database.Database, table: string, column: string, type: string) {
  try {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch {
    // Column already exists — ignore
  }
}

// Initialize database schema
function initializeDatabase() {
  try {
    const sqlite = getSqlite();

    // =========================================================================
    // V1 Tables
    // =========================================================================
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS ideas (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        url TEXT UNIQUE NOT NULL,
        category TEXT,
        source TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_score INTEGER DEFAULT 0,
        source_comments INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'discovered',
        ai_summary TEXT,
        ai_pain_point TEXT,
        ai_target_users TEXT,
        ai_features TEXT,
        ai_competitors TEXT,
        ai_tech_feasibility REAL,
        trend_score REAL DEFAULT 0,
        demand_score REAL DEFAULT 0,
        competition_score REAL DEFAULT 0,
        feasibility_score REAL DEFAULT 0,
        growth_score REAL DEFAULT 0,
        final_score REAL DEFAULT 0,
        traffic_score REAL DEFAULT 0,
        monetization_score REAL DEFAULT 0,
        execution_score REAL DEFAULT 0,
        opportunity_score REAL DEFAULT 0,
        primary_keyword TEXT,
        target_search_volume INTEGER,
        target_keyword_difficulty REAL,
        target_cpc REAL,
        estimated_traffic INTEGER,
        competitor_count INTEGER,
        ai_seo_analysis TEXT,
        ai_competitor_analysis TEXT,
        ai_monetization_analysis TEXT,
        ai_recommendation TEXT,
        rank_category TEXT,
        confidence REAL DEFAULT 0,
        discovered_at TEXT NOT NULL,
        analyzed_at TEXT,
        seo_validated_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS trend_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idea_id TEXT NOT NULL,
        date TEXT NOT NULL,
        source TEXT NOT NULL,
        score REAL NOT NULL,
        metadata TEXT,
        FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS collection_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        status TEXT NOT NULL,
        items_count INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS ai_cost_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cost_usd REAL NOT NULL,
        idea_id TEXT,
        analysis_type TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (idea_id) REFERENCES ideas(id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // =========================================================================
    // V2 Migration: add new columns to existing ideas table
    // =========================================================================
    const v2IdeasColumns: [string, string][] = [
      ['status', "TEXT NOT NULL DEFAULT 'discovered'"],
      ['traffic_score', 'REAL DEFAULT 0'],
      ['monetization_score', 'REAL DEFAULT 0'],
      ['execution_score', 'REAL DEFAULT 0'],
      ['opportunity_score', 'REAL DEFAULT 0'],
      ['primary_keyword', 'TEXT'],
      ['target_search_volume', 'INTEGER'],
      ['target_keyword_difficulty', 'REAL'],
      ['target_cpc', 'REAL'],
      ['estimated_traffic', 'INTEGER'],
      ['competitor_count', 'INTEGER'],
      ['ai_seo_analysis', 'TEXT'],
      ['ai_competitor_analysis', 'TEXT'],
      ['ai_monetization_analysis', 'TEXT'],
      ['ai_recommendation', 'TEXT'],
      ['seo_validated_at', 'TEXT'],
    ];
    for (const [col, type] of v2IdeasColumns) {
      addColumnIfNotExists(sqlite, 'ideas', col, type);
    }

    // =========================================================================
    // V2 New Tables
    // =========================================================================
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS keywords (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT NOT NULL UNIQUE,
        language TEXT NOT NULL DEFAULT 'en',
        location_code INTEGER NOT NULL DEFAULT 2840,
        search_volume INTEGER,
        difficulty REAL,
        cpc REAL,
        competition TEXT,
        trend TEXT,
        intent TEXT,
        cluster_id INTEGER,
        data_source TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS keyword_clusters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        centroid_keyword TEXT,
        total_volume INTEGER DEFAULT 0,
        avg_difficulty REAL,
        avg_cpc REAL,
        keyword_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS serp_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT NOT NULL,
        position INTEGER NOT NULL,
        url TEXT NOT NULL,
        domain TEXT NOT NULL,
        title TEXT,
        description TEXT,
        serp_features TEXT,
        snapshot_date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS competitors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT NOT NULL UNIQUE,
        name TEXT,
        description TEXT,
        monthly_visits INTEGER,
        traffic_sources TEXT,
        top_keywords TEXT,
        pricing_model TEXT,
        price_range TEXT,
        has_ads INTEGER DEFAULT 0,
        tech_stack TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS monetization_signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT NOT NULL,
        has_pricing INTEGER DEFAULT 0,
        has_ads INTEGER DEFAULT 0,
        ad_density REAL,
        pricing_model TEXT,
        price_range TEXT,
        has_affiliate INTEGER DEFAULT 0,
        avg_cpc REAL,
        detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS idea_keywords (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idea_id TEXT NOT NULL,
        keyword_id INTEGER NOT NULL,
        relevance_score REAL,
        is_primary INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
        FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS api_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cache_key TEXT NOT NULL UNIQUE,
        api_name TEXT NOT NULL,
        response TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS api_cost_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        api_name TEXT NOT NULL,
        endpoint TEXT,
        item_count INTEGER DEFAULT 1,
        cost_usd REAL NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // =========================================================================
    // V3: Site Research + V4: Trend Mining
    // =========================================================================
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS site_researches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        domain TEXT NOT NULL,
        title TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        page_content TEXT,
        ai_analysis TEXT,
        error_message TEXT,
        idea_id TEXT REFERENCES ideas(id),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS trend_discoveries (
        id TEXT PRIMARY KEY,
        keyword TEXT NOT NULL,
        seed_word TEXT,
        source TEXT NOT NULL DEFAULT 'google_trends_rising',
        growth_rate TEXT,
        growth_numeric INTEGER DEFAULT 0,
        search_volume INTEGER,
        difficulty REAL,
        cpc REAL,
        serp_competition TEXT,
        validation_status TEXT NOT NULL DEFAULT 'pending',
        idea_id TEXT REFERENCES ideas(id),
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // =========================================================================
    // V2.2 Migration: Strategy Analysis fields
    // =========================================================================
    const v22Columns: [string, string][] = [
      ['ai_strategy_analysis', 'TEXT'],
      ['discovery_strategy', 'TEXT'],
      ['automation_potential', 'REAL DEFAULT 0'],
    ];
    for (const [col, type] of v22Columns) {
      addColumnIfNotExists(sqlite, 'ideas', col, type);
    }

    // =========================================================================
    // Indexes (V1 + V2)
    // =========================================================================
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_ideas_source ON ideas(source);
      CREATE INDEX IF NOT EXISTS idx_ideas_final_score ON ideas(final_score DESC);
      CREATE INDEX IF NOT EXISTS idx_ideas_discovered_at ON ideas(discovered_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ideas_category ON ideas(category);
      CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
      CREATE INDEX IF NOT EXISTS idx_ideas_opportunity_score ON ideas(opportunity_score DESC);
      CREATE INDEX IF NOT EXISTS idx_trend_history_idea_id ON trend_history(idea_id);
      CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_created_at ON ai_cost_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_keywords_keyword ON keywords(keyword);
      CREATE INDEX IF NOT EXISTS idx_keywords_volume ON keywords(search_volume DESC);
      CREATE INDEX IF NOT EXISTS idx_keywords_cluster ON keywords(cluster_id);
      CREATE INDEX IF NOT EXISTS idx_serp_keyword ON serp_snapshots(keyword);
      CREATE INDEX IF NOT EXISTS idx_serp_domain ON serp_snapshots(domain);
      CREATE INDEX IF NOT EXISTS idx_serp_date ON serp_snapshots(snapshot_date DESC);
      CREATE INDEX IF NOT EXISTS idx_competitors_domain ON competitors(domain);
      CREATE INDEX IF NOT EXISTS idx_monetization_domain ON monetization_signals(domain);
      CREATE INDEX IF NOT EXISTS idx_idea_keywords_idea ON idea_keywords(idea_id);
      CREATE INDEX IF NOT EXISTS idx_idea_keywords_keyword ON idea_keywords(keyword_id);
      CREATE INDEX IF NOT EXISTS idx_api_cache_key ON api_cache(cache_key);
      CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at);
      CREATE INDEX IF NOT EXISTS idx_api_cost_logs_created ON api_cost_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_trend_discoveries_keyword ON trend_discoveries(keyword);
      CREATE INDEX IF NOT EXISTS idx_trend_discoveries_status ON trend_discoveries(validation_status);
      CREATE INDEX IF NOT EXISTS idx_trend_discoveries_seed ON trend_discoveries(seed_word);
      CREATE INDEX IF NOT EXISTS idx_ideas_discovery_strategy ON ideas(discovery_strategy);
    `);
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}

// Proxy that lazily initializes
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    const realDb = getDb();
    const value = Reflect.get(realDb, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(realDb);
    }
    return value;
  },
});

export { schema };
export default db;
