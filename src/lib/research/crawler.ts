/**
 * Website crawler with multi-strategy content extraction
 * Inspired by agent-fetch: runs Readability + CSS selectors + JSON-LD + Next.js in parallel,
 * picks the best result by content length/quality.
 */
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CrawlResult {
  url: string;
  domain: string;
  title: string;
  description: string;
  pages: PageContent[];
  metadata: SiteMetadata;
  totalTextLength: number;
}

export interface PageContent {
  url: string;
  path: string;
  title: string;
  markdown: string;
  extractionMethod: string;
}

export interface SiteMetadata {
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  siteName?: string;
  themeColor?: string;
  generator?: string;
  jsonLd?: Record<string, unknown>[];
  techSignals: string[];
}

interface ExtractionCandidate {
  method: string;
  title: string;
  content: string; // markdown
  length: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COMMON_SUBPAGES = [
  '/about', '/pricing', '/features', '/product',
  '/about-us', '/plans', '/solutions', '/blog',
];

const SKIP_DOMAINS = new Set([
  'google.com', 'facebook.com', 'twitter.com', 'youtube.com',
  'linkedin.com', 'instagram.com',
]);

const GOOD_CONTENT_LENGTH = 500;

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ─── Turndown (HTML → Markdown) ─────────────────────────────────────────────

let turndown: TurndownService | null = null;

function getTurndown(): TurndownService {
  if (!turndown) {
    turndown = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      strongDelimiter: '**',
    });
    turndown.use(gfm);
    turndown.remove(['script', 'style', 'noscript', 'svg', 'iframe']);
  }
  return turndown;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function htmlToMarkdown(html: string): string {
  return getTurndown().turndown(html);
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#\d+;/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) return null;

    const text = await response.text();
    // Reject tiny pages
    if (text.length < 1000) return null;
    return text;
  } catch {
    return null;
  }
}

// ─── Metadata Extraction ─────────────────────────────────────────────────────

function extractMetadata(doc: Document): SiteMetadata {
  const getMeta = (name: string): string | undefined => {
    const el = doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
    return el?.getAttribute('content') || undefined;
  };

  // JSON-LD
  const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
  const jsonLd: Record<string, unknown>[] = [];
  jsonLdScripts.forEach((script) => {
    try {
      const data = JSON.parse(script.textContent || '');
      if (Array.isArray(data)) jsonLd.push(...data);
      else jsonLd.push(data);
    } catch { /* skip malformed */ }
  });

  // Tech signals detection
  const techSignals: string[] = [];
  const htmlStr = doc.documentElement?.outerHTML || '';
  if (doc.querySelector('script[id="__NEXT_DATA__"]') || htmlStr.includes('__next')) techSignals.push('Next.js');
  if (doc.querySelector('script[id="__NUXT_DATA__"]') || htmlStr.includes('__nuxt')) techSignals.push('Nuxt');
  if (htmlStr.includes('wp-content') || htmlStr.includes('wp-json')) techSignals.push('WordPress');
  if (htmlStr.includes('shopify')) techSignals.push('Shopify');
  if (htmlStr.includes('webflow')) techSignals.push('Webflow');
  if (htmlStr.includes('react') || htmlStr.includes('_reactRoot')) techSignals.push('React');
  if (htmlStr.includes('vue') || htmlStr.includes('v-if')) techSignals.push('Vue');
  if (htmlStr.includes('angular') || htmlStr.includes('ng-')) techSignals.push('Angular');
  if (htmlStr.includes('tailwindcss') || htmlStr.includes('tailwind')) techSignals.push('Tailwind CSS');
  if (htmlStr.includes('stripe')) techSignals.push('Stripe');
  if (htmlStr.includes('intercom')) techSignals.push('Intercom');
  if (htmlStr.includes('segment') || htmlStr.includes('analytics.js')) techSignals.push('Segment');
  if (htmlStr.includes('gtag') || htmlStr.includes('google-analytics')) techSignals.push('Google Analytics');

  const generator = getMeta('generator');
  if (generator) techSignals.push(generator);

  return {
    ogTitle: getMeta('og:title'),
    ogDescription: getMeta('og:description'),
    ogImage: getMeta('og:image'),
    siteName: getMeta('og:site_name'),
    themeColor: getMeta('theme-color'),
    generator,
    jsonLd: jsonLd.length > 0 ? jsonLd : undefined,
    techSignals: [...new Set(techSignals)],
  };
}

