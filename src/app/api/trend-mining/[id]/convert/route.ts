import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ideas, trendDiscoveries } from '@/lib/db/schema';
import { generateId } from '@/lib/utils';
import { eq } from 'drizzle-orm';

/**
 * POST /api/trend-mining/[id]/convert -- Convert a trend discovery into an idea
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const trend = await db.query.trendDiscoveries.findFirst({
      where: eq(trendDiscoveries.id, id),
    });

    if (!trend) {
      return NextResponse.json({ error: 'Trend not found' }, { status: 404 });
    }

    if (trend.validationStatus === 'converted' && trend.ideaId) {
      return NextResponse.json({ error: 'Already converted', ideaId: trend.ideaId }, { status: 400 });
    }

    // Create idea from trend data
    const ideaId = generateId();
    const trendsUrl = `https://trends.google.com/trends/explore?q=${encodeURIComponent(trend.keyword)}&date=now%207-d`;

    const description = [
      `Trending keyword discovered via Google Trends (seed: ${trend.seedWord || 'N/A'}).`,
      trend.growthRate ? `Growth: ${trend.growthRate}.` : '',
      trend.searchVolume ? `Monthly search volume: ${trend.searchVolume.toLocaleString()}.` : '',
      trend.difficulty != null ? `Keyword difficulty: ${trend.difficulty.toFixed(1)}.` : '',
      trend.cpc != null ? `CPC: $${trend.cpc.toFixed(2)}.` : '',
    ].filter(Boolean).join(' ');

    await db.insert(ideas).values({
      id: ideaId,
      title: trend.keyword,
      description,
      url: trendsUrl,
      source: 'google_trends',
      sourceId: `td_${trend.id}`,
      sourceScore: trend.growthNumeric || 0,
      sourceComments: 0,
      status: 'discovered',
      primaryKeyword: trend.keyword,
      targetSearchVolume: trend.searchVolume,
      targetKeywordDifficulty: trend.difficulty,
      targetCpc: trend.cpc,
      discoveredAt: trend.createdAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Update trend status
    await db.update(trendDiscoveries)
      .set({
        validationStatus: 'converted',
        ideaId: ideaId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(trendDiscoveries.id, id));

    return NextResponse.json({
      success: true,
      ideaId,
      message: `Converted "${trend.keyword}" to idea`,
    });
  } catch (error) {
    console.error('[TrendMining] Convert error:', error);
    return NextResponse.json(
      { error: 'Failed to convert trend', details: String(error) },
      { status: 500 }
    );
  }
}
