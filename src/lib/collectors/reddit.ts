import { execFile } from 'node:child_process';
import type { CollectedIdea, CollectorResult } from './types';
import { scoreDemandSignals, enrichWithSignals, SOURCE_THRESHOLDS } from './signals';

const REDDIT_BASE = 'https://www.reddit.com';
const RATE_LIMIT_DELAY = 2000;
const REQUEST_TIMEOUT = 12; // curl --max-time in seconds

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

// --- HTTP via curl ---
// Next.js Turbopack rewrites/patches both fetch and node:https, breaking
// external requests to Reddit. Spawn curl as a subprocess to guarantee
// the same network path that works from the command line.

function curlGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('curl', [
      '-sS', '-L', '-4',
      '--max-time', String(REQUEST_TIMEOUT),
      '-A', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      '-H', 'Accept-Language: en-US,en;q=0.5',
      url,
    ], { maxBuffer: 4 * 1024 * 1024, timeout: (REQUEST_TIMEOUT + 3) * 1000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      if (!stdout || stdout.length < 50) return reject(new Error(`Empty response from ${url}`));
      resolve(stdout);
    });
  });
}

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const xml = await curlGet(url);
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
