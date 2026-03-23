import { db } from '../db';
import {
  competitors,
  serpSnapshots,
  monetizationSignals,
  ideas,
} from '../db/schema';
import { eq, desc, inArray, sql } from 'drizzle-orm';
import { getDataForSEOClient } from '../api/dataforseo';
import { getSerpAPIClientWithDB } from '../api/serpapi';
import { cacheGet, CacheKeys } from '../cache';
import { withBudgetCheck } from '../budget/manager';
import type { Idea, Competitor } from '../db/schema';

/**
 * Discover competitors for an idea by analyzing SERP results for its keywords
 */
export async function discoverCompetitors(idea: Idea): Promise<Competitor[]> {
  // Get keywords linked to this idea
  const linkedKws = await db.query.ideaKeywords.findMany({
    where: (ik, { eq: e }) => e(ik.ideaId, idea.id),
  });

  if (linkedKws.length === 0 && !idea.primaryKeyword) {
    console.warn(`[Competitors] No keywords found for idea ${idea.id}`);
    return [];
  }

  // Get the top keywords to check SERP
  const kwIds = linkedKws
    .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
    .slice(0, 5)
    .map((lk) => lk.keywordId);

  const topKeywords = kwIds.length > 0
    ? await db.query.keywords.findMany({ where: inArray(db._.fullSchema.keywords.id, kwIds) })
    : [];

  const searchTerms = topKeywords.map((k) => k.keyword);
  if (idea.primaryKeyword && !searchTerms.includes(idea.primaryKeyword)) {
    searchTerms.unshift(idea.primaryKeyword);
  }

  // Collect unique competitor domains from SERP
  const domainMap = new Map<string, { count: number; urls: string[] }>();

  for (const term of searchTerms.slice(0, 3)) {
    // Limit to 3 SERP queries for cost control
    try {
      const serpResults = await fetchSerpForKeyword(term);

      for (const result of serpResults) {
        const domain = result.domain;
        if (!domain) continue;
        // Skip common non-competitor domains
        if (isGenericDomain(domain)) continue;

        const existing = domainMap.get(domain) || { count: 0, urls: [] };
        existing.count++;
        existing.urls.push(result.url);
        domainMap.set(domain, existing);
      }
    } catch (error) {
      console.warn(`[Competitors] SERP fetch failed for "${term}":`, error);
    }
  }

  // Save competitors to DB
  const savedCompetitors: Competitor[] = [];

  for (const [domain, info] of domainMap) {
    try {
      const existing = await db.query.competitors.findFirst({
        where: eq(competitors.domain, domain),
      });

      if (existing) {
        savedCompetitors.push(existing);
      } else {
        await db.insert(competitors).values({
          domain,
          name: domain.replace(/^www\./, '').split('.')[0],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        const inserted = await db.query.competitors.findFirst({
          where: eq(competitors.domain, domain),
        });
        if (inserted) savedCompetitors.push(inserted);
      }
    } catch {
      // Skip duplicates
    }
  }

  // Update idea with competitor count
  await db
    .update(ideas)
    .set({
      competitorCount: savedCompetitors.length,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(ideas.id, idea.id));

  console.log(
    `[Competitors] Found ${savedCompetitors.length} competitors for idea: ${idea.title}`
  );

  return savedCompetitors;
}

/**
 * Fetch SERP results for a keyword (with cache)
 */
async function fetchSerpForKeyword(keyword: string) {
  // Try DataForSEO first, then SerpAPI
  const dataForSEO = getDataForSEOClient();
  if (dataForSEO.configured) {
    return cacheGet(CacheKeys.serpResults(keyword), async () => {
      const results = await withBudgetCheck('dataforseo', 0.005, () =>
        dataForSEO.getSerpResults(keyword)
      );

      // Save SERP snapshot
      for (const r of results) {
        try {
          await db.insert(serpSnapshots).values({
            keyword: r.keyword,
            position: r.position,
            url: r.url,
            domain: r.domain,
            title: r.title,
            description: r.description,
            serpFeatures: JSON.stringify(r.serpFeatures),
            snapshotDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          });
        } catch {
          // Ignore duplicate inserts
        }
      }

      return results;
    });
  }

  // Fallback to SerpAPI
  const serpAPI = await getSerpAPIClientWithDB();
  if (serpAPI.configured) {
    return cacheGet(CacheKeys.serpResults(keyword), async () => {
      const result = await withBudgetCheck('serpapi', 0.01, () => serpAPI.search(keyword));

      const mapped = result.organicResults.map((r) => ({
        keyword,
        position: r.position,
        url: r.link,
        domain: r.domain,
        title: r.title,
        description: r.snippet,
        serpFeatures: result.serpFeatures,
      }));

      // Save SERP snapshot
      for (const r of mapped) {
        try {
          await db.insert(serpSnapshots).values({
            keyword: r.keyword,
            position: r.position,
            url: r.url,
            domain: r.domain,
            title: r.title,
            description: r.description,
            serpFeatures: JSON.stringify(r.serpFeatures),
            snapshotDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          });
        } catch {
          // Ignore
        }
      }

      return mapped;
    });
  }

  console.warn('[Competitors] No SERP API configured');
  return [];
}

/**
 * Detect monetization signals from a competitor domain
 * Uses AI analysis of SERP snippets and known patterns
 */
export async function detectMonetizationSignals(
  domain: string
): Promise<void> {
  // Check if we already have recent signals
  const existing = await db.query.monetizationSignals.findFirst({
    where: eq(monetizationSignals.domain, domain),
  });

  if (existing) return; // Already analyzed

  // Infer from SERP data and competitor info
  const competitor = await db.query.competitors.findFirst({
    where: eq(competitors.domain, domain),
  });

  // Look for pricing signals in SERP snippets
  const serpData = await db.query.serpSnapshots.findMany({
    where: eq(serpSnapshots.domain, domain),
    limit: 20,
  });

  const allText = serpData.map((s) => `${s.title} ${s.description}`).join(' ').toLowerCase();

  const signals = {
    hasPricing:
      allText.includes('pricing') ||
      allText.includes('plans') ||
      allText.includes('/mo') ||
      allText.includes('per month'),
    hasAds: allText.includes('sponsored') || allText.includes('advertisement'),
    pricingModel: detectPricingModel(allText),
    priceRange: detectPriceRange(allText),
    hasAffiliate:
      allText.includes('affiliate') ||
      allText.includes('partner program') ||
      allText.includes('referral'),
  };

  await db.insert(monetizationSignals).values({
    domain,
    hasPricing: signals.hasPricing,
    hasAds: signals.hasAds,
    pricingModel: signals.pricingModel,
    priceRange: signals.priceRange,
    hasAffiliate: signals.hasAffiliate,
    detectedAt: new Date().toISOString(),
  });
}

function detectPricingModel(text: string): string | null {
  if (text.includes('subscription') || text.includes('/mo') || text.includes('per month')) {
    return 'subscription';
  }
  if (text.includes('one-time') || text.includes('lifetime')) {
    return 'one-time';
  }
  if (text.includes('freemium') || text.includes('free plan') || text.includes('free tier')) {
    return 'freemium';
  }
  if (text.includes('open source') || text.includes('open-source')) {
    return 'open-source';
  }
  return null;
}

function detectPriceRange(text: string): string | null {
  const priceMatch = text.match(/\$(\d+(?:\.\d{2})?)/g);
  if (priceMatch && priceMatch.length >= 1) {
    const prices = priceMatch.map((p) => parseFloat(p.replace('$', ''))).sort((a, b) => a - b);
    if (prices.length === 1) return `$${prices[0]}`;
    return `$${prices[0]} - $${prices[prices.length - 1]}`;
  }
  return null;
}

function isGenericDomain(domain: string): boolean {
  const generic = [
    'google.com', 'youtube.com', 'wikipedia.org', 'reddit.com',
    'facebook.com', 'twitter.com', 'x.com', 'linkedin.com',
    'amazon.com', 'ebay.com', 'medium.com', 'quora.com',
    'github.com', 'stackoverflow.com', 'w3schools.com',
    'forbes.com', 'techcrunch.com', 'producthunt.com',
  ];
  return generic.some((g) => domain === g || domain.endsWith(`.${g}`));
}

/**
 * Get competitor overview for an idea
 */
export async function getCompetitorOverview(ideaId: string) {
  const idea = await db.query.ideas.findFirst({ where: eq(ideas.id, ideaId) });
  if (!idea) return null;

  // Get competitors from SERP data linked to idea's keywords
  const linkedKws = await db.query.ideaKeywords.findMany({
    where: (ik, { eq: e }) => e(ik.ideaId, ideaId),
  });

  const kwIds = linkedKws.map((lk) => lk.keywordId);
  if (kwIds.length === 0) return { competitors: [], signals: [] };

  const kws = await db.query.keywords.findMany({
    where: inArray(db._.fullSchema.keywords.id, kwIds),
  });

  const kwTexts = kws.map((k) => k.keyword);

  // Get domains that appear in SERP for these keywords
  const serps = kwTexts.length > 0
    ? await db.query.serpSnapshots.findMany({
        where: inArray(serpSnapshots.keyword, kwTexts),
      })
    : [];

  const domainSet = new Set(serps.map((s) => s.domain).filter((d) => !isGenericDomain(d)));

  const competitorList = domainSet.size > 0
    ? await db.query.competitors.findMany({
        where: inArray(competitors.domain, Array.from(domainSet)),
      })
    : [];

  const signalList = domainSet.size > 0
    ? await db.query.monetizationSignals.findMany({
        where: inArray(monetizationSignals.domain, Array.from(domainSet)),
      })
    : [];

  return { competitors: competitorList, signals: signalList };
}
