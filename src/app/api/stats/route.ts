import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ideas, aiCostLogs, collectionLogs } from '@/lib/db/schema';
import { sql, isNotNull, gte } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Total ideas count
    const totalIdeasResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(ideas);
    const totalIdeas = Number(totalIdeasResult[0]?.count || 0);

    // Analyzed count (ideas with analyzedAt)
    const analyzedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(ideas)
      .where(isNotNull(ideas.analyzedAt));
    const analyzedCount = Number(analyzedResult[0]?.count || 0);

    // Recent ideas (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(ideas)
      .where(gte(ideas.discoveredAt, yesterday));
    const recentCount = Number(recentResult[0]?.count || 0);

    // Source breakdown
    const sourceBreakdown = await db
      .select({
        source: ideas.source,
        count: sql<number>`count(*)`,
      })
      .from(ideas)
      .groupBy(ideas.source);

    // Rank distribution
    const rankDistribution = await db
      .select({
        rank: ideas.rankCategory,
        count: sql<number>`count(*)`,
      })
      .from(ideas)
      .where(isNotNull(ideas.rankCategory))
      .groupBy(ideas.rankCategory);

    // AI cost totals
    const costResult = await db
      .select({
        totalCost: sql<number>`COALESCE(SUM(${aiCostLogs.costUsd}), 0)`,
        totalInputTokens: sql<number>`COALESCE(SUM(${aiCostLogs.inputTokens}), 0)`,
        totalOutputTokens: sql<number>`COALESCE(SUM(${aiCostLogs.outputTokens}), 0)`,
      })
      .from(aiCostLogs);

    const aiCosts = {
      totalCost: Number(costResult[0]?.totalCost || 0),
      totalInputTokens: Number(costResult[0]?.totalInputTokens || 0),
      totalOutputTokens: Number(costResult[0]?.totalOutputTokens || 0),
    };

    // Last 7 days AI costs
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentCostResult = await db
      .select({
        totalCost: sql<number>`COALESCE(SUM(${aiCostLogs.costUsd}), 0)`,
      })
      .from(aiCostLogs)
      .where(gte(aiCostLogs.createdAt, sevenDaysAgo));

    const recentAICost = Number(recentCostResult[0]?.totalCost || 0);

    // Recent collection logs (last 5)
    const recentCollections = await db.query.collectionLogs.findMany({
      orderBy: (logs, { desc }) => [desc(logs.completedAt)],
      limit: 5,
    });

    // Sources online status (based on recent successful collections)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentSuccessfulCollections = await db.query.collectionLogs.findMany({
      where: (logs, { and, eq, gte }) =>
        and(
          eq(logs.status, 'success'),
          gte(logs.completedAt, oneDayAgo)
        ),
    });

    const sourcesOnline = [...new Set(recentSuccessfulCollections.map((log) => log.source))];

    return NextResponse.json({
      totalIdeas,
      analyzedCount,
      unanalyzedCount: totalIdeas - analyzedCount,
      recentCount,
      sourceBreakdown,
      rankDistribution,
      aiCosts: {
        ...aiCosts,
        last7Days: recentAICost,
      },
      sourcesOnline,
      recentCollections,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
