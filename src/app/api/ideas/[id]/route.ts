import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ideas, trendHistory } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const idea = await db.query.ideas.findFirst({
      where: eq(ideas.id, id),
    });

    if (!idea) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }

    // Fetch trend history
    const history = await db.query.trendHistory.findMany({
      where: eq(trendHistory.ideaId, id),
      orderBy: (trendHistory, { desc }) => [desc(trendHistory.date)],
      limit: 30,
    });

    // Parse JSON fields
    const features = idea.aiFeatures ? JSON.parse(idea.aiFeatures) : null;
    const competitorsList = idea.aiCompetitors ? JSON.parse(idea.aiCompetitors) : null;

    // Parse V2 JSON fields
    const aiSeoAnalysis = idea.aiSeoAnalysis ? JSON.parse(idea.aiSeoAnalysis) : null;
    const aiCompetitorAnalysis = idea.aiCompetitorAnalysis ? JSON.parse(idea.aiCompetitorAnalysis) : null;
    const aiMonetizationAnalysis = idea.aiMonetizationAnalysis ? JSON.parse(idea.aiMonetizationAnalysis) : null;
    const aiRecommendation = idea.aiRecommendation ? JSON.parse(idea.aiRecommendation) : null;

    return NextResponse.json({
      ...idea,
      aiFeatures: features,
      aiCompetitors: competitorsList,
      aiSeoAnalysis,
      aiCompetitorAnalysis,
      aiMonetizationAnalysis,
      aiRecommendation,
      trendHistory: history,
    });
  } catch (error) {
    console.error('Error fetching idea:', error);
    return NextResponse.json(
      { error: 'Failed to fetch idea', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
