import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { trendDiscoveries, keywords } from '@/lib/db/schema';
import { getSerpAPIClientWithDB } from '@/lib/api/serpapi';
import { getDataForSEOClient } from '@/lib/api/dataforseo';
import { generateId } from '@/lib/utils';
import { desc, eq, like, sql } from 'drizzle-orm';

export const maxDuration = 120;

/**
 * GET /api/trend-mining -- List discovered trends
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const status = searchParams.get('status');
    const seedWord = searchParams.get('seedWord');
    const sort = searchParams.get('sort') || 'growth_numeric';
    const order = searchParams.get('order') || 'desc';

    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [];
    if (status) conditions.push(eq(trendDiscoveries.validationStatus, status));
    if (seedWord) conditions.push(eq(trendDiscoveries.seedWord, seedWord));

    const whereClause = conditions.length > 0
      ? sql`${sql.join(conditions, sql` AND `)}`
      : undefined;

    const rows = await db.query.trendDiscoveries.findMany({
      where: whereClause ? () => whereClause : undefined,
      orderBy: (td) => {
        const col = sort === 'search_volume' ? td.searchVolume
          : sort === 'difficulty' ? td.difficulty
          : sort === 'cpc' ? td.cpc
          : td.growthNumeric;
        return order === 'asc' ? [sql`${col} ASC`] : [sql`${col} DESC NULLS LAST`];
      },
      limit,
      offset,
    });

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(trendDiscoveries)
      .where(whereClause);
    const total = countResult[0]?.count ?? 0;

    return NextResponse.json({
      trends: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[TrendMining] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trends', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trend-mining -- Start a trend mining session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const seedWords: string[] = body.seedWords || [];
    const geo: string = body.geo || '';

    if (seedWords.length === 0) {
      return NextResponse.json({ error: 'seedWords is required' }, { status: 400 });
    }

    if (seedWords.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 seed words allowed' }, { status: 400 });
    }

    const serpClient = await getSerpAPIClientWithDB();
    if (!serpClient.configured) {
      return NextResponse.json({ error: 'SerpAPI key not configured' }, { status: 400 });
    }

    console.log(`[TrendMining] Starting with seeds: ${seedWords.join(', ')}`);

    // Step 1: Fetch rising queries for each seed word
    const allQueries: Array<{
      query: string;
      value: number;
      formattedValue: string;
      isBreakout: boolean;
      seedWord: string;
    }> = [];

    for (const seed of seedWords) {
      try {
        const rising = await serpClient.getRisingQueries(seed, 'now 7-d', geo);
        for (const r of rising) {
          allQueries.push({ ...r, seedWord: seed });
        }
        console.log(`[TrendMining] Seed "${seed}": ${rising.length} rising queries`);
      } catch (error) {
        console.error(`[TrendMining] Failed for seed "${seed}":`, error);
      }
    }

    // Step 2: Deduplicate by query text
    const seen = new Set<string>();
    const unique = allQueries.filter(q => {
      const key = q.query.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[TrendMining] ${unique.length} unique rising queries after dedup`);

    // Step 3: Enrich top results with SEO data (limit to top 30 to control cost)
    const toEnrich = unique
      .sort((a, b) => b.value - a.value)
      .slice(0, 30);

    let enrichedData: Record<string, { volume: number; difficulty: number; cpc: number }> = {};

    const dfsClient = getDataForSEOClient();
    if (dfsClient.configured && toEnrich.length > 0) {
      try {
        const kwData = await dfsClient.getKeywordData(toEnrich.map(q => q.query));
        for (const kw of kwData) {
          enrichedData[kw.keyword.toLowerCase()] = {
            volume: kw.searchVolume || 0,
            difficulty: kw.difficulty || 0,
            cpc: kw.cpc || 0,
          };
        }
        console.log(`[TrendMining] Enriched ${Object.keys(enrichedData).length} keywords with SEO data`);
      } catch (error) {
        console.error('[TrendMining] DataForSEO enrichment failed:', error);
      }
    }

    // Step 4: Save to database
    const savedTrends = [];

    for (const q of toEnrich) {
      const seo = enrichedData[q.query.toLowerCase()] || {};
      const id = generateId();

      // Check if keyword already exists in trend_discoveries
      const existing = await db.query.trendDiscoveries.findFirst({
        where: (td, { eq }) => eq(td.keyword, q.query),
      });

      if (existing) {
        // Update with fresh data
        await db.update(trendDiscoveries)
          .set({
            growthRate: q.formattedValue,
            growthNumeric: q.value,
            searchVolume: seo.volume || existing.searchVolume,
            difficulty: seo.difficulty || existing.difficulty,
            cpc: seo.cpc || existing.cpc,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(trendDiscoveries.id, existing.id));

        savedTrends.push({ ...existing, ...seo, growthRate: q.formattedValue, growthNumeric: q.value });
      } else {
        const newTrend = {
          id,
          keyword: q.query,
          seedWord: q.seedWord,
          source: 'google_trends_rising',
          growthRate: q.formattedValue,
          growthNumeric: q.value,
          searchVolume: seo.volume || null,
          difficulty: seo.difficulty || null,
          cpc: seo.cpc || null,
          validationStatus: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await db.insert(trendDiscoveries).values(newTrend);
        savedTrends.push(newTrend);
      }
    }

    console.log(`[TrendMining] Saved ${savedTrends.length} trends to database`);

    return NextResponse.json({
      success: true,
      seedWords,
      totalRisingQueries: unique.length,
      enriched: Object.keys(enrichedData).length,
      saved: savedTrends.length,
      trends: savedTrends,
    });
  } catch (error) {
    console.error('[TrendMining] POST error:', error);
    return NextResponse.json(
      { error: 'Trend mining failed', details: String(error) },
      { status: 500 }
    );
  }
}
