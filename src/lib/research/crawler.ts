/**
 * Website crawler: fetches and extracts text content from a target URL
 * and its key sub-pages (about, pricing, features, etc.)
 */

export interface CrawlResult {
  url: string;
  domain: string;
  title: string;
  pages: PageContent[];
  totalTextLength: number;
}

export interface PageContent {
  url: string;
  path: string;
  title: string;
  text: string;
}

const COMMON_SUBPAGES = [
  '/about', '/pricing', '/features', '/product',
  '/about-us', '/plans', '/solutions',
];

const SKIP_DOMAINS = new Set([
  'google.com', 'facebook.com', 'twitter.com', 'youtube.com',
  'linkedin.com', 'instagram.com', 'github.com',
]);

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Strip HTML tags and extract meaningful text content
 */
function htmlToText(html: string): { title: string; text: string; links: string[] } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : '';

  // Extract meta description
  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i);
  const metaDesc = metaDescMatch ? metaDescMatch[1].trim() : '';

  // Remove script, style, noscript, svg, and head tags
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '');

  // Extract internal links before stripping tags
  const links: string[] = [];
  const linkRegex = /href=["'](\/[^"'#?]*?)["']/gi;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const path = linkMatch[1].toLowerCase();
    if (COMMON_SUBPAGES.some((sub) => path === sub || path === sub + '/')) {
      links.push(linkMatch[1]);
    }
  }

  // Replace block-level elements with newlines
  cleaned = cleaned
    .replace(/<\/?(div|p|h[1-6]|li|tr|br|hr|section|article|header|footer|nav|main)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')         // Remove remaining tags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#\d+;/g, '')
    .replace(/[ \t]+/g, ' ')          // Collapse whitespace
    .replace(/\n\s*\n/g, '\n')        // Collapse blank lines
    .trim();

  // Prepend meta description if available
  const text = metaDesc ? `${metaDesc}\n\n${cleaned}` : cleaned;

  return { title, text, links: [...new Set(links)] };
}

/**
 * Fetch a single page with timeout and error handling
 */
async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IdeaRadar/1.0; +https://idearadar.ai)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;

    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Crawl a website: fetch the main page + discover and fetch key sub-pages
 */
export async function crawlSite(url: string): Promise<CrawlResult> {
  const domain = extractDomain(url);

  if (SKIP_DOMAINS.has(domain)) {
    throw new Error(`不支持分析该网站: ${domain}`);
  }

  // Normalize URL
  let normalizedUrl = url;
  if (!normalizedUrl.startsWith('http')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  const baseUrl = new URL(normalizedUrl);
  const origin = baseUrl.origin;

  // 1. Fetch main page
  const mainHtml = await fetchPage(normalizedUrl);
  if (!mainHtml) {
    throw new Error(`无法访问该网站: ${normalizedUrl}`);
  }

  const mainParsed = htmlToText(mainHtml);
  const pages: PageContent[] = [{
    url: normalizedUrl,
    path: '/',
    title: mainParsed.title,
    text: mainParsed.text.slice(0, 15000), // Limit per page
  }];

  // 2. Discover and fetch sub-pages (max 4 additional pages)
  const subPaths = [...new Set([...mainParsed.links, ...COMMON_SUBPAGES])].slice(0, 6);

  const subResults = await Promise.allSettled(
    subPaths.map(async (path) => {
      const subUrl = `${origin}${path}`;
      const html = await fetchPage(subUrl);
      if (!html) return null;
      const parsed = htmlToText(html);
      if (parsed.text.length < 100) return null; // Skip empty pages
      return {
        url: subUrl,
        path,
        title: parsed.title,
        text: parsed.text.slice(0, 8000),
      };
    })
  );

  for (const result of subResults) {
    if (result.status === 'fulfilled' && result.value) {
      pages.push(result.value);
      if (pages.length >= 5) break; // Max 5 pages total
    }
  }

  const totalTextLength = pages.reduce((sum, p) => sum + p.text.length, 0);

  return {
    url: normalizedUrl,
    domain,
    title: mainParsed.title,
    pages,
    totalTextLength,
  };
}
