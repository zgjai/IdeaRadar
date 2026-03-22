import { getSerpAPIClient } from '../api/serpapi';
import type { CollectedIdea, CollectorResult } from './types';

// Tech/startup related keywords for filtering trending searches
const TECH_KEYWORDS = new Set([
  'ai', 'app', 'api', 'bot', 'gpt', 'llm', 'saas', 'tool', 'code',
  'dev', 'web', 'cloud', 'data', 'tech', 'game', 'crypto', 'nft',
  'startup', 'software', 'platform', 'generator', 'maker', 'builder',
  'automation', 'workflow', 'plugin', 'extension', 'chrome',
  'openai', 'chatgpt', 'claude', 'gemini', 'copilot', 'midjourney',
  'notion', 'figma', 'cursor', 'vscode', 'github',
  'react', 'nextjs', 'python', 'rust', 'typescript',
  'machine learning', 'deep learning', 'neural', 'model',
  'blockchain', 'defi', 'web3',
]);

/**
 * Check if a trending query is tech/startup related
 */
function isTechRelated(query: string): boolean {
  const lower = query.toLowerCase();
  for (const keyword of TECH_KEYWORDS) {
    if (lower.includes(keyword)) return true;
  }
  return false;
}

/**
 * Collect trending searches from Google Trends
 */
export async function collectGoogleTrends(): Promise<CollectorResult> {
  const startTime = Date.now();
  const items: CollectedIdea[] = [];
  const errors: string[] = [];

  try {
    const client = getSerpAPIClient();
    if (!client.configured) {
      return {
        source: 'google_trends',
        items: [],
        errors: ['SerpAPI key not configured (required for Google Trends)'],
        duration: Date.now() - startTime,
      };
    }

    console.log('[GoogleTrends] Fetching trending searches...');
    const trending = await client.getTrendingSearches('US');
    console.log(`[GoogleTrends] Got ${trending.length} trending searches`);

    for (const trend of trending) {
      if (!trend.title || !isTechRelated(trend.title)) continue;

      const articles = trend.relatedArticles;
      const description = articles.length > 0
        ? articles.map(a => `${a.title} (${a.source})`).join(' | ')
        : `Trending search: ${trend.title} (${trend.traffic} searches)`;

      const articleUrl = articles.length > 0 ? articles[0].url : '';
      const trendsUrl = `https://trends.google.com/trends/explore?q=${encodeURIComponent(trend.title)}&date=now%207-d`;

      items.push({
        title: trend.title,
        description,
        url: articleUrl || trendsUrl,
        source: 'google_trends',
        sourceId: `gt_${Buffer.from(trend.title).toString('base64url').slice(0, 20)}`,
        sourceScore: Math.min(trend.trafficNumeric, 1000000),
        sourceComments: 0,
        discoveredAt: new Date().toISOString(),
        metadata: {
          traffic: trend.traffic,
          trafficNumeric: trend.trafficNumeric,
          trendsUrl,
          articles: articles.slice(0, 3),
        },
      });
    }

    console.log(`[GoogleTrends] Collected ${items.length} tech-related trends`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`Google Trends error: ${msg}`);
    console.error('[GoogleTrends] Collection error:', msg);
  }

  return {
    source: 'google_trends',
    items,
    errors,
    duration: Date.now() - startTime,
  };
}
