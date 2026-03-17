import axios, { type AxiosInstance } from 'axios';
import { db } from '../db';
import { apiCostLogs } from '../db/schema';

export interface DataForSEOConfig {
  login: string;
  password: string;
  baseURL?: string;
}

export interface KeywordData {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  cpc: number | null;
  competition: string | null; // LOW/MEDIUM/HIGH
  monthlySearches: Array<{ month: string; volume: number }> | null;
  intent: string | null;
}

export interface SerpResult {
  keyword: string;
  position: number;
  url: string;
  domain: string;
  title: string;
  description: string;
  serpFeatures: string[];
}

// Cost per API call in USD
const COSTS = {
  keywordSearch: 0.0003, // per keyword
  serpLive: 0.005, // per SERP query
  relatedKeywords: 0.0005, // per seed keyword
};

export class DataForSEOClient {
  private client: AxiosInstance;
  private isConfigured: boolean;

  constructor(config?: DataForSEOConfig) {
    const login = config?.login || process.env.DATAFORSEO_LOGIN || '';
    const password = config?.password || process.env.DATAFORSEO_PASSWORD || '';

    this.isConfigured = !!(login && password);

    this.client = axios.create({
      baseURL: config?.baseURL || 'https://api.dataforseo.com',
      auth: this.isConfigured ? { username: login, password } : undefined,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  get configured(): boolean {
    return this.isConfigured;
  }

  /**
   * Batch keyword search volume + difficulty + CPC
   * Max 1000 keywords per request
   */
  async getKeywordData(
    keywords: string[],
    locationCode = 2840,
    languageCode = 'en'
  ): Promise<KeywordData[]> {
    if (!this.isConfigured) throw new Error('DataForSEO not configured');
    if (keywords.length === 0) return [];
    if (keywords.length > 1000) throw new Error('Max 1000 keywords per batch');

    const response = await this.client.post(
      '/v3/keywords_data/google_ads/search_volume/live',
      [{ keywords, location_code: locationCode, language_code: languageCode }]
    );

    await this.logCost('keyword_search', keywords.length * COSTS.keywordSearch, {
      count: keywords.length,
    });

    const results: KeywordData[] = [];
    const tasks = response.data?.tasks || [];

    for (const task of tasks) {
      if (task.status_code !== 20000 || !task.result) continue;
      for (const item of task.result) {
        results.push({
          keyword: item.keyword,
          searchVolume: item.search_volume ?? null,
          difficulty: item.keyword_info?.keyword_difficulty ?? null,
          cpc: item.cpc ?? null,
          competition: item.competition ?? null,
          monthlySearches: item.monthly_searches ?? null,
          intent: item.keyword_info?.search_intent_info?.main_intent ?? null,
        });
      }
    }

    return results;
  }

  /**
   * Get related/expanded keywords from a seed keyword
   */
  async getRelatedKeywords(
    seed: string,
    locationCode = 2840,
    languageCode = 'en',
    limit = 100
  ): Promise<KeywordData[]> {
    if (!this.isConfigured) throw new Error('DataForSEO not configured');

    const response = await this.client.post(
      '/v3/keywords_data/google_ads/keywords_for_keywords/live',
      [
        {
          keywords: [seed],
          location_code: locationCode,
          language_code: languageCode,
          include_seed_keyword: true,
          limit,
        },
      ]
    );

    await this.logCost('related_keywords', COSTS.relatedKeywords, { seed });

    const results: KeywordData[] = [];
    const tasks = response.data?.tasks || [];

    for (const task of tasks) {
      if (task.status_code !== 20000 || !task.result) continue;
      for (const item of task.result) {
        results.push({
          keyword: item.keyword,
          searchVolume: item.search_volume ?? null,
          difficulty: null,
          cpc: item.cpc ?? null,
          competition: item.competition ?? null,
          monthlySearches: item.monthly_searches ?? null,
          intent: null,
        });
      }
    }

    return results;
  }

  /**
   * Get SERP results for a keyword
   */
  async getSerpResults(
    keyword: string,
    locationCode = 2840,
    languageCode = 'en'
  ): Promise<SerpResult[]> {
    if (!this.isConfigured) throw new Error('DataForSEO not configured');

    const response = await this.client.post(
      '/v3/serp/google/organic/live/advanced',
      [
        {
          keyword,
          location_code: locationCode,
          language_code: languageCode,
          device: 'desktop',
          depth: 20,
        },
      ]
    );

    await this.logCost('serp_live', COSTS.serpLive, { keyword });

    const results: SerpResult[] = [];
    const tasks = response.data?.tasks || [];

    for (const task of tasks) {
      if (task.status_code !== 20000 || !task.result) continue;
      for (const resultSet of task.result) {
        const items = resultSet.items || [];
        const features = resultSet.item_types || [];

        for (const item of items) {
          if (item.type !== 'organic') continue;
          results.push({
            keyword,
            position: item.rank_absolute,
            url: item.url || '',
            domain: item.domain || '',
            title: item.title || '',
            description: item.description || '',
            serpFeatures: features,
          });
        }
      }
    }

    return results;
  }

  private async logCost(endpoint: string, cost: number, metadata?: Record<string, unknown>) {
    try {
      await db.insert(apiCostLogs).values({
        apiName: 'dataforseo',
        endpoint,
        itemCount: 1,
        costUsd: cost,
        metadata: metadata ? JSON.stringify(metadata) : null,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('[DataForSEO] Failed to log cost:', error);
    }
  }
}

let _client: DataForSEOClient | null = null;

export function getDataForSEOClient(): DataForSEOClient {
  if (!_client) {
    _client = new DataForSEOClient();
  }
  return _client;
}
