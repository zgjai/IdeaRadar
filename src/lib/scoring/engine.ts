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
  } else if (idea.source === 'google_trends') {
    // Google Trends: sourceScore is traffic volume (numeric)
    // 100K+ searches = very hot, 10K+ = trending
    const trafficScore = Math.min((srcScore / 500000) * 100, 100);
    score += trafficScore;
  } else if (idea.source === 'reddit') {
    // Reddit: 300+ upvotes is very hot, 100+ is trending
    const redditScore = Math.min((srcScore / 300) * 100, 100);
    score += redditScore * 0.7;

    // Comments indicate discussion quality
    const commentScore = Math.min((srcComments / 80) * 100, 100);
    score += commentScore * 0.3;
  } else if (idea.source === 'github') {
    // GitHub: 1000+ stars in < 30 days = very hot
    const starScore = Math.min((srcScore / 1000) * 100, 100);
    score += starScore * 0.8;

    // Open issues as engagement proxy
    const issueScore = Math.min((srcComments / 100) * 100, 100);
    score += issueScore * 0.2;
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
 * Calculate confidence based on data completeness (V2 extended)
 */
export function calculateConfidence(idea: Idea): number {
  let confidence = 0;
  let maxConfidence = 0;

  // Base data always present
  maxConfidence += 10;
  confidence += 10;

  // Source metrics
  maxConfidence += 10;
  if ((idea.sourceScore ?? 0) > 0) confidence += 10;

  // AI screening
  maxConfidence += 10;
  if (idea.category) confidence += 10;

  // AI deep analysis (V1)
  maxConfidence += 20;
  if (idea.aiPainPoint) confidence += 10;
  if (idea.aiFeatures) confidence += 10;

  // SEO validation (V2)
  maxConfidence += 20;
  if (idea.primaryKeyword) confidence += 10;
  if (idea.targetSearchVolume) confidence += 10;

  // V2 analysis pipeline
  maxConfidence += 30;
  if (idea.aiSeoAnalysis) confidence += 10;
  if (idea.aiCompetitorAnalysis) confidence += 10;
  if (idea.aiMonetizationAnalysis) confidence += 10;

  return Math.round((confidence / maxConfidence) * 100);
}

/**
 * Update a single idea's scores (V1 + V2)
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
  const confidence = calculateConfidence(idea);

  // Use V2 opportunityScore for ranking if available, otherwise V1 finalScore
  const effectiveScore = idea.opportunityScore && idea.opportunityScore > 0
    ? idea.opportunityScore
    : finalScore;
  const rankCategory = categorizeScore(effectiveScore);

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
      opportunityScore: idea.opportunityScore,
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
