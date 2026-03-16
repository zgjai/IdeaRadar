import axios from 'axios';
import type { CollectedIdea, CollectorResult } from './types';

const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0';
const RATE_LIMIT_DELAY = 100; // ms between requests

interface HNItem {
  id: number;
  type: string;
  by: string;
  time: number;
  title?: string;
  text?: string;
  url?: string;
  score?: number;
  descendants?: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchStory(id: number): Promise<HNItem | null> {
  try {
    const response = await axios.get<HNItem>(`${HN_API_BASE}/item/${id}.json`, {
      timeout: 10000,
    });
    await sleep(RATE_LIMIT_DELAY);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch HN story ${id}:`, error);
    return null;
  }
}

function isValidIdea(story: HNItem): boolean {
  if (!story.title || story.type !== 'story') return false;

  // Must be a Show HN or have high score
  const isShowHN = story.title.toLowerCase().startsWith('show hn');
  const hasHighScore = (story.score || 0) >= 50;

  return isShowHN || hasHighScore;
}

function extractDescription(story: HNItem): string {
  // Use text if available (for Show HN), otherwise use title
  if (story.text) {
    // Strip HTML tags and decode entities
    const stripped = story.text.replace(/<[^>]*>/g, ' ').replace(/&[^;]+;/g, ' ');
    return stripped.slice(0, 500).trim();
  }
  return story.title || '';
}

function convertToIdea(story: HNItem): CollectedIdea {
  const url = story.url || `https://news.ycombinator.com/item?id=${story.id}`;
  const description = extractDescription(story);

  return {
    title: story.title!,
    description,
    url,
    source: 'hackernews',
    sourceId: story.id.toString(),
    sourceScore: story.score || 0,
    sourceComments: story.descendants || 0,
    discoveredAt: new Date(story.time * 1000).toISOString(),
    metadata: {
      by: story.by,
      type: story.type,
    },
  };
}

export async function collectHackerNews(): Promise<CollectorResult> {
  const startTime = Date.now();
  const items: CollectedIdea[] = [];
  const errors: string[] = [];

  try {
    // Fetch top stories
    const topResponse = await axios.get<number[]>(`${HN_API_BASE}/topstories.json`, {
      timeout: 10000,
    });
    const topStoryIds = topResponse.data.slice(0, 30); // Top 30

    // Fetch best stories
    const bestResponse = await axios.get<number[]>(`${HN_API_BASE}/beststories.json`, {
      timeout: 10000,
    });
    const bestStoryIds = bestResponse.data.slice(0, 20); // Top 20

    // Combine and deduplicate
    const allIds = [...new Set([...topStoryIds, ...bestStoryIds])];

    // Fetch stories in batches of 5
    const batchSize = 5;
    for (let i = 0; i < Math.min(allIds.length, 50); i += batchSize) {
      const batch = allIds.slice(i, i + batchSize);
      const stories = await Promise.all(batch.map((id) => fetchStory(id)));

      for (const story of stories) {
        if (!story) continue;

        if (isValidIdea(story)) {
          try {
            items.push(convertToIdea(story));
          } catch (error) {
            errors.push(`Failed to convert story ${story.id}: ${error}`);
          }
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`HackerNews API error: ${message}`);
  }

  const duration = Date.now() - startTime;

  return {
    source: 'hackernews',
    items,
    errors,
    duration,
  };
}
