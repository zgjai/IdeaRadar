import { db } from '../db';
import { keywords, keywordClusters, ideaKeywords, ideas } from '../db/schema';
import { eq, sql, inArray } from 'drizzle-orm';
import { getDataForSEOClient, type KeywordData } from '../api/dataforseo';
import { cacheGet, CacheKeys } from '../cache';
import { withBudgetCheck } from '../budget/manager';
import type { Idea } from '../db/schema';

// Stop words for filtering low-value keywords
const STOP_WORDS = new Set([
  'login', 'signin', 'sign in', 'log in', 'download', 'free download',
  'crack', 'keygen', 'torrent', 'wiki', 'wikipedia',
]);

/**
 * Extract seed keywords from an idea using AI summary + title
 */
export function extractSeedKeywords(idea: Idea): string[] {
  const seeds = new Set<string>();

  // From title: split and clean
  const titleWords = idea.title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Use full title as primary keyword
  if (idea.title.length < 80) {
    seeds.add(idea.title.toLowerCase().trim());
  }

  // Use AI category if available
  if (idea.category) {
    seeds.add(`${idea.title.toLowerCase()} ${idea.category.toLowerCase()}`.trim());
  }

  // Build 2-3 word combinations from title
  for (let i = 0; i < titleWords.length - 1; i++) {
    seeds.add(`${titleWords[i]} ${titleWords[i + 1]}`);
    if (i < titleWords.length - 2) {
      seeds.add(`${titleWords[i]} ${titleWords[i + 1]} ${titleWords[i + 2]}`);
    }
  }

  // Add commercial modifiers for the most likely product keyword
  const productName = titleWords.slice(0, 3).join(' ');
  if (productName) {
    seeds.add(`${productName} alternative`);
    seeds.add(`${productName} pricing`);
    seeds.add(`best ${productName}`);
  }

  return Array.from(seeds).filter((s) => s.length >= 3 && s.length <= 100);
}

/**
 * Expand seeds using DataForSEO related keywords API
 */
export async function expandKeywords(seeds: string[], maxPerSeed = 50): Promise<string[]> {
  const client = getDataForSEOClient();
  if (!client.configured) {
    console.warn('[Keywords] DataForSEO not configured, skipping expansion');
    return seeds;
  }

  const expanded = new Set<string>(seeds);

  for (const seed of seeds.slice(0, 5)) {
    // Limit to 5 seeds to control cost
    try {
      const related = await withBudgetCheck('dataforseo', 0.0005, () =>
        cacheGet(CacheKeys.relatedKeywords(seed), () =>
          client.getRelatedKeywords(seed, 2840, 'en', maxPerSeed)
        )
      );

      for (const kw of related) {
        if (kw.keyword) expanded.add(kw.keyword.toLowerCase());
      }
    } catch (error) {
      console.warn(`[Keywords] Failed to expand seed "${seed}":`, error);
    }
  }

  return Array.from(expanded);
}

/**
 * Clean and filter keywords
 */
export function cleanKeywords(rawKeywords: string[]): string[] {
  return rawKeywords
    .map((k) => k.toLowerCase().trim())
    .filter((k) => {
      if (k.length < 3 || k.length > 100) return false;
      if (STOP_WORDS.has(k)) return false;
      // Check for any stop word as substring
      for (const sw of STOP_WORDS) {
        if (k.includes(sw)) return false;
      }
      return true;
    })
    .filter((k, i, arr) => arr.indexOf(k) === i); // deduplicate
}

/**
 * Fetch SEO metrics for keywords via DataForSEO (with cache + budget)
 */
export async function enrichKeywords(kwList: string[]): Promise<KeywordData[]> {
  const client = getDataForSEOClient();
  if (!client.configured) {
    console.warn('[Keywords] DataForSEO not configured, returning empty data');
    return kwList.map((kw) => ({
      keyword: kw,
      searchVolume: null,
      difficulty: null,
      cpc: null,
      competition: null,
      monthlySearches: null,
      intent: null,
    }));
  }

  // Split into cached vs uncached
  const results: KeywordData[] = [];
  const uncached: string[] = [];

  for (const kw of kwList) {
    const cached = await cacheGet<KeywordData | null>(
      CacheKeys.keywordData(kw),
      async () => null // will return null if not in cache
    );
    if (cached && cached.searchVolume !== null) {
      results.push(cached);
    } else {
      uncached.push(kw);
    }
  }

  // Batch fetch uncached keywords (max 1000 per batch)
  for (let i = 0; i < uncached.length; i += 1000) {
    const batch = uncached.slice(i, i + 1000);
    const estimatedCost = batch.length * 0.0003;

    try {
      const data = await withBudgetCheck('dataforseo', estimatedCost, () =>
        client.getKeywordData(batch)
      );

      for (const item of data) {
        results.push(item);
        // Cache individual results
        await cacheGet(CacheKeys.keywordData(item.keyword), async () => item);
      }
    } catch (error) {
      console.warn(`[Keywords] Failed to enrich batch starting at ${i}:`, error);
      // Add empty results for failed batch
      for (const kw of batch) {
        results.push({
          keyword: kw,
          searchVolume: null,
          difficulty: null,
          cpc: null,
          competition: null,
          monthlySearches: null,
          intent: null,
        });
      }
    }
  }

  return results;
}

