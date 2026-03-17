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
 * Save enriched keywords to database (batch upsert)
 */
export async function saveKeywords(data: KeywordData[]): Promise<number> {
  if (data.length === 0) return 0;

  const now = new Date().toISOString();

  // Fetch all existing keywords in one query
  const existingKeywords = data.map((d) => d.keyword);
  const existingRows = await db.query.keywords.findMany({
    where: inArray(keywords.keyword, existingKeywords),
  });
  const existingMap = new Map(existingRows.map((r) => [r.keyword, r]));

  // Split into updates and inserts
  const toInsert: Array<typeof keywords.$inferInsert> = [];
  const toUpdate: Array<{ id: number; values: Partial<typeof keywords.$inferInsert> }> = [];

  for (const item of data) {
    const existing = existingMap.get(item.keyword);
    if (existing) {
      toUpdate.push({
        id: existing.id,
        values: {
          searchVolume: item.searchVolume ?? existing.searchVolume,
          difficulty: item.difficulty ?? existing.difficulty,
          cpc: item.cpc ?? existing.cpc,
          competition: item.competition ?? existing.competition,
          trend: item.monthlySearches ? JSON.stringify(item.monthlySearches) : existing.trend,
          intent: item.intent ?? existing.intent,
          dataSource: 'dataforseo',
          updatedAt: now,
        },
      });
    } else {
      toInsert.push({
        keyword: item.keyword,
        searchVolume: item.searchVolume,
        difficulty: item.difficulty,
        cpc: item.cpc,
        competition: item.competition,
        trend: item.monthlySearches ? JSON.stringify(item.monthlySearches) : null,
        intent: item.intent,
        dataSource: 'dataforseo',
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  let saved = 0;

  // Batch insert new keywords (chunks of 100 to avoid SQLite limits)
  for (let i = 0; i < toInsert.length; i += 100) {
    const batch = toInsert.slice(i, i + 100);
    try {
      await db.insert(keywords).values(batch);
      saved += batch.length;
    } catch {
      // Fall back to individual inserts for this batch on conflict
      for (const item of batch) {
        try {
          await db.insert(keywords).values(item);
          saved++;
        } catch {
          // duplicate, skip
        }
      }
    }
  }

  // Batch updates (must be individual due to different values per row)
  for (const { id, values } of toUpdate) {
    try {
      await db.update(keywords).set(values).where(eq(keywords.id, id));
      saved++;
    } catch {
      // skip on error
    }
  }

  return saved;
}

/**
 * Link keywords to an idea (batch insert)
 */
export async function linkKeywordsToIdea(
  ideaId: string,
  kwIds: Array<{ keywordId: number; relevance: number; isPrimary: boolean }>
): Promise<void> {
  if (kwIds.length === 0) return;

  const now = new Date().toISOString();
  const values = kwIds.map(({ keywordId, relevance, isPrimary }) => ({
    ideaId,
    keywordId,
    relevanceScore: relevance,
    isPrimary,
    createdAt: now,
  }));

  // Batch insert in chunks of 100
  for (let i = 0; i < values.length; i += 100) {
    const batch = values.slice(i, i + 100);
    try {
      await db.insert(ideaKeywords).values(batch);
    } catch {
      // Fall back to individual inserts on conflict
      for (const item of batch) {
        try {
          await db.insert(ideaKeywords).values(item);
        } catch {
          // duplicate link, skip
        }
      }
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
