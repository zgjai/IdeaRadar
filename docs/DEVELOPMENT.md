# Development Guide

## Prerequisites

- **Node.js** >= 18 (recommended: 20+)
- **npm** >= 9

No database server required -- SQLite is embedded.

## Setup

```bash
git clone git@github.com:zgjai/IdeaRadar.git
cd IdeaRadar
npm install
```

Create `.env` from the template:

```bash
cp .env.example .env
# Edit .env with your API keys
```

If no `.env.example` exists, create `.env` with at minimum:

```env
AI_GATEWAY_API_KEY=your_api_key
```

## Development Server

```bash
npm run dev
```

Runs at `http://localhost:3000` with hot reload.

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `next dev --port 3000` | Start development server |
| `build` | `next build` | Production build |
| `start` | `next start` | Start production server |
| `db:generate` | `drizzle-kit generate` | Generate SQL migrations from schema |
| `db:migrate` | `drizzle-kit migrate` | Apply migrations |
| `db:studio` | `drizzle-kit studio` | Open Drizzle Studio (DB browser) |

## Project Conventions

### Directory Structure

```
src/
  app/              # Next.js App Router (pages + API routes)
  components/       # React components
    ui/             # Design system primitives (Button, Card, Input, etc.)
    dashboard/      # Dashboard-specific components
    ideas/          # Ideas page components
    charts/         # Data visualization components
  lib/              # Core business logic (no React)
    ai/             # AI provider abstraction and analysis
    collectors/     # Data source collectors
    scoring/        # Scoring and ranking engine
    scheduler/      # Background job scheduler
    db/             # Database connection and schema
```

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `score-badge.tsx` |
| Components | PascalCase | `ScoreBadge` |
| Functions | camelCase | `calculateFinalScore` |
| Constants | UPPER_SNAKE | `DEFAULT_WEIGHTS` |
| DB tables | snake_case | `ai_cost_logs` |
| Settings keys | dot.notation | `ai.screening.model` |
| API routes | kebab-case dirs | `/api/ideas/[id]` |

### TypeScript

- Strict mode enabled
- Path alias `@/*` maps to `./src/*`
- Drizzle ORM inferred types used for database entities
- Interfaces preferred over type aliases for object shapes

### Styling

- Tailwind CSS v4 with `@theme` configuration
- UI primitives use `class-variance-authority` (cva) for variants
- `clsx` + `tailwind-merge` via `cn()` utility for class composition
- Slate color palette as primary neutral

## Database

### Schema Location

`src/lib/db/schema.ts` -- Source of truth for table definitions.

### Auto-Initialization

Tables are created automatically on first access via `CREATE TABLE IF NOT EXISTS` statements in `db/index.ts`. No migration step required for initial setup.

### Using Drizzle Studio

```bash
npm run db:studio
```

Opens a web-based database browser to inspect and edit data directly.

### SQLite Pragmas

The database is configured with:

```sql
PRAGMA journal_mode = WAL;      -- Write-Ahead Logging for concurrent access
PRAGMA busy_timeout = 5000;     -- Wait up to 5s if database is locked
PRAGMA foreign_keys = ON;       -- Enforce foreign key constraints
```

### Database File Location

Default: `./data/idearadar.db`

Override with: `DATABASE_URL=./path/to/your.db`

The `data/` directory is gitignored.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_GATEWAY_API_KEY` | Yes* | - | API key for AI provider |
| `AI_GATEWAY_URL` | No | `https://ai-gateway.happycapy.ai/api/v1` | AI API base URL |
| `AI_SCREENING_MODEL` | No | `anthropic/claude-haiku-4.5` | Screening model ID |
| `AI_ANALYSIS_MODEL` | No | `anthropic/claude-sonnet-4.6` | Analysis model ID |
| `AI_DAILY_BUDGET` | No | `5` | Daily AI spend limit ($) |
| `OPENAI_API_KEY` | No | - | Fallback API key |
| `ANTHROPIC_API_KEY` | No | - | Fallback API key |
| `PRODUCTHUNT_TOKEN` | No | - | Product Hunt API token |
| `DATABASE_URL` | No | `./data/idearadar.db` | SQLite database path |
| `SCHEDULER_AUTO_START` | No | `false` | Auto-start cron jobs |
| `COLLECT_INTERVAL` | No | `0 */6 * * *` | Collection cron expression |
| `ANALYZE_INTERVAL` | No | `0 * * * *` | Analysis cron expression |

*At least one API key is required for AI analysis features.

## Building for Production

```bash
npm run build
npm start
```

The build output goes to `.next/` (gitignored). The production server runs on port 3000 by default.

### Key Build Considerations

- **Lazy DB initialization**: The database is initialized via Proxy to avoid build-time SQLite locking when Next.js spawns multiple workers
- **`force-dynamic` exports**: API routes that read from SQLite use `export const dynamic = 'force-dynamic'` to prevent Next.js from caching them at build time
- **ESM module**: The project uses `"type": "module"` in `package.json` for ES module compatibility

## Troubleshooting

### "Database is locked" during build

This was resolved by the lazy Proxy pattern in `db/index.ts`. If it recurs, ensure only one build process runs at a time.

### Settings page shows "Loading..." forever

The Settings page uses `mergeSettings()` to deep-copy `DEFAULT_SETTINGS` and overlay database values. If the API returns empty settings, defaults are used. Check that `/api/settings` responds correctly.

### AI analysis returns no results

1. Verify API key is configured (Settings page or `.env`)
2. Check that the model identifier matches your provider's format
3. Look for errors in the terminal/console output
4. Verify the AI provider's endpoint is reachable

### Next.js build errors with Drizzle config

`drizzle.config.ts` is excluded from TypeScript compilation via `tsconfig.json`. If build errors reference this file, verify the exclude entry exists.
