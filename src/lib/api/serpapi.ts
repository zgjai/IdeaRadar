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

  private async logCost(keyword: string) {
    try {
      await db.insert(apiCostLogs).values({
        apiName: 'serpapi',
        endpoint: 'search',
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
