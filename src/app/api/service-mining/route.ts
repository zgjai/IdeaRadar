import { NextResponse } from 'next/server';
import { getDataForSEOClient, type KeywordData } from '@/lib/api/dataforseo';
import { db } from '@/lib/db';
import { trendDiscoveries } from '@/lib/db/schema';
import { generateId } from '@/lib/utils';
import { eq } from 'drizzle-orm';

// --- Default service categories (based on Fiverr/Upwork top categories) ---

const DEFAULT_CATEGORIES = [
  'logo design',
  'video editing',
  'social media management',
  'seo services',
  'web scraping',
  'data entry',
  'transcription',
  'translation',
  'bookkeeping',
  'resume writing',
  'email copywriting',
  'chatbot development',
  'wordpress development',
  'mobile app design',
  'photo editing',
  'voice over',
  'podcast editing',
  'content writing',
  'lead generation',
  'virtual assistant',
];

// --- Keyword generation for service mining ---

interface ServiceKeywords {
  category: string;
  fiverrKey: string;      // "fiverr [category]"
  toolKey: string;        // "[category] tool"
  softwareKey: string;    // "[category] software"
  automationKey: string;  // "[category] automation"
}

function generateServiceKeywords(categories: string[]): {
  allKeywords: string[];
  mapping: ServiceKeywords[];
} {
  const allKeywords: string[] = [];
  const mapping: ServiceKeywords[] = [];

  for (const category of categories) {
    const sk: ServiceKeywords = {
      category,
      fiverrKey: `fiverr ${category}`,
      toolKey: `${category} tool`,
      softwareKey: `${category} software`,
      automationKey: `${category} automation`,
    };

    allKeywords.push(sk.fiverrKey, sk.toolKey, sk.softwareKey, sk.automationKey);
    mapping.push(sk);
  }

  return { allKeywords, mapping };
}

// --- SOAP score calculation ---

interface ServiceResult {
  category: string;
  fiverrVolume: number;
  toolVolume: number;
  softwareVolume: number;
  automationVolume: number;
  soapScore: number;
  productizationGap: number;
  avgCpc: number;
  avgDifficulty: number;
}

function calculateServiceResults(
  mapping: ServiceKeywords[],
  kwDataMap: Map<string, KeywordData>
): ServiceResult[] {
  const results: ServiceResult[] = [];

  for (const sk of mapping) {
    const fiverrData = kwDataMap.get(sk.fiverrKey);
    const toolData = kwDataMap.get(sk.toolKey);
    const softwareData = kwDataMap.get(sk.softwareKey);
    const automationData = kwDataMap.get(sk.automationKey);

    const fiverrVol = fiverrData?.searchVolume ?? 0;
    const toolVol = toolData?.searchVolume ?? 0;
    const softwareVol = softwareData?.searchVolume ?? 0;
    const automationVol = automationData?.searchVolume ?? 0;

    // SOAP Score: weighted combination of demand signals
    // Service demand (fiverr volume) + automation intent + existing tool searches
    const soapScore = (fiverrVol * 0.4) + (automationVol * 0.4) + (toolVol * 0.2);

    // Productization gap: high service demand but low tool supply
    const productizationGap = fiverrVol - Math.max(toolVol, softwareVol);

    // Average CPC across all keyword variants
    const cpcs = [fiverrData?.cpc, toolData?.cpc, softwareData?.cpc, automationData?.cpc]
      .filter((c): c is number => c !== null && c !== undefined);
    const avgCpc = cpcs.length > 0 ? cpcs.reduce((a, b) => a + b, 0) / cpcs.length : 0;

    // Average difficulty
    const diffs = [fiverrData?.difficulty, toolData?.difficulty, softwareData?.difficulty, automationData?.difficulty]
      .filter((d): d is number => d !== null && d !== undefined);
    const avgDifficulty = diffs.length > 0 ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 50;

    results.push({
      category: sk.category,
      fiverrVolume: fiverrVol,
      toolVolume: Math.max(toolVol, softwareVol),
      softwareVolume: softwareVol,
      automationVolume: automationVol,
      soapScore,
      productizationGap,
      avgCpc,
      avgDifficulty,
    });
  }

  // Sort by SOAP score descending
  return results.sort((a, b) => b.soapScore - a.soapScore);
}

// --- API handler ---

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const categories: string[] = body.categories || DEFAULT_CATEGORIES;

    // Generate all keyword variants
    const { allKeywords, mapping } = generateServiceKeywords(categories);

    // Fetch SEO data for all keywords in one batch
    const client = getDataForSEOClient();
    const keywordData = await client.getKeywordData(allKeywords);

    // Build lookup map
    const kwDataMap = new Map<string, KeywordData>();
    for (const kw of keywordData) {
      kwDataMap.set(kw.keyword, kw);
    }

    // Calculate SOAP scores
    const results = calculateServiceResults(mapping, kwDataMap);

    // Save results to trend_discoveries table
    let saved = 0;
    for (const result of results) {
      try {
        const existing = await db.query.trendDiscoveries.findFirst({
          where: eq(trendDiscoveries.keyword, result.category),
        });

        const metadata = JSON.stringify({
          mode: 'service_mining',
          fiverrVolume: result.fiverrVolume,
          toolVolume: result.toolVolume,
          softwareVolume: result.softwareVolume,
          automationVolume: result.automationVolume,
          soapScore: result.soapScore,
          productizationGap: result.productizationGap,
          avgCpc: result.avgCpc,
          avgDifficulty: result.avgDifficulty,
        });

        if (existing) {
          await db.update(trendDiscoveries).set({
            searchVolume: result.fiverrVolume,
            difficulty: result.avgDifficulty,
            cpc: result.avgCpc,
            growthRate: `SOAP: ${Math.round(result.soapScore)}`,
            growthNumeric: Math.round(result.soapScore),
            metadata,
            updatedAt: new Date().toISOString(),
          }).where(eq(trendDiscoveries.id, existing.id));
        } else {
          await db.insert(trendDiscoveries).values({
            id: generateId(),
            keyword: result.category,
            seedWord: 'service_mining',
            source: 'service_mining',
            growthRate: `SOAP: ${Math.round(result.soapScore)}`,
            growthNumeric: Math.round(result.soapScore),
            searchVolume: result.fiverrVolume,
            difficulty: result.avgDifficulty,
            cpc: result.avgCpc,
            serpCompetition: null,
            validationStatus: 'pending',
            metadata,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          saved++;
        }
      } catch (error) {
        console.error(`Failed to save service ${result.category}:`, error);
      }
    }

    return NextResponse.json({
      categories: categories.length,
      keywordsChecked: allKeywords.length,
      results,
      saved,
    });
  } catch (error) {
    console.error('Service mining error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Service mining failed' },
      { status: 500 }
    );
  }
}

// GET: return existing service mining results
export async function GET() {
  try {
    const discoveries = await db.query.trendDiscoveries.findMany({
      where: eq(trendDiscoveries.source, 'service_mining'),
      orderBy: (td, { desc }) => [desc(td.growthNumeric)],
      limit: 100,
    });

    return NextResponse.json({ discoveries });
  } catch (error) {
    console.error('Failed to fetch service mining results:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
