import { db } from '../db';
import { ideas, trendHistory } from '../db/schema';
import { eq, sql, desc, isNotNull } from 'drizzle-orm';
import type { Idea } from '../db/schema';

export const DEFAULT_WEIGHTS = {
  trend: 0.30,
  demand: 0.25,
  competition: 0.20,
  feasibility: 0.15,
  growth: 0.10,
};

/**
 * Calculate trend score based on source metrics and historical data
 */
function calculateTrendScore(idea: Idea): number {
  let score = 0;

  const srcScore = idea.sourceScore ?? 0;
  const srcComments = idea.sourceComments ?? 0;

  // Base score from source metrics
  if (idea.source === 'hackernews') {
    // HN: score of 100+ is trending, 500+ is hot
    const hnScore = Math.min((srcScore / 500) * 100, 100);
    score += hnScore * 0.7;

    // Comments indicate engagement
    const commentScore = Math.min((srcComments / 100) * 100, 100);
    score += commentScore * 0.3;
  } else if (idea.source === 'producthunt') {
    // PH: 200+ votes is trending
    const phScore = Math.min((srcScore / 200) * 100, 100);
    score += phScore * 0.8;

    const commentScore = Math.min((srcComments / 50) * 100, 100);
    score += commentScore * 0.2;
  }

  // Recency boost: ideas discovered in last 7 days get boost
  const daysOld = (Date.now() - new Date(idea.discoveredAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysOld < 7) {
    score *= 1.0 + (7 - daysOld) / 14; // Up to 50% boost for fresh ideas
  }

  return Math.min(score, 100);
}

/**
 * Calculate final weighted score
 */
export function calculateFinalScore(idea: Idea, weights = DEFAULT_WEIGHTS): number {
  const trendScore = idea.trendScore ?? calculateTrendScore(idea);
  const demandScore = idea.demandScore ?? 50;
  const competitionScore = idea.competitionScore ?? 50;
  const feasibilityScore = idea.feasibilityScore ?? 50;
  const growthScore = idea.growthScore ?? 50;

  const finalScore =
    trendScore * weights.trend +
    demandScore * weights.demand +
    competitionScore * weights.competition +
    feasibilityScore * weights.feasibility +
    growthScore * weights.growth;

  return Math.round(finalScore * 100) / 100;
}

/**
 * Categorize score into ranks
 */
export function categorizeScore(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (score >= 85) return 'S';
  if (score >= 70) return 'A';
  if (score >= 55) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

/**
 * Calculate confidence based on data completeness
 */
export function calculateConfidence(idea: Idea): number {
  let confidence = 0;
  let maxConfidence = 0;

  // Base data always present
  maxConfidence += 20;
  confidence += 20;

  // Source metrics
  maxConfidence += 15;
  if ((idea.sourceScore ?? 0) > 0) confidence += 15;

  // AI screening
  maxConfidence += 20;
  if (idea.category) confidence += 20;

  // AI deep analysis
  maxConfidence += 45;
  if (idea.aiPainPoint) confidence += 15;
  if (idea.aiFeatures) confidence += 15;
  if (idea.analyzedAt) confidence += 15;

  return Math.round((confidence / maxConfidence) * 100);
}

/**
 * Update a single idea's scores
 */
export async function updateIdeaScore(ideaId: string): Promise<void> {
  const idea = await db.query.ideas.findFirst({
    where: eq(ideas.id, ideaId),
  });

  if (!idea) {
    throw new Error(`Idea ${ideaId} not found`);
  }

  const trendScore = calculateTrendScore(idea);
  const finalScore = calculateFinalScore({ ...idea, trendScore });
  const rankCategory = categorizeScore(finalScore);
  const confidence = calculateConfidence(idea);

  await db
    .update(ideas)
    .set({
      trendScore,
      finalScore,
      rankCategory,
      confidence,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(ideas.id, ideaId));

  // Record trend history
  await db.insert(trendHistory).values({
    ideaId,
    date: new Date().toISOString(),
    source: idea.source,
    score: trendScore,
    metadata: JSON.stringify({
      finalScore,
      rankCategory,
      sourceScore: idea.sourceScore,
    }),
  });
}

/**
 * Recalculate all idea scores
 */
export async function rankAllIdeas(): Promise<{ updated: number; duration: number }> {
  const startTime = Date.now();

  const allIdeas = await db.query.ideas.findMany();

  let updated = 0;

  for (const idea of allIdeas) {
    try {
      await updateIdeaScore(idea.id);
      updated++;
    } catch (error) {
      console.error(`Failed to update score for idea ${idea.id}:`, error);
    }
  }

  const duration = Date.now() - startTime;

  console.log(`Ranked ${updated} ideas in ${duration}ms`);

  return { updated, duration };
}

/**
 * Get top ideas by final score
 */
export async function getTopIdeas(limit = 10) {
  return db.query.ideas.findMany({
    where: isNotNull(ideas.finalScore),
    orderBy: [desc(ideas.finalScore)],
    limit,
  });
}

/**
 * Get ideas by rank category
 */
export async function getIdeasByRank(rank: 'S' | 'A' | 'B' | 'C' | 'D', limit = 20) {
  return db.query.ideas.findMany({
    where: eq(ideas.rankCategory, rank),
    orderBy: [desc(ideas.finalScore)],
    limit,
  });
}
