import { db } from '../db';
import { ideas } from '../db/schema';
import { eq, isNull } from 'drizzle-orm';
import { createAIProvider } from './provider';
import { screeningPrompt, deepAnalysisPrompt } from './prompts';
import type { Idea } from '../db/schema';
import type { AnalysisResult, DeepAnalysisResult } from './types';

function parseJSON<T>(content: string): T | null {
  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    // Try direct parse
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to parse JSON:', error, '\nContent:', content);
    return null;
  }
}

export class IdeaAnalyzer {
  /**
   * Quick screening using cheap model
   */
  async screenIdea(idea: Idea): Promise<AnalysisResult | null> {
    try {
      const provider = await createAIProvider('screening');
      const prompt = screeningPrompt(idea.title, idea.description, idea.source, idea.sourceScore ?? 0);

      const response = await provider.callWithRetry(
        [{ role: 'user', content: prompt }],
        idea.id,
        'screening'
      );

      const result = parseJSON<AnalysisResult>(response);
      if (!result) {
        throw new Error('Failed to parse screening result');
      }

      // Update idea with screening results
      await db
        .update(ideas)
        .set({
          category: result.category,
          aiTargetUsers: result.targetUsers,
          aiSummary: result.summary,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(ideas.id, idea.id));

      return result;
    } catch (error) {
      console.error(`Failed to screen idea ${idea.id}:`, error);
      return null;
    }
  }

  /**
   * Full analysis using quality model
   */
  async deepAnalyzeIdea(idea: Idea): Promise<DeepAnalysisResult | null> {
    try {
      const provider = await createAIProvider('analysis');

      // Build context from existing data
      const commentsSummary = idea.sourceComments
        ? `This idea has ${idea.sourceComments} comments/discussions.`
        : undefined;

      const prompt = deepAnalysisPrompt(
        idea.title,
        idea.description,
        commentsSummary,
        undefined
      );

      const response = await provider.callWithRetry(
        [{ role: 'user', content: prompt }],
        idea.id,
        'deep'
      );

      const result = parseJSON<DeepAnalysisResult>(response);
      if (!result) {
        throw new Error('Failed to parse deep analysis result');
      }

      // Update idea with deep analysis results
      await db
        .update(ideas)
        .set({
          aiPainPoint: result.painPoint,
          aiTargetUsers: result.targetUsers,
          aiFeatures: JSON.stringify(result.coreFeatures),
          aiCompetitors: JSON.stringify(result.competitors),
          aiTechFeasibility: result.techFeasibility,
          demandScore: result.demandScore,
          competitionScore: result.competitionScore,
          feasibilityScore: result.feasibilityScore,
          growthScore: result.growthScore,
          analyzedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(ideas.id, idea.id));

      return result;
    } catch (error) {
      console.error(`Failed to deep analyze idea ${idea.id}:`, error);
      return null;
    }
  }

  /**
   * Screen multiple ideas in batch
   */
  async batchScreen(ideaList: Idea[], concurrency = 3): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    // Process in batches to avoid rate limits
    for (let i = 0; i < ideaList.length; i += concurrency) {
      const batch = ideaList.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map((idea) => this.screenIdea(idea))
      );

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          success++;
        } else {
          failed++;
        }
      });

      // Small delay between batches
      if (i + concurrency < ideaList.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return { success, failed };
  }

  /**
   * Get unanalyzed ideas
   */
  async getUnanalyzedIdeas(limit?: number): Promise<Idea[]> {
    const query = db.query.ideas.findMany({
      where: isNull(ideas.analyzedAt),
      limit,
    });

    return query;
  }

  /**
   * Analyze all unanalyzed ideas
   */
  async analyzeUnanalyzed(mode: 'screen' | 'deep' | 'all' = 'all', limit = 10) {
    const unanalyzed = await this.getUnanalyzedIdeas(limit);

    if (unanalyzed.length === 0) {
      return { screened: 0, analyzed: 0, message: 'No unanalyzed ideas found' };
    }

    let screened = 0;
    let analyzed = 0;

    if (mode === 'screen' || mode === 'all') {
      const unscreened = unanalyzed.filter((idea) => !idea.category);
      const screenResults = await this.batchScreen(unscreened);
      screened = screenResults.success;
    }

    if (mode === 'deep' || mode === 'all') {
      for (const idea of unanalyzed.slice(0, 5)) {
        const result = await this.deepAnalyzeIdea(idea);
        if (result) analyzed++;

        // Delay between deep analyses
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    return {
      screened,
      analyzed,
      message: `Screened ${screened} ideas, deeply analyzed ${analyzed} ideas`,
    };
  }
}

export const analyzer = new IdeaAnalyzer();
