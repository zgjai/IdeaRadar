import axios from 'axios';
import type { CollectedIdea, CollectorResult } from './types';
import { scoreDemandSignals, enrichWithSignals, SOURCE_THRESHOLDS } from './signals';

const REDDIT_OAUTH_BASE = 'https://oauth.reddit.com';
const REDDIT_AUTH_URL = 'https://www.reddit.com/api/v1/access_token';
const USER_AGENT = 'IdeaRadar/2.4 (Product idea discovery; contact admin)';
const RATE_LIMIT_DELAY = 1500; // 1.5s between requests (conservative)
const REQUEST_TIMEOUT = 15000;

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

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

// --- OAuth2 Token Manager ---

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Reddit OAuth2 credentials not configured. Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET.'
    );
  }

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const response = await axios.post<RedditTokenResponse>(
    REDDIT_AUTH_URL,
    'grant_type=client_credentials',
    {
      auth: {
        username: clientId,
        password: clientSecret,
      },
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: REQUEST_TIMEOUT,
    }
  );

  cachedToken = response.data.access_token;
  tokenExpiresAt = Date.now() + response.data.expires_in * 1000;

  return cachedToken;
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
  const token = await getAccessToken();

  const params = new URLSearchParams({ limit: '25', raw_json: '1' });
  if (time) params.set('t', time);

  const url = `${REDDIT_OAUTH_BASE}/r/${subreddit}/${sort}?${params}`;

  try {
    const response = await axios.get<RedditListing>(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Authorization: `Bearer ${token}`,
      },
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
      if (error.response?.status === 401) {
        // Token expired or invalid — clear cache and let caller retry
        cachedToken = null;
        tokenExpiresAt = 0;
        throw new Error(`Reddit auth failed for r/${subreddit} — token expired`);
      }
      if (error.response?.status === 429) {
        throw new Error(`Reddit rate limit exceeded for r/${subreddit}`);
      }
      if (error.response?.status === 403) {
        throw new Error(`Reddit access denied for r/${subreddit}`);
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
  if (post.stickied) return false;
  if (post.over_18) return false;
  if (post.score < 5) return false;
  if (post.num_comments < 2) return false;
  if (post.upvote_ratio < 0.6) return false;

  if (!post.is_self && !post.selftext) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.gifv'];
    if (imageExtensions.some((ext) => post.url.toLowerCase().includes(ext))) return false;
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

  // Check credentials before starting
  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
    console.warn('[Reddit] Skipping: REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set.');
    console.warn('[Reddit] To enable: create a Reddit app at https://www.reddit.com/prefs/apps');
    return {
      source: 'reddit',
      items: [],
      errors: ['Reddit OAuth2 credentials not configured (set REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET)'],
      duration: Date.now() - startTime,
    };
  }

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
