export const config = {
  ai: {
    gateway: {
      baseUrl: process.env.AI_GATEWAY_URL || 'https://ai-gateway.happycapy.ai/api/v1',
      apiKey: process.env.AI_GATEWAY_API_KEY || '',
    },
    screening: {
      provider: 'openrouter' as const,
      model: process.env.AI_SCREENING_MODEL || 'anthropic/claude-haiku-4.5',
      temperature: 0.3,
      maxTokens: 2048,
    },
    analysis: {
      provider: 'openrouter' as const,
      model: process.env.AI_ANALYSIS_MODEL || 'anthropic/claude-sonnet-4.6',
      temperature: 0.3,
      maxTokens: 4096,
    },
    dailyBudget: Number(process.env.AI_DAILY_BUDGET) || 5,
  },
  collection: {
    hackernews: {
      enabled: true,
      minScore: 50,
    },
    producthunt: {
      enabled: !!process.env.PRODUCTHUNT_TOKEN,
      apiToken: process.env.PRODUCTHUNT_TOKEN || '',
    },
    googleTrends: {
      enabled: false,
    },
  },
  scheduler: {
    collectInterval: process.env.COLLECT_INTERVAL || '0 */6 * * *', // Every 6 hours
    analyzeInterval: process.env.ANALYZE_INTERVAL || '0 * * * *', // Every hour
    autoStart: process.env.SCHEDULER_AUTO_START === 'true',
  },
  database: {
    path: process.env.DATABASE_URL || './data/idearadar.db',
  },
} as const;

export default config;
