import axios from 'axios';
import type { CollectedIdea, CollectorResult } from './types';
import { scoreDemandSignals, enrichWithSignals, SOURCE_THRESHOLDS } from './signals';

const REDDIT_BASE = 'https://www.reddit.com';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const RATE_LIMIT_DELAY = 2000;
const REQUEST_TIMEOUT = 15000;

const DEFAULT_SUBREDDITS = [
  'SaaS',
  'startups',
  'SideProject',
  'selfhosted',
  'Entrepreneur',
];

// --- Atom RSS types ---

interface RssEntry {
  id: string;         // e.g. "t3_abc123"
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

/** Decode HTML entities in a string */
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

/** Strip HTML tags and collapse whitespace */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract text content from HTML-encoded Atom <content> field */
function extractTextFromContent(encoded: string): string {
  const decoded = decodeHtmlEntities(encoded);
  return stripHtml(decoded).slice(0, 500);
}

/** Parse Reddit Atom RSS XML into entry objects */
function parseAtomFeed(xml: string, subreddit: string): RssEntry[] {
  const entries: RssEntry[] = [];

  // Match each <entry>...</entry> block
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let entryMatch: RegExpExecArray | null;

  while ((entryMatch = entryRegex.exec(xml)) !== null) {
    const block = entryMatch[1];

    // id: <id>t3_abc123</id>
    const idMatch = block.match(/<id>([^<]+)<\/id>/);
    const rawId = idMatch?.[1]?.trim() ?? '';
    const id = rawId.replace(/^t3_/, '');
    if (!id) continue;

    // title: <title>Post title here</title>
    const titleMatch = block.match(/<title>([^<]*)<\/title>/);
    const title = decodeHtmlEntities(titleMatch?.[1]?.trim() ?? '');
    if (!title) continue;

    // link: <link href="https://..." />
    const linkMatch = block.match(/<link[^>]+href="([^"]+)"/);
    const url = linkMatch?.[1]?.trim() ?? '';
    if (!url) continue;

    // author: <name>/u/username</name>
    const authorMatch = block.match(/<name>([^<]+)<\/name>/);
    const author = authorMatch?.[1]?.trim() ?? '';

    // published: <published>2026-03-23T08:24:59+00:00</published>
    const pubMatch = block.match(/<published>([^<]+)<\/published>/);
    const publishedAt = pubMatch?.[1]?.trim() ?? new Date().toISOString();

    // content: <content type="html">...</content>
    const contentMatch = block.match(/<content[^>]*>([\s\S]*?)<\/content>/);
    const rawContent = contentMatch?.[1] ?? '';
    const description = extractTextFromContent(rawContent);

    // Detect if external link (non-reddit URL in content)
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

  const response = await axios.get<string>(url, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: REQUEST_TIMEOUT,
    responseType: 'text',
  });

  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status} for r/${subreddit}`);
  }

  return parseAtomFeed(response.data, subreddit);
}

async function collectFromSubreddit(subreddit: string): Promise<RssEntry[]> {
  const hot = await fetchSubredditRss(subreddit, 'hot');
  await sleep(RATE_LIMIT_DELAY);
  const top = await fetchSubredditRss(subreddit, 'top', 'week');

  // Deduplicate by ID
  const map = new Map<string, RssEntry>();
  for (const e of [...hot, ...top]) map.set(e.id, e);
  return Array.from(map.values());
}

// --- Filtering ---

function shouldIncludeEntry(entry: RssEntry): boolean {
  // Skip very short titles (likely mod posts)
  if (entry.title.length < 15) return false;

  // Skip AutoModerator posts
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
    sourceScore: 0,      // Not available in RSS
    sourceComments: 0,   // Not available in RSS
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

        // RSS has no score data — rely on demand signal scoring only
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
