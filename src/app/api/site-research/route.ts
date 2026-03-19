import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { siteResearches } from '@/lib/db/schema';
import { crawlSite, extractDomain } from '@/lib/research/crawler';
import { analyzeSite } from '@/lib/research/analyzer';
import { desc, eq } from 'drizzle-orm';

/**
 * GET /api/site-research - List all site researches
 */
export async function GET() {
  try {
    const results = await db
      .select({
        id: siteResearches.id,
        url: siteResearches.url,
        domain: siteResearches.domain,
        title: siteResearches.title,
        status: siteResearches.status,
        createdAt: siteResearches.createdAt,
      })
      .from(siteResearches)
      .orderBy(desc(siteResearches.createdAt))
      .limit(50);

    return NextResponse.json({ researches: results });
  } catch (error) {
    console.error('[SiteResearch] GET error:', error);
    return NextResponse.json({ error: '获取调研列表失败' }, { status: 500 });
  }
}

/**
 * POST /api/site-research - Start a new site research
 * Body: { url: string, ideaId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, ideaId } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: '请提供有效的网址' }, { status: 400 });
    }

    // Normalize URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      return NextResponse.json({ error: '网址格式无效' }, { status: 400 });
    }

    const domain = extractDomain(normalizedUrl);

    // Create record
    const [record] = await db
      .insert(siteResearches)
      .values({
        url: normalizedUrl,
        domain,
        status: 'crawling',
        ideaId: ideaId || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    // Run crawl + analysis (synchronous for now, can be made async later)
    try {
      // Step 1: Crawl
      const crawlResult = await crawlSite(normalizedUrl);

      await db
        .update(siteResearches)
        .set({
          title: crawlResult.title,
          pageContent: crawlResult.pages.map((p) => `[${p.path}] ${p.markdown}`).join('\n\n'),
          status: 'analyzing',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(siteResearches.id, record.id));

      // Step 2: AI Analysis
      const analysis = await analyzeSite(crawlResult);

      await db
        .update(siteResearches)
        .set({
          title: analysis.overview?.name || crawlResult.title,
          aiAnalysis: JSON.stringify(analysis),
          status: 'completed',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(siteResearches.id, record.id));

      return NextResponse.json({
        id: record.id,
        status: 'completed',
        analysis,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '分析失败';
      await db
        .update(siteResearches)
        .set({
          status: 'failed',
          errorMessage: message,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(siteResearches.id, record.id));

      return NextResponse.json(
        { id: record.id, error: message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[SiteResearch] POST error:', error);
    return NextResponse.json({ error: '请求处理失败' }, { status: 500 });
  }
}
