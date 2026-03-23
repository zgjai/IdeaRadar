import https from 'node:https';
import type { CollectedIdea, CollectorResult } from './types';
import { scoreDemandSignals, enrichWithSignals, SOURCE_THRESHOLDS } from './signals';

const REDDIT_BASE = 'https://www.reddit.com';
const RATE_LIMIT_DELAY = 2000;
const REQUEST_TIMEOUT = 12000;
const MAX_REDIRECTS = 3;

// Next.js patches globalThis.fetch which breaks external requests.
// Use node:https directly with IPv4 + browser headers to bypass this.
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'identity',
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

// --- HTTP helper ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpsGet(url: string, redirectsLeft = MAX_REDIRECTS): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      family: 4, // Force IPv4 — Reddit times out on IPv6 from datacenter IPs
      headers: BROWSER_HEADERS,
      timeout: REQUEST_TIMEOUT,
    } as Parameters<typeof https.get>[1], (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));
        res.resume();
        return httpsGet(res.headers.location, redirectsLeft - 1).then(resolve).catch(reject);
      }

      if (res.statusCode && res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${REQUEST_TIMEOUT}ms`));
    });
  });
}

// --- Atom XML parser ---

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

// --- Fetch ---

async function fetchSubredditRss(
  subreddit: string,
  sort: 'hot' | 'top',
  time?: 'week'
): Promise<RssEntry[]> {
  const params = new URLSearchParams({ limit: '25' });
  if (sort === 'top' && time) params.set('t', time);

  const url = `${REDDIT_BASE}/r/${subreddit}/${sort}/.rss?${params}`;
  const xml = await httpsGet(url);
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
