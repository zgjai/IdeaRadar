import { db } from '../db';
import { aiCostLogs, apiCostLogs } from '../db/schema';
import { sql, and, eq, gte } from 'drizzle-orm';

export interface BudgetConfig {
  monthlyLimit: number; // total USD per month
  dailyLimit: number; // total USD per day
  perApi: {
    dataforseo: number;
    serpapi: number;
    ai: number;
  };
}

const DEFAULT_BUDGET: BudgetConfig = {
  monthlyLimit: 100,
  dailyLimit: 5,
  perApi: {
    dataforseo: 50,
    serpapi: 25,
    ai: 25,
  },
};

/**
 * Load budget config from DB settings, falling back to defaults
 */
async function loadBudgetConfig(): Promise<BudgetConfig> {
  try {
    const rows = await db.query.settings.findMany({
      where: (s, { like }) => like(s.key, 'budget.%'),
    });

    if (rows.length === 0) return DEFAULT_BUDGET;

    const cfg: Record<string, string> = {};
    rows.forEach((r) => (cfg[r.key.replace('budget.', '')] = r.value));

    return {
      monthlyLimit: cfg.monthlyLimit ? parseFloat(cfg.monthlyLimit) : DEFAULT_BUDGET.monthlyLimit,
      dailyLimit: cfg.dailyLimit ? parseFloat(cfg.dailyLimit) : DEFAULT_BUDGET.dailyLimit,
      perApi: {
        dataforseo: cfg['perApi.dataforseo']
          ? parseFloat(cfg['perApi.dataforseo'])
          : DEFAULT_BUDGET.perApi.dataforseo,
        serpapi: cfg['perApi.serpapi']
          ? parseFloat(cfg['perApi.serpapi'])
          : DEFAULT_BUDGET.perApi.serpapi,
        ai: cfg['perApi.ai'] ? parseFloat(cfg['perApi.ai']) : DEFAULT_BUDGET.perApi.ai,
      },
    };
  } catch {
    return DEFAULT_BUDGET;
  }
}

/**
 * Check if we have budget remaining for a given API call
 */
export async function checkBudget(
  apiName: string,
  estimatedCost: number
): Promise<{ allowed: boolean; remaining: number; reason?: string }> {
  const config = await loadBudgetConfig();
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Get daily total across all APIs
  const dailyTotal = await getDailySpend(today);
  if (dailyTotal + estimatedCost > config.dailyLimit) {
    return {
      allowed: false,
      remaining: Math.max(0, config.dailyLimit - dailyTotal),
      reason: `Daily budget exceeded ($${dailyTotal.toFixed(2)} / $${config.dailyLimit})`,
    };
  }

  // Get monthly total across all APIs
  const monthlyTotal = await getMonthlySpend(currentMonth);
  if (monthlyTotal + estimatedCost > config.monthlyLimit) {
    return {
      allowed: false,
      remaining: Math.max(0, config.monthlyLimit - monthlyTotal),
      reason: `Monthly budget exceeded ($${monthlyTotal.toFixed(2)} / $${config.monthlyLimit})`,
    };
  }

  // Get per-API monthly spend
  const apiKey = apiName as keyof typeof config.perApi;
  if (config.perApi[apiKey]) {
    const apiSpend = await getMonthlyAPISpend(apiName, currentMonth);
    const apiLimit = config.perApi[apiKey];
    if (apiSpend + estimatedCost > apiLimit) {
      return {
        allowed: false,
        remaining: Math.max(0, apiLimit - apiSpend),
        reason: `${apiName} monthly limit exceeded ($${apiSpend.toFixed(2)} / $${apiLimit})`,
      };
    }
  }

  return { allowed: true, remaining: config.monthlyLimit - monthlyTotal };
}

/**
 * Get total spend for a given day (ISO date string)
 */
async function getDailySpend(dateStr: string): Promise<number> {
  // AI cost logs
  const aiResult = await db
    .select({ total: sql<number>`COALESCE(SUM(cost_usd), 0)` })
    .from(aiCostLogs)
    .where(sql`date(created_at) = ${dateStr}`);

  // API cost logs
  const apiResult = await db
    .select({ total: sql<number>`COALESCE(SUM(cost_usd), 0)` })
    .from(apiCostLogs)
    .where(sql`date(created_at) = ${dateStr}`);

  return (aiResult[0]?.total ?? 0) + (apiResult[0]?.total ?? 0);
}

/**
 * Get total spend for a given month (YYYY-MM)
 */
async function getMonthlySpend(monthStr: string): Promise<number> {
  const aiResult = await db
    .select({ total: sql<number>`COALESCE(SUM(cost_usd), 0)` })
    .from(aiCostLogs)
    .where(sql`strftime('%Y-%m', created_at) = ${monthStr}`);

  const apiResult = await db
    .select({ total: sql<number>`COALESCE(SUM(cost_usd), 0)` })
    .from(apiCostLogs)
    .where(sql`strftime('%Y-%m', created_at) = ${monthStr}`);

  return (aiResult[0]?.total ?? 0) + (apiResult[0]?.total ?? 0);
}

/**
 * Get monthly spend for a specific API
 */
async function getMonthlyAPISpend(apiName: string, monthStr: string): Promise<number> {
  if (apiName === 'ai') {
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(cost_usd), 0)` })
      .from(aiCostLogs)
      .where(sql`strftime('%Y-%m', created_at) = ${monthStr}`);
    return result[0]?.total ?? 0;
  }

  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(cost_usd), 0)` })
    .from(apiCostLogs)
    .where(
      and(
        eq(apiCostLogs.apiName, apiName),
        sql`strftime('%Y-%m', created_at) = ${monthStr}`
      )
    );
  return result[0]?.total ?? 0;
}

/**
 * Get full budget overview for the dashboard
 */
export async function getBudgetOverview(): Promise<{
  config: BudgetConfig;
  today: { total: number; remaining: number };
  month: {
    total: number;
    remaining: number;
    byApi: Record<string, number>;
  };
}> {
  const config = await loadBudgetConfig();
  const todayStr = new Date().toISOString().slice(0, 10);
  const monthStr = new Date().toISOString().slice(0, 7);

  const dailyTotal = await getDailySpend(todayStr);
  const monthlyTotal = await getMonthlySpend(monthStr);

  // Per-API breakdown
  const byApi: Record<string, number> = {};
  for (const apiName of ['dataforseo', 'serpapi', 'ai']) {
    byApi[apiName] = await getMonthlyAPISpend(apiName, monthStr);
  }

  return {
    config,
    today: { total: dailyTotal, remaining: Math.max(0, config.dailyLimit - dailyTotal) },
    month: {
      total: monthlyTotal,
      remaining: Math.max(0, config.monthlyLimit - monthlyTotal),
      byApi,
    },
  };
}

/**
 * Wrapper: execute an API call only if budget allows
 */
export async function withBudgetCheck<T>(
  apiName: string,
  estimatedCost: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const budget = await checkBudget(apiName, estimatedCost);
  if (!budget.allowed) {
    throw new Error(`[Budget] ${budget.reason}`);
  }
  return fetcher();
}
