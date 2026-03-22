import axios from 'axios';
import type { CollectedIdea, CollectorResult } from './types';
import { scoreDemandSignals, enrichWithSignals, SOURCE_THRESHOLDS } from './signals';

const HN_ALGOLIA_BASE = 'https://hn.algolia.com/api/v1';
const KEYWORD_DELAY = 1000; // 1s between keyword queries
const REQUEST_TIMEOUT = 15000;

// --- Algolia response types ---

interface AlgoliaHit {
  objectID: string;
  title: string;
  story_text?: string;
  url?: string;
  author: string;
  points: number;
  num_comments: number;
  created_at_i: number;
  _tags: string[];
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
  nbHits: number;
}

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sevenDaysAgo(): number {
  return Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&[^;]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Three Query Strategy ---

/** Query 1: Show HN posts — explicit product launches */
async function fetchShowHN(): Promise<AlgoliaHit[]> {
  const params = new URLSearchParams({
    tags: 'show_hn',
    numericFilters: `created_at_i>${sevenDaysAgo()}`,
    hitsPerPage: '50',
  });

  const response = await axios.get<AlgoliaResponse>(
    `${HN_ALGOLIA_BASE}/search?${params}`,
    { timeout: REQUEST_TIMEOUT }
  );
  return response.data.hits;
}

/** Query 2: Ask HN posts with engagement — pain points & recommendations */
async function fetchAskHN(): Promise<AlgoliaHit[]> {
  const params = new URLSearchParams({
    tags: 'ask_hn',
    numericFilters: `created_at_i>${sevenDaysAgo()},points>10`,
    hitsPerPage: '30',
  });

  const response = await axios.get<AlgoliaResponse>(
    `${HN_ALGOLIA_BASE}/search?${params}`,
    { timeout: REQUEST_TIMEOUT }
  );
  return response.data.hits;
}

/** Query 3: Demand keyword search in recent stories */
async function fetchDemandKeywords(): Promise<AlgoliaHit[]> {
  const keywords = [
    'looking for',
    'alternative to',
    'better than',
    'need a tool',
    'recommend',
  ];

  const allHits: AlgoliaHit[] = [];
  const since = sevenDaysAgo();

  for (const keyword of keywords) {
    try {
      const params = new URLSearchParams({
        query: keyword,
        tags: 'story',
        numericFilters: `created_at_i>${since}`,
        hitsPerPage: '10',
      });

      const response = await axios.get<AlgoliaResponse>(
        `${HN_ALGOLIA_BASE}/search?${params}`,
        { timeout: REQUEST_TIMEOUT }
      );
      allHits.push(...response.data.hits);

      await sleep(KEYWORD_DELAY);
    } catch (error) {
      console.warn(`[HN] Keyword search "${keyword}" failed:`, error instanceof Error ? error.message : error);
    }
  }

  return allHits;
}

// --- Conversion ---

function convertAlgoliaHit(hit: AlgoliaHit): CollectedIdea {
  let description = '';
  if (hit.story_text) {
    description = stripHtml(hit.story_text).slice(0, 500);
  }
  if (!description) {
    description = hit.title;
  }

  const url = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;

  return {
    title: hit.title,
    description,
    url,
    source: 'hackernews',
    sourceId: hit.objectID,
    sourceScore: hit.points || 0,
    sourceComments: hit.num_comments || 0,
    discoveredAt: new Date(hit.created_at_i * 1000).toISOString(),
    metadata: {
      author: hit.author,
      tags: hit._tags,
      isShowHN: hit._tags?.includes('show_hn') ?? false,
      isAskHN: hit._tags?.includes('ask_hn') ?? false,
    },
  };
}

// --- Main Collector ---

export async function collectHackerNews(): Promise<CollectorResult> {
  const startTime = Date.now();
  const items: CollectedIdea[] = [];
  const errors: string[] = [];

  try {
    // Fetch from all three sources in parallel
    const [showHNHits, askHNHits, keywordHits] = await Promise.all([
      fetchShowHN().catch((err) => {
        errors.push(`Show HN: ${err instanceof Error ? err.message : err}`);
        return [] as AlgoliaHit[];
      }),
      fetchAskHN().catch((err) => {
        errors.push(`Ask HN: ${err instanceof Error ? err.message : err}`);
        return [] as AlgoliaHit[];
      }),
      fetchDemandKeywords().catch((err) => {
        errors.push(`Keywords: ${err instanceof Error ? err.message : err}`);
        return [] as AlgoliaHit[];
      }),
    ]);

    // Combine and deduplicate by objectID
    const allHits = [...showHNHits, ...askHNHits, ...keywordHits];
    const uniqueHits = Array.from(
      new Map(allHits.map((hit) => [hit.objectID, hit])).values()
    );

    console.log(
      `[HN] Fetched ${uniqueHits.length} unique items (Show: ${showHNHits.length}, Ask: ${askHNHits.length}, Keywords: ${keywordHits.length})`
    );

    // Convert and filter
    for (const hit of uniqueHits) {
      try {
        const idea = convertAlgoliaHit(hit);
        const signals = scoreDemandSignals(idea.title, idea.description);

        const isShowHN = hit._tags?.includes('show_hn') ?? false;
        const highScore = (hit.points || 0) >= 50;
        const highDemand = signals.score >= (SOURCE_THRESHOLDS.hackernews ?? 20);

        if (isShowHN || highScore || highDemand) {
          items.push(enrichWithSignals(idea));
        }
      } catch (error) {
        errors.push(`Convert ${hit.objectID}: ${error instanceof Error ? error.message : error}`);
      }
    }

    console.log(`[HN] Kept ${items.length} items after filtering`);
  } catch (error) {
    errors.push(`HN Algolia error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    source: 'hackernews',
    items,
    errors,
    duration: Date.now() - startTime,
  };
}
