import axios from 'axios';
import { db } from '../db';
import { apiCostLogs } from '../db/schema';

export interface SerpAPIConfig {
  apiKey: string;
}

export interface SerpAPIResult {
  keyword: string;
  organicResults: Array<{
    position: number;
    title: string;
    link: string;
    domain: string;
    snippet: string;
  }>;
  peopleAlsoAsk: string[];
  relatedSearches: string[];
  serpFeatures: string[];
}

// ─── Google Trends Types ──────────────────────────────────────────────────

export interface TrendingSearch {
  title: string;
  traffic: string;           // e.g., "500K+", "200K+"
  trafficNumeric: number;    // parsed numeric value
  relatedArticles: Array<{
    title: string;
    url: string;
    source: string;
    snippet: string;
  }>;
}

export interface RisingQuery {
  query: string;
  value: number;             // growth percentage (e.g., 2800)
  formattedValue: string;    // e.g., "+2,800%", "Breakout"
  isBreakout: boolean;       // true if labeled as breakout/暴增
  link: string;              // Google Trends explore link
}

const COST_PER_SEARCH = 0.01; // $50/month for 5000 searches

export class SerpAPIClient {
  private apiKey: string;
  private isConfigured: boolean;

  constructor(config?: SerpAPIConfig) {
    this.apiKey = config?.apiKey || process.env.SERPAPI_API_KEY || '';
    this.isConfigured = !!this.apiKey;
  }

  get configured(): boolean {
    return this.isConfigured;
  }

  async search(keyword: string, location = 'United States'): Promise<SerpAPIResult> {
    if (!this.isConfigured) throw new Error('SerpAPI not configured');

    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        q: keyword,
        location,
        hl: 'en',
        gl: 'us',
        google_domain: 'google.com',
        api_key: this.apiKey,
      },
      timeout: 30000,
    });

    await this.logCost(keyword);

    const data = response.data;

    return {
      keyword,
      organicResults: (data.organic_results || []).map((r: Record<string, unknown>) => ({
        position: r.position as number,
        title: r.title as string || '',
        link: r.link as string || '',
        domain: r.displayed_link as string
          ? new URL(r.link as string).hostname
          : '',
        snippet: r.snippet as string || '',
      })),
      peopleAlsoAsk: (data.related_questions || []).map(
        (q: Record<string, unknown>) => q.question as string
      ),
      relatedSearches: (data.related_searches || []).map(
        (s: Record<string, unknown>) => s.query as string
      ),
      serpFeatures: this.extractFeatures(data),
    };
  }

  /**
   * Fetch daily trending searches from Google Trends
   */
  async getTrendingSearches(geo = 'US'): Promise<TrendingSearch[]> {
    if (!this.isConfigured) throw new Error('SerpAPI not configured');

    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_trends_trending_now',
        frequency: 'daily',
        geo,
        api_key: this.apiKey,
      },
      timeout: 30000,
    });

    await this.logCost('google_trends_trending', 'trends_trending');

    const dailySearches = response.data?.daily_searches || [];
    const results: TrendingSearch[] = [];

    for (const day of dailySearches) {
      for (const search of day.searches || []) {
        const trafficStr = String(search.search_volume || '0');
        const trafficNumeric = this.parseTraffic(trafficStr);

        results.push({
          title: search.query || '',
          traffic: trafficStr,
          trafficNumeric,
          relatedArticles: (search.articles || []).slice(0, 3).map(
            (a: Record<string, unknown>) => ({
              title: String(a.title || ''),
              url: String(a.link || ''),
              source: String(a.source || ''),
              snippet: String(a.snippet || ''),
            })
          ),
        });
      }
    }

    return results;
  }

  /**
   * Fetch rising related queries for a seed keyword from Google Trends
   */
  async getRisingQueries(keyword: string, timeRange = 'now 7-d', geo = ''): Promise<RisingQuery[]> {
    if (!this.isConfigured) throw new Error('SerpAPI not configured');

    const params: Record<string, string> = {
      engine: 'google_trends',
      q: keyword,
      data_type: 'RELATED_QUERIES',
      date: timeRange,
      api_key: this.apiKey,
    };
    if (geo) params.geo = geo;

    const response = await axios.get('https://serpapi.com/search.json', {
      params,
      timeout: 30000,
    });

    await this.logCost(`rising:${keyword}`, 'trends_related');

    const rising = response.data?.related_queries?.rising || [];

    return rising.map((item: Record<string, unknown>) => {
      const extracted = item.extracted_value as number || 0;
      const formatted = String(item.value || '');
      const isBreakout = formatted.toLowerCase().includes('breakout') ||
                          formatted.includes('暴增') ||
                          extracted >= 5000;

      return {
        query: String(item.query || ''),
        value: extracted,
        formattedValue: formatted,
        isBreakout,
        link: String(item.link || `https://trends.google.com/trends/explore?q=${encodeURIComponent(String(item.query || ''))}`),
      };
    });
  }

  private parseTraffic(traffic: string): number {
    const cleaned = traffic.replace(/[,+]/g, '').trim();
    const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*([KkMm])?/);
    if (!match) return 0;
    const num = parseFloat(match[1]);
    const unit = (match[2] || '').toUpperCase();
    if (unit === 'M') return num * 1000000;
    if (unit === 'K') return num * 1000;
    return num;
  }

  private extractFeatures(data: Record<string, unknown>): string[] {
    const features: string[] = [];
    if (data.answer_box) features.push('featured_snippet');
    if (data.knowledge_graph) features.push('knowledge_graph');
    if (data.related_questions) features.push('people_also_ask');
    if (data.local_results) features.push('local_pack');
    if (data.shopping_results) features.push('shopping');
    if (data.top_stories) features.push('top_stories');
    if (data.images_results) features.push('images');
    if (data.videos_results) features.push('videos');
    return features;
  }

  private async logCost(keyword: string, endpoint = 'search') {
    try {
      await db.insert(apiCostLogs).values({
        apiName: 'serpapi',
        endpoint,
        itemCount: 1,
        costUsd: COST_PER_SEARCH,
        metadata: JSON.stringify({ keyword }),
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('[SerpAPI] Failed to log cost:', error);
    }
  }
}

let _client: SerpAPIClient | null = null;

export function getSerpAPIClient(): SerpAPIClient {
  if (!_client) {
    _client = new SerpAPIClient();
  }
  return _client;
}
