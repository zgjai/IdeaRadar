import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ideas } from '@/lib/db/schema';
import { eq, isNull, inArray } from 'drizzle-orm';
import { processIdeaKeywords } from '@/lib/keywords/processor';
import { discoverCompetitors, detectMonetizationSignals } from '@/lib/competitors/analyzer';
import { runV2Analysis } from '@/lib/ai/pipeline-v2';
import { updateIdeaScore } from '@/lib/scoring/engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for long analysis

/**
 * POST /api/analyze-v2
 * Run the full V2 analysis pipeline on ideas
 *
 * Body:
 *   { ideaId: string }         - Analyze a single idea
 *   { mode: "batch", limit: 5 } - Analyze next N unanalyzed ideas
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Single idea analysis
    if (body.ideaId) {
      const result = await analyzeOne(body.ideaId);
      return NextResponse.json(result);
    }

    // Batch mode
    const limit = Math.min(body.limit || 5, 20);
    const results = await analyzeBatch(limit);
    return NextResponse.json(results);
  } catch (error) {
    console.error('[V2 Analyze] Error:', error);
    return NextResponse.json(
      { error: 'Analysis failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

async function analyzeOne(ideaId: string) {
  const idea = await db.query.ideas.findFirst({ where: eq(ideas.id, ideaId) });
  if (!idea) {
    return { error: 'Idea not found', ideaId };
  }

  console.log(`[V2 Analyze] Starting full pipeline for: ${idea.title}`);
  const startTime = Date.now();

  // Step 1: Keyword extraction + SEO data enrichment
  console.log('[V2 Analyze] Step 1: Keywords');
  const kwResult = await processIdeaKeywords(idea);

  // Step 2: Competitor discovery from SERP
  console.log('[V2 Analyze] Step 2: Competitors');
  const competitors = await discoverCompetitors(idea);

  // Step 3: Monetization signal detection
  console.log('[V2 Analyze] Step 3: Monetization signals');
  for (const comp of competitors.slice(0, 10)) {
    await detectMonetizationSignals(comp.domain);
  }

  // Step 4: AI 4-stage analysis
  console.log('[V2 Analyze] Step 4: AI Analysis');
  const analysis = await runV2Analysis(ideaId);

  // Step 5: Update scores
  console.log('[V2 Analyze] Step 5: Score update');
  await updateIdeaScore(ideaId);

  const duration = Date.now() - startTime;
  console.log(`[V2 Analyze] Completed in ${duration}ms`);

  return {
    success: true,
    ideaId,
    ideaTitle: idea.title,
    duration,
    keywords: kwResult,
    competitorCount: competitors.length,
    analysis: analysis
      ? {
          trafficScore: analysis.trafficScore,
          monetizationScore: analysis.monetizationScoreValue,
          executionScore: analysis.executionScore,
          opportunityScore: analysis.opportunityScore,
          verdict: analysis.recommendation.verdict,
        }
      : null,
  };
}

async function analyzeBatch(limit: number) {
  // Find ideas that haven't been V2 analyzed yet
  const unanalyzed = await db.query.ideas.findMany({
    where: isNull(ideas.aiSeoAnalysis),
    limit,
  });

  if (unanalyzed.length === 0) {
    return { success: true, message: '没有待分析的创意', analyzed: 0 };
  }

  const results = [];
  let success = 0;
  let failed = 0;

  for (const idea of unanalyzed) {
    try {
      const result = await analyzeOne(idea.id);
      results.push(result);
      success++;
    } catch (error) {
      console.error(`[V2 Analyze] Failed for ${idea.id}:`, error);
      failed++;
    }
  }

  return {
    success: true,
    message: `分析完成: ${success} 成功, ${failed} 失败`,
    analyzed: success,
    failed,
    results,
  };
}