// ─── Strategy 1: Mozilla Readability ─────────────────────────────────────────

function extractWithReadability(html: string, url: string): ExtractionCandidate | null {
  try {
    const { document } = parseHTML(html);
    const reader = new Readability(document, { charThreshold: 100 });
    const article = reader.parse();
    if (!article?.content) return null;

    const markdown = htmlToMarkdown(article.content);
    if (markdown.length < 100) return null;

    return {
      method: 'readability',
      title: article.title || '',
      content: markdown,
      length: markdown.length,
    };
  } catch {
    return null;
  }
}

// ─── Strategy 2: CSS Selector Probing ────────────────────────────────────────

const CONTENT_SELECTORS = [
  'article',
  'main article',
  '[role="main"] article',
  '.article-content, .article-body, .post-content, .entry-content',
  '.page-content, .content-area, .site-content',
  '[itemprop="articleBody"]',
  'main, [role="main"]',
  '#content, .content',
];

const REMOVE_SELECTORS = 'script, style, nav, aside, footer, header, form, iframe, .ads, .social-share, .related-articles, .comments, .cookie-banner, .popup, .modal';

function extractWithSelectors(html: string): ExtractionCandidate | null {
  try {
    const { document } = parseHTML(html);

    // Remove noise elements
    document.querySelectorAll(REMOVE_SELECTORS).forEach((el: Element) => el.remove());

    for (const selector of CONTENT_SELECTORS) {
      const el = document.querySelector(selector);
      if (el && el.innerHTML.length > 200) {
        const markdown = htmlToMarkdown(el.innerHTML);
        if (markdown.length >= 200) {
          return {
            method: `selector:${selector.slice(0, 30)}`,
            title: '',
            content: markdown,
            length: markdown.length,
          };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Strategy 3: JSON-LD Structured Data ─────────────────────────────────────

function extractFromJsonLd(html: string): ExtractionCandidate | null {
  try {
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (!jsonLdMatch) return null;

    for (const match of jsonLdMatch) {
      const jsonStr = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
      try {
        let data = JSON.parse(jsonStr);

        // Handle @graph structure
        if (data['@graph']) data = data['@graph'];
        if (Array.isArray(data)) {
          data = data.find((item: Record<string, unknown>) =>
            ['Article', 'NewsArticle', 'BlogPosting', 'WebPage', 'Product', 'SoftwareApplication']
              .some((t) => String(item['@type']).includes(t))
          );
        }
        if (!data) continue;

        const body = data.articleBody || data.text || data.description || '';
        const title = data.headline || data.name || '';

        if (typeof body === 'string' && body.length >= GOOD_CONTENT_LENGTH) {
          return {
            method: 'json-ld',
            title: String(title),
            content: body,
            length: body.length,
          };
        }
      } catch { /* skip malformed JSON-LD */ }
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Strategy 4: Next.js __NEXT_DATA__ ───────────────────────────────────────

function extractFromNextData(html: string): ExtractionCandidate | null {
  try {
    const match = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
    if (!match) return null;

    const data = JSON.parse(match[1]);
    const props = data?.props?.pageProps;
    if (!props) return null;

    // Probe common paths for content
    const paths = [
      props.content?.body,
      props.article?.body,
      props.article?.content,
      props.post?.body,
      props.post?.content,
      props.data?.body,
      props.page?.content,
    ];

    for (const body of paths) {
      if (typeof body === 'string' && body.length >= GOOD_CONTENT_LENGTH) {
        const content = body.startsWith('<') ? htmlToMarkdown(body) : body;
        return {
          method: 'next-data',
          title: props.title || props.article?.title || props.post?.title || '',
          content,
          length: content.length,
        };
      }
    }

    // Fallback: stringify the pageProps for inspection
    const propsStr = JSON.stringify(props, null, 2);
    if (propsStr.length >= GOOD_CONTENT_LENGTH) {
      return {
        method: 'next-data-raw',
        title: '',
        content: propsStr.slice(0, 20000),
        length: Math.min(propsStr.length, 20000),
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Strategy 5: Full-page fallback (regex strip) ────────────────────────────

function extractFullPageFallback(html: string): ExtractionCandidate | null {
  const text = stripHtmlToText(html);
  if (text.length < 200) return null;
  return {
    method: 'full-page-strip',
    title: '',
    content: text,
    length: text.length,
  };
}

// ─── Winner Selection ────────────────────────────────────────────────────────

function pickBestCandidate(candidates: (ExtractionCandidate | null)[]): ExtractionCandidate | null {
  const valid = candidates.filter((c): c is ExtractionCandidate => c !== null && c.length > 0);
  if (valid.length === 0) return null;

  // Prefer good candidates (>= GOOD_CONTENT_LENGTH)
  const good = valid.filter((c) => c.length >= GOOD_CONTENT_LENGTH);
  if (good.length > 0) {
    // Prefer readability if it's good enough
    const readability = good.find((c) => c.method === 'readability');
    if (readability) {
      // But if another strategy found 2x more, prefer that
      const longest = good.reduce((a, b) => (a.length > b.length ? a : b));
      if (longest.length > readability.length * 2 && longest.method !== 'full-page-strip') {
        return longest;
      }
      return readability;
    }
    // Otherwise pick longest
    return good.reduce((a, b) => (a.length > b.length ? a : b));
  }

  // Fallback: pick longest from any candidate
  return valid.reduce((a, b) => (a.length > b.length ? a : b));
}

// ─── Link Discovery ──────────────────────────────────────────────────────────

function discoverSubpageLinks(html: string): string[] {
  const links: string[] = [];
  const linkRegex = /href=["'](\/[^"'#?]*?)["']/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const path = match[1].toLowerCase().replace(/\/+$/, '');
    if (COMMON_SUBPAGES.includes(path)) {
      links.push(match[1]);
    }
  }
  return [...new Set(links)];
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim().replace(/\s+/g, ' ') : '';
}

function extractDescription(html: string): string {
  const match = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i);
  return match ? match[1].trim() : '';
}

// ─── Main Extract Function ───────────────────────────────────────────────────

function extractPage(html: string, url: string): { title: string; markdown: string; method: string } {
  // Run all strategies
  const candidates = [
    extractWithReadability(html, url),
    extractWithSelectors(html),
    extractFromJsonLd(html),
    extractFromNextData(html),
    extractFullPageFallback(html),
  ];

  const winner = pickBestCandidate(candidates);
  const fallbackTitle = extractTitle(html);

  if (!winner) {
    return { title: fallbackTitle, markdown: stripHtmlToText(html).slice(0, 5000), method: 'raw-strip' };
  }

  return {
    title: winner.title || fallbackTitle,
    markdown: winner.content,
    method: winner.method,
  };
}

// ─── Public: Crawl Site ──────────────────────────────────────────────────────

export async function crawlSite(url: string): Promise<CrawlResult> {
  const domain = extractDomain(url);

  if (SKIP_DOMAINS.has(domain)) {
    throw new Error(`不支持分析该网站: ${domain}`);
  }

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

  // 2. Extract metadata from main page
  const { document: mainDoc } = parseHTML(mainHtml);
  const metadata = extractMetadata(mainDoc);

  // 3. Extract content from main page
  const mainExtracted = extractPage(mainHtml, normalizedUrl);
  const description = extractDescription(mainHtml) || metadata.ogDescription || '';

  const pages: PageContent[] = [{
    url: normalizedUrl,
    path: '/',
    title: mainExtracted.title,
    markdown: mainExtracted.markdown.slice(0, 20000),
    extractionMethod: mainExtracted.method,
  }];

  // 4. Discover and fetch sub-pages (max 4 additional)
  const discoveredLinks = discoverSubpageLinks(mainHtml);
  const subPaths = [...new Set([...discoveredLinks, ...COMMON_SUBPAGES])].slice(0, 6);

  const subResults = await Promise.allSettled(
    subPaths.map(async (path) => {
      const subUrl = `${origin}${path}`;
      const html = await fetchPage(subUrl);
      if (!html) return null;
      const extracted = extractPage(html, subUrl);
      if (extracted.markdown.length < 100) return null;
      return {
        url: subUrl,
        path,
        title: extracted.title,
        markdown: extracted.markdown.slice(0, 10000),
        extractionMethod: extracted.method,
      };
    })
  );

  for (const result of subResults) {
    if (result.status === 'fulfilled' && result.value) {
      pages.push(result.value);
      if (pages.length >= 5) break;
    }
  }

  const totalTextLength = pages.reduce((sum, p) => sum + p.markdown.length, 0);

  return {
    url: normalizedUrl,
    domain,
    title: mainExtracted.title || metadata.ogTitle || domain,
    description,
    pages,
    metadata,
    totalTextLength,
  };
}