/**
 * Save enriched keywords to database
 */
export async function saveKeywords(data: KeywordData[]): Promise<number> {
  let saved = 0;

  for (const item of data) {
    try {
      // Upsert: check if exists, update or insert
      const existing = await db.query.keywords.findFirst({
        where: eq(keywords.keyword, item.keyword),
      });

      if (existing) {
        await db
          .update(keywords)
          .set({
            searchVolume: item.searchVolume ?? existing.searchVolume,
            difficulty: item.difficulty ?? existing.difficulty,
            cpc: item.cpc ?? existing.cpc,
            competition: item.competition ?? existing.competition,
            trend: item.monthlySearches ? JSON.stringify(item.monthlySearches) : existing.trend,
            intent: item.intent ?? existing.intent,
            dataSource: 'dataforseo',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(keywords.id, existing.id));
      } else {
        await db.insert(keywords).values({
          keyword: item.keyword,
          searchVolume: item.searchVolume,
          difficulty: item.difficulty,
          cpc: item.cpc,
          competition: item.competition,
          trend: item.monthlySearches ? JSON.stringify(item.monthlySearches) : null,
          intent: item.intent,
          dataSource: 'dataforseo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      saved++;
    } catch (error) {
      // Likely duplicate, skip
    }
  }

  return saved;
}

/**
 * Link keywords to an idea
 */
export async function linkKeywordsToIdea(
  ideaId: string,
  kwIds: Array<{ keywordId: number; relevance: number; isPrimary: boolean }>
): Promise<void> {
  for (const { keywordId, relevance, isPrimary } of kwIds) {
    try {
      await db.insert(ideaKeywords).values({
        ideaId,
        keywordId,
        relevanceScore: relevance,
        isPrimary,
        createdAt: new Date().toISOString(),
      });
    } catch {
      // Likely duplicate link, skip
    }
  }
}

/**
 * Full keyword pipeline for an idea:
 * Extract seeds -> Expand -> Clean -> Enrich with SEO data -> Save -> Link
 */
export async function processIdeaKeywords(
  idea: Idea
): Promise<{ total: number; withVolume: number; primaryKeyword: string | null }> {
  console.log(`[Keywords] Processing keywords for idea: ${idea.title}`);

  // Step 1: Extract seed keywords
  const seeds = extractSeedKeywords(idea);
  console.log(`[Keywords] Extracted ${seeds.length} seed keywords`);

  // Step 2: Expand (if DataForSEO is configured)
  const expanded = await expandKeywords(seeds);
  console.log(`[Keywords] Expanded to ${expanded.length} keywords`);

  // Step 3: Clean and filter
  const cleaned = cleanKeywords(expanded);
  console.log(`[Keywords] Cleaned to ${cleaned.length} keywords`);

  // Step 4: Enrich with SEO data
  const enriched = await enrichKeywords(cleaned);

  // Step 5: Save to DB
  const saved = await saveKeywords(enriched);
  console.log(`[Keywords] Saved ${saved} keywords to database`);

  // Step 6: Find the best primary keyword (highest volume with manageable difficulty)
  const withVolume = enriched.filter((k) => k.searchVolume && k.searchVolume > 0);
  withVolume.sort((a, b) => {
    // Score: higher volume and lower difficulty is better
    const scoreA = (a.searchVolume || 0) * (1 - (a.difficulty || 50) / 100);
    const scoreB = (b.searchVolume || 0) * (1 - (b.difficulty || 50) / 100);
    return scoreB - scoreA;
  });

  const primaryKw = withVolume[0] || null;

  // Step 7: Link keywords to idea
  const allKeywordRows = await db.query.keywords.findMany({
    where: inArray(
      keywords.keyword,
      cleaned.slice(0, 100) // Link top 100 keywords
    ),
  });

  const links = allKeywordRows.map((kw, idx) => ({
    keywordId: kw.id,
    relevance: Math.max(0.1, 1 - idx * 0.01),
    isPrimary: kw.keyword === primaryKw?.keyword,
  }));

  await linkKeywordsToIdea(idea.id, links);

  // Step 8: Update idea with primary keyword data
  if (primaryKw) {
    await db
      .update(ideas)
      .set({
        primaryKeyword: primaryKw.keyword,
        targetSearchVolume: primaryKw.searchVolume,
        targetKeywordDifficulty: primaryKw.difficulty,
        targetCpc: primaryKw.cpc,
        status: 'seo_validated',
        seoValidatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(ideas.id, idea.id));
  }

  return {
    total: cleaned.length,
    withVolume: withVolume.length,
    primaryKeyword: primaryKw?.keyword || null,
  };
}
