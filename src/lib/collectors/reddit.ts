import type { CollectedIdea, CollectorResult } from './types';
import { scoreDemandSignals, enrichWithSignals, SOURCE_THRESHOLDS } from './signals';

const REDDIT_BASE = 'https://www.reddit.com';
const RATE_LIMIT_DELAY = 2000;
const REQUEST_TIMEOUT = 15000;

// Full browser headers required — minimal headers return 403
// Uses native fetch (Node 18+) which handles IPv4/IPv6 correctly
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

const DEFAULT_SUBREDDITS = [
  'SaaS',
  'startups',
  'SideProject',
  'selfhosted',
  'Entrepreneur',
];

// --- Atom RSS types ---

interface RssEntry {
  id: string;
  title: string;
  url: string;
  author: string;
  subreddit: string;
  description: string;
  publishedAt: string;
  isExternal: boolean;
}

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x200B;/g, '')
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractTextFromContent(encoded: string): string {
  return stripHtml(decodeHtmlEntities(encoded)).slice(0, 500);
}

function parseAtomFeed(xml: string, subreddit: string): RssEntry[] {
  const entries: RssEntry[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;

  while ((m = entryRegex.exec(xml)) !== null) {
    const block = m[1];

    const rawId = block.match(/<id>([^<]+)<\/id>/)?.[1]?.trim() ?? '';
    const id = rawId.replace(/^t3_/, '');
    if (!id) continue;

    const title = decodeHtmlEntities(
      block.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? ''
    );
    if (!title) continue;

    const url = block.match(/<link[^>]+href="([^"]+)"/)?.[1]?.trim() ?? '';
    if (!url) continue;

    const author = block.match(/<name>([^<]+)<\/name>/)?.[1]?.trim() ?? '';
    const publishedAt = block.match(/<published>([^<]+)<\/published>/)?.[1]?.trim() ?? new Date().toISOString();
    const rawContent = block.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] ?? '';
    const description = extractTextFromContent(rawContent);
    const isExternal = !url.includes('/comments/');

    entries.push({ id, title, url, author, subreddit, description, publishedAt, isExternal });
  }

  return entries;
}

// --- Fetch using native fetch (undici, works where axios hangs) ---

async function fetchSubredditRss(
  subreddit: string,
  sort: 'hot' | 'top',
  time?: 'week'
): Promise<RssEntry[]> {
  const params = new URLSearchParams({ limit: '25' });
  if (sort === 'top' && time) params.set('t', time);

  const url = `${REDDIT_BASE}/r/${subreddit}/${sort}/.rss?${params}`;

  const response = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for r/${subreddit}`);
  }

  const xml = await response.text();
  return parseAtomFeed(xml, subreddit);
}

async function collectFromSubreddit(subreddit: string): Promise<RssEntry[]> {
  const hot = await fetchSubredditRss(subreddit, 'hot');
  await sleep(RATE_LIMIT_DELAY);
  const top = await fetchSubredditRss(subreddit, 'top', 'week');

  const map = new Map<string, RssEntry>();
  for (const e of [...hot, ...top]) map.set(e.id, e);
  return Array.from(map.values());
}

// --- Filtering ---

function shouldIncludeEntry(entry: RssEntry): boolean {
  if (entry.title.length < 15) return false;
  if (entry.author === '/u/AutoModerator') return false;
  return true;
}

// --- Conversion ---

function convertEntry(entry: RssEntry): CollectedIdea {
  return {
    title: entry.title,
    description: entry.description || entry.title,
    url: entry.url,
    source: 'reddit',
    sourceId: entry.id,
    sourceScore: 0,
    sourceComments: 0,
    discoveredAt: entry.publishedAt,
    metadata: {
      subreddit: entry.subreddit,
      author: entry.author,
      externalUrl: entry.isExternal ? entry.url : null,
    },
  };
}

// --- Main Collector ---

export async function collectReddit(subreddits?: string[]): Promise<CollectorResult> {
  const startTime = Date.now();
  const items: CollectedIdea[] = [];
  const errors: string[] = [];
  const targetSubreddits = subreddits || DEFAULT_SUBREDDITS;

  for (const subreddit of targetSubreddits) {
    try {
      console.log(`[Reddit] Collecting from r/${subreddit}...`);

      const entries = await collectFromSubreddit(subreddit);
      let kept = 0;

      for (const entry of entries) {
        if (!shouldIncludeEntry(entry)) continue;

        const idea = convertEntry(entry);
        const signals = scoreDemandSignals(idea.title, idea.description);

        if (signals.score >= (SOURCE_THRESHOLDS.reddit ?? 15)) {
          items.push(enrichWithSignals(idea));
          kept++;
        }
      }

      console.log(`[Reddit] r/${subreddit}: ${entries.length} fetched, ${kept} kept`);

      await sleep(RATE_LIMIT_DELAY);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`r/${subreddit}: ${msg}`);
      console.error(`[Reddit] Error in r/${subreddit}:`, msg);

      await sleep(RATE_LIMIT_DELAY);
    }
  }

  console.log(`[Reddit] Total collected: ${items.length} items from ${targetSubreddits.length} subreddits`);

  return {
    source: 'reddit',
    items,
    errors,
    duration: Date.now() - startTime,
  };
}
