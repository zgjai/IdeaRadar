import axios from 'axios';
import type { CollectedIdea, CollectorResult } from './types';
import { scoreDemandSignals, enrichWithSignals, SOURCE_THRESHOLDS } from './signals';

const GITHUB_API_BASE = 'https://api.github.com';
const REQUEST_TIMEOUT = 15000;

// Topics that indicate a product/tool (not a library or tutorial)
const PRODUCT_TOPICS = new Set([
  'saas', 'tool', 'cli', 'automation', 'app', 'desktop-app', 'web-app',
  'productivity', 'devtools', 'developer-tools', 'self-hosted', 'selfhosted',
  'api', 'platform', 'dashboard', 'monitoring', 'analytics', 'editor',
  'generator', 'builder', 'low-code', 'no-code', 'ai', 'llm', 'chatbot',
]);

// Topics that indicate NOT a product idea (filter out)
const EXCLUDED_TOPICS = new Set([
  'awesome', 'awesome-list', 'tutorial', 'course', 'learning',
  'interview', 'cheatsheet', 'roadmap', 'guide', 'documentation',
  'dotfiles', 'config', 'template', 'boilerplate', 'starter',
]);

// --- GitHub API types ---

interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  topics: string[];
  license: { key: string; name: string } | null;
  owner: { login: string; type: string };
}

interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepo[];
}

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

// --- Fetch ---

async function searchRepos(query: string, perPage = 30): Promise<GitHubRepo[]> {
  try {
    const response = await axios.get<GitHubSearchResponse>(
      `${GITHUB_API_BASE}/search/repositories`,
      {
        params: { q: query, sort: 'stars', order: 'desc', per_page: perPage },
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'IdeaRadar/2.0',
        },
        timeout: REQUEST_TIMEOUT,
      }
    );
    return response.data.items || [];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      throw new Error('GitHub API rate limit exceeded');
    }
    throw error;
  }
}

/** Query 1: Recently created repos with significant stars */
async function fetchTrendingRepos(): Promise<GitHubRepo[]> {
  const since = daysAgo(30);
  return searchRepos(`created:>${since} stars:>50`, 30);
}

/** Query 2: Tool/SaaS-specific repos created recently */
async function fetchProductRepos(): Promise<GitHubRepo[]> {
  const since = daysAgo(14);
  return searchRepos(
    `created:>${since} stars:>20 topic:saas OR topic:tool OR topic:cli OR topic:automation OR topic:self-hosted`,
    30
  );
}

// --- Filtering ---

function hasExcludedTopic(repo: GitHubRepo): boolean {
  return repo.topics.some((t) => EXCLUDED_TOPICS.has(t.toLowerCase()));
}

function hasProductTopic(repo: GitHubRepo): boolean {
  return repo.topics.some((t) => PRODUCT_TOPICS.has(t.toLowerCase()));
}

function isLikelyProduct(repo: GitHubRepo): boolean {
  // Must have a description
  if (!repo.description) return false;

  // Exclude tutorials, awesome lists, etc.
  if (hasExcludedTopic(repo)) return false;

  // Name-based exclusions
  const nameLower = repo.name.toLowerCase();
  if (nameLower.startsWith('awesome-') || nameLower.endsWith('-tutorial')) return false;

  // Positive signals: has homepage (shipped product) or product topics
  if (repo.homepage && repo.homepage.length > 0) return true;
  if (hasProductTopic(repo)) return true;

  // Fall through: still keep if stars are high enough (100+ stars suggests real product)
  if (repo.stargazers_count >= 100) return true;

  return false;
}

// --- Conversion ---

function convertGitHubRepo(repo: GitHubRepo): CollectedIdea {
  const description = repo.description || repo.full_name;
  const title = repo.description
    ? `${repo.full_name}: ${repo.description.slice(0, 100)}`
    : repo.full_name;

  return {
    title,
    description,
    url: repo.html_url,
    source: 'github',
    sourceId: `gh_${repo.id}`,
    sourceScore: repo.stargazers_count,
    sourceComments: repo.open_issues_count,
    discoveredAt: repo.created_at,
    metadata: {
      fullName: repo.full_name,
      language: repo.language,
      topics: repo.topics,
      homepage: repo.homepage,
      forks: repo.forks_count,
      license: repo.license?.key || null,
      ownerType: repo.owner.type,
    },
  };
}

// --- Main Collector ---

export async function collectGitHub(): Promise<CollectorResult> {
  const startTime = Date.now();
  const items: CollectedIdea[] = [];
  const errors: string[] = [];

  try {
    // Fetch from both queries
    const [trendingRepos, productRepos] = await Promise.all([
      fetchTrendingRepos().catch((err) => {
        errors.push(`Trending: ${err instanceof Error ? err.message : err}`);
        return [] as GitHubRepo[];
      }),
      fetchProductRepos().catch((err) => {
        errors.push(`Products: ${err instanceof Error ? err.message : err}`);
        return [] as GitHubRepo[];
      }),
    ]);

    // Combine and deduplicate by repo ID
    const allRepos = [...trendingRepos, ...productRepos];
    const uniqueRepos = Array.from(
      new Map(allRepos.map((repo) => [repo.id, repo])).values()
    );

    console.log(
      `[GitHub] Fetched ${uniqueRepos.length} unique repos (Trending: ${trendingRepos.length}, Products: ${productRepos.length})`
    );

    // Filter and convert
    for (const repo of uniqueRepos) {
      if (!isLikelyProduct(repo)) continue;

      const idea = convertGitHubRepo(repo);
      const signals = scoreDemandSignals(idea.title, idea.description);

      const highStars = repo.stargazers_count >= 100;
      const highDemand = signals.score >= (SOURCE_THRESHOLDS.github ?? 15);

      if (highStars || highDemand) {
        items.push(enrichWithSignals(idea));
      }
    }

    console.log(`[GitHub] Kept ${items.length} items after filtering`);
  } catch (error) {
    errors.push(`GitHub API error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    source: 'github',
    items,
    errors,
    duration: Date.now() - startTime,
  };
}
