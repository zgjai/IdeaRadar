import axios from 'axios';
import type { CollectedIdea, CollectorResult } from './types';
import { scoreDemandSignals, enrichWithSignals, SOURCE_THRESHOLDS } from './signals';

const REDDIT_BASE = 'https://www.reddit.com';
const USER_AGENT = 'IdeaRadar/2.0 (Product idea discovery tool)';
const RATE_LIMIT_DELAY = 1500; // 1.5s between requests (conservative)
const REQUEST_TIMEOUT = 10000;

const DEFAULT_SUBREDDITS = [
  'SaaS',
  'startups',
  'SideProject',
  'selfhosted',
  'Entrepreneur',
];

// --- Reddit API types ---

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
  link_flair_text?: string;
  author: string;
  is_self: boolean;
  over_18: boolean;
  stickied: boolean;
}

interface RedditListing {
  data: {
    children: Array<{
      kind: string;
      data: RedditPost;
    }>;
    after: string | null;
  };
}

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Fetch ---

async function fetchSubreddit(
  subreddit: string,
  sort: 'hot' | 'new' | 'top',
  time?: 'day' | 'week' | 'month'
): Promise<RedditPost[]> {
  const params = new URLSearchParams({
    limit: '25',
    raw_json: '1', // Avoid HTML encoding in selftext
  });
  if (time) params.set('t', time);

  const url = `${REDDIT_BASE}/r/${subreddit}/${sort}.json?${params}`;

  try {
    const response = await axios.get<RedditListing>(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: REQUEST_TIMEOUT,
    });

    if (!response.data?.data?.children) {
      return [];
    }

    return response.data.data.children
      .filter((child) => child.kind === 't3')
      .map((child) => child.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        throw new Error(`Reddit rate limit exceeded for r/${subreddit}`);
      }
      if (error.response?.status === 403) {
        throw new Error(`Reddit access denied for r/${subreddit} (may need different User-Agent)`);
      }
    }
    throw error;
  }
}

async function collectFromSubreddit(subreddit: string): Promise<RedditPost[]> {
  const allPosts: RedditPost[] = [];

  // Fetch hot (currently trending)
  const hot = await fetchSubreddit(subreddit, 'hot');
  allPosts.push(...hot);

  await sleep(RATE_LIMIT_DELAY);

  // Fetch top of the week (proven winners)
  const top = await fetchSubreddit(subreddit, 'top', 'week');
  allPosts.push(...top);

  // Deduplicate by ID
  return Array.from(
    new Map(allPosts.map((post) => [post.id, post])).values()
  );
}

// --- Filtering ---

const EXCLUDED_FLAIRS = ['META', 'MOD POST', 'MODERATOR', 'RULES'];

function shouldIncludePost(post: RedditPost): boolean {
  // Skip stickied posts (usually mod announcements)
  if (post.stickied) return false;

  // Skip NSFW
  if (post.over_18) return false;

  // Minimum engagement
  if (post.score < 5) return false;
  if (post.num_comments < 2) return false;

  // Upvote ratio check (avoid controversial/spam)
  if (post.upvote_ratio < 0.6) return false;

  // Skip image/video-only posts (no text content to analyze)
  if (!post.is_self && !post.selftext) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.gifv'];
    if (imageExtensions.some((ext) => post.url.toLowerCase().includes(ext))) return false;
    if (post.url.includes('i.redd.it') || post.url.includes('v.redd.it')) return false;
  }

  // Exclude certain flairs
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

  const redditUrl = `${REDDIT_BASE}${post.permalink}`;

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

      // Rate limiting between subreddits
      await sleep(RATE_LIMIT_DELAY);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`r/${subreddit}: ${msg}`);
      console.error(`[Reddit] Error in r/${subreddit}:`, msg);

      // Still wait before next subreddit even on error
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
