import axios from 'axios';
import type { CollectedIdea, CollectorResult } from './types';
import { scoreDemandSignals, enrichWithSignals, SOURCE_THRESHOLDS } from './signals';

// Arctic Shift: real-time Reddit data mirror (arctic-shift.photon-reddit.com)
// Used instead of www.reddit.com which is unreachable from this server environment.
// Axios works fine with this domain (same approach as HN/GitHub collectors).
const ARCTIC_SHIFT_API = 'https://arctic-shift.photon-reddit.com/api/posts/search';
const REQUEST_TIMEOUT = 15000;
const RATE_LIMIT_DELAY = 1500;

const DEFAULT_SUBREDDITS = [
  'SaaS',
  'startups',
  'SideProject',
  'selfhosted',
  'Entrepreneur',
];

// --- Reddit post types (Arctic Shift returns standard Reddit JSON) ---

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  url: string;
  permalink: string;
  created_utc: number;
  upvote_ratio: number;
  subreddit: string;
  link_flair_text?: string | null;
  author: string;
  is_self: boolean;
  over_18: boolean;
  stickied: boolean;
}

interface ArcticShiftResponse {
  data: RedditPost[];
}

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Fetch ---

async function fetchSubreddit(
  subreddit: string,
  limit = 100
): Promise<RedditPost[]> {
  // Arctic Shift only supports sort_type: "default" | "created_utc"
  // Fetch recent posts and sort/filter by score locally
  const weekAgo = Math.floor(Date.now() / 1000) - 7 * 86400;

  const response = await axios.get<ArcticShiftResponse>(ARCTIC_SHIFT_API, {
    params: {
      subreddit,
      limit,
      sort: 'desc',
      sort_type: 'created_utc',
      after: weekAgo,
    },
    timeout: REQUEST_TIMEOUT,
  });

  return response.data?.data ?? [];
}

async function collectFromSubreddit(subreddit: string): Promise<RedditPost[]> {
  return fetchSubreddit(subreddit, 100);
}

// --- Filtering ---

const EXCLUDED_FLAIRS = ['META', 'MOD POST', 'MODERATOR', 'RULES'];

function shouldIncludePost(post: RedditPost): boolean {
  if (post.stickied) return false;
  if (post.over_18) return false;
  if (post.score < 5) return false;
  if (post.num_comments < 2) return false;
  if (post.upvote_ratio < 0.6) return false;

  if (!post.is_self && !post.selftext) {
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.gifv'];
    if (imageExts.some((ext) => post.url.toLowerCase().includes(ext))) return false;
    if (post.url.includes('i.redd.it') || post.url.includes('v.redd.it')) return false;
  }

  if (post.link_flair_text) {
    const flair = post.link_flair_text.toUpperCase();
    if (EXCLUDED_FLAIRS.some((f) => flair.includes(f))) return false;
  }

  return true;
}

// --- Conversion ---

function convertRedditPost(post: RedditPost): CollectedIdea {
  const description = post.selftext
    ? post.selftext.slice(0, 500).trim()
    : post.title;

  const redditUrl = `https://www.reddit.com${post.permalink}`;

  return {
    title: post.title,
    description,
    url: redditUrl,
    source: 'reddit',
    sourceId: post.id,
    sourceScore: post.score,
    sourceComments: post.num_comments,
    discoveredAt: new Date(post.created_utc * 1000).toISOString(),
    metadata: {
      subreddit: post.subreddit,
      upvoteRatio: post.upvote_ratio,
      flair: post.link_flair_text || null,
      author: post.author,
      externalUrl: !post.is_self ? post.url : null,
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

      const posts = await collectFromSubreddit(subreddit);
      let kept = 0;

      for (const post of posts) {
        if (!shouldIncludePost(post)) continue;

        const idea = convertRedditPost(post);
        const signals = scoreDemandSignals(idea.title, idea.description);

        const highDemand = signals.score >= (SOURCE_THRESHOLDS.reddit ?? 15);
        const highScore = post.score >= 20;

        if (highDemand || highScore) {
          items.push(enrichWithSignals(idea));
          kept++;
        }
      }

      console.log(`[Reddit] r/${subreddit}: ${posts.length} fetched, ${kept} kept`);

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
