import { NextResponse } from 'next/server';
import { getDataForSEOClient, type KeywordData } from '@/lib/api/dataforseo';
import { db } from '@/lib/db';
import { trendDiscoveries } from '@/lib/db/schema';
import { generateId } from '@/lib/utils';
import { eq } from 'drizzle-orm';

// --- Default seed lists ---

const DEFAULT_ALTERNATIVES_SEEDS = [
  'notion', 'slack', 'trello', 'airtable', 'zapier',
  'mailchimp', 'hubspot', 'asana', 'clickup', 'monday',
  'jira', 'salesforce', 'zendesk', 'intercom', 'figma',
];

const DEFAULT_HOWTO_SEEDS = [
  'automate', 'generate', 'convert', 'extract', 'scrape',
  'schedule', 'transcribe', 'translate', 'summarize', 'analyze',
  'track', 'monitor', 'manage', 'organize', 'visualize',
];

const DEFAULT_BESTTOOLS_SEEDS = [
  'email marketing', 'project management', 'crm', 'invoicing',
  'video editing', 'social media', 'seo', 'analytics',
  'design', 'customer support', 'accounting', 'hr',
  'inventory management', 'content writing', 'file sharing',
];

// --- Keyword generation by mode ---

function generateAlternativeKeywords(seeds: string[]): string[] {
  const keywords: string[] = [];
  for (const seed of seeds) {
    keywords.push(`${seed} alternative`);
    keywords.push(`${seed} alternative free`);
    keywords.push(`better than ${seed}`);
  }
  return keywords;
}

function generateHowToKeywords(seeds: string[]): string[] {
  const keywords: string[] = [];
  const objects = ['emails', 'reports', 'invoices', 'images', 'data', 'documents', 'videos', 'tasks'];
  for (const verb of seeds) {
    keywords.push(`how to ${verb}`);
    // Add a few verb+object combos
    for (const obj of objects.slice(0, 3)) {
      keywords.push(`how to ${verb} ${obj}`);
    }
  }
  return keywords;
}

function generateBestToolKeywords(seeds: string[]): string[] {
  const keywords: string[] = [];
  for (const category of seeds) {
    keywords.push(`best ${category} tool`);
    keywords.push(`best ${category} software`);
    keywords.push(`${category} tools for small business`);
  }
  return keywords;
}

// --- Opportunity scoring ---

interface ScoredKeyword extends KeywordData {
  opportunityScore: number;
  seed: string;
  mode: string;
}

function scoreOpportunity(kw: KeywordData): number {
  const volume = kw.searchVolume ?? 0;
  const difficulty = kw.difficulty ?? 50;
  const cpc = kw.cpc ?? 0.5;

  if (volume === 0) return 0;

  // opportunity = volume * ease * commercial_value
  const ease = 1 - difficulty / 100;
  const commercialValue = Math.max(cpc, 0.1);
  const raw = volume * ease * commercialValue;

  // Normalize to 0-100 scale (1000 raw = 100 score)
  return Math.min(Math.round((raw / 1000) * 100) / 100, 100);
}

// --- API handler ---

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mode: string = body.mode || 'alternatives';
    const customSeeds: string[] | undefined = body.seeds;

    // Generate keywords based on mode
    let seeds: string[];
    let keywords: string[];

    switch (mode) {
      case 'alternatives':
        seeds = customSeeds || DEFAULT_ALTERNATIVES_SEEDS;
        keywords = generateAlternativeKeywords(seeds);
        break;
      case 'how-to':
        seeds = customSeeds || DEFAULT_HOWTO_SEEDS;
        keywords = generateHowToKeywords(seeds);
        break;
      case 'best-tools':
        seeds = customSeeds || DEFAULT_BESTTOOLS_SEEDS;
        keywords = generateBestToolKeywords(seeds);
        break;
      default:
        return NextResponse.json({ error: 'Invalid mode. Use: alternatives, how-to, best-tools' }, { status: 400 });
    }

    // Fetch SEO data from DataForSEO
    const client = getDataForSEOClient();
    const keywordData = await client.getKeywordData(keywords);

    // Score and sort
    const scored: ScoredKeyword[] = keywordData
      .map((kw) => {
        // Find which seed this keyword came from
        const seed = seeds.find((s) =>
          kw.keyword.toLowerCase().includes(s.toLowerCase())
        ) || seeds[0];

        return {
          ...kw,
          opportunityScore: scoreOpportunity(kw),
          seed,
          mode,
        };
      })
      .filter((kw) => kw.opportunityScore > 0 || (kw.searchVolume ?? 0) > 0)
      .sort((a, b) => b.opportunityScore - a.opportunityScore);

    // Save top results to trend_discoveries table
    let saved = 0;
    for (const kw of scored.slice(0, 50)) {
      try {
        // Check if already exists
        const existing = await db.query.trendDiscoveries.findFirst({
          where: eq(trendDiscoveries.keyword, kw.keyword),
        });

        if (existing) {
          // Update with fresh data
          await db.update(trendDiscoveries).set({
            searchVolume: kw.searchVolume,
            difficulty: kw.difficulty,
            cpc: kw.cpc,
            growthRate: `Score: ${kw.opportunityScore}`,
            growthNumeric: Math.round(kw.opportunityScore * 100),
            updatedAt: new Date().toISOString(),
          }).where(eq(trendDiscoveries.id, existing.id));
        } else {
          await db.insert(trendDiscoveries).values({
            id: generateId(),
            keyword: kw.keyword,
            seedWord: kw.seed,
            source: 'keyword_discovery',
            growthRate: `Score: ${kw.opportunityScore}`,
            growthNumeric: Math.round(kw.opportunityScore * 100),
            searchVolume: kw.searchVolume,
            difficulty: kw.difficulty,
            cpc: kw.cpc,
            serpCompetition: kw.competition,
            validationStatus: 'pending',
            metadata: JSON.stringify({ mode, intent: kw.intent }),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          saved++;
        }
      } catch (error) {
        console.error(`Failed to save keyword ${kw.keyword}:`, error);
      }
    }

    return NextResponse.json({
      mode,
      seeds,
      totalKeywords: keywords.length,
      withData: keywordData.length,
      results: scored.slice(0, 50),
      saved,
    });
  } catch (error) {
    console.error('Keyword discovery error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Keyword discovery failed' },
      { status: 500 }
    );
  }
}

// GET: return existing keyword discoveries
export async function GET() {
  try {
    const discoveries = await db.query.trendDiscoveries.findMany({
      where: eq(trendDiscoveries.source, 'keyword_discovery'),
      orderBy: (td, { desc }) => [desc(td.growthNumeric)],
      limit: 100,
    });

    return NextResponse.json({ discoveries });
  } catch (error) {
    console.error('Failed to fetch keyword discoveries:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
