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

// Initialize database schema
function initializeDatabase() {
  try {
    const sqlite = getSqlite();
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
        rank_category TEXT,
        confidence REAL DEFAULT 0,
        discovered_at TEXT NOT NULL,
        analyzed_at TEXT,
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

      CREATE INDEX IF NOT EXISTS idx_ideas_source ON ideas(source);
      CREATE INDEX IF NOT EXISTS idx_ideas_final_score ON ideas(final_score DESC);
      CREATE INDEX IF NOT EXISTS idx_ideas_discovered_at ON ideas(discovered_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ideas_category ON ideas(category);
      CREATE INDEX IF NOT EXISTS idx_trend_history_idea_id ON trend_history(idea_id);
      CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_created_at ON ai_cost_logs(created_at);
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
