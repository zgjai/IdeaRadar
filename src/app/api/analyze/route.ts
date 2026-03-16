import { NextRequest, NextResponse } from 'next/server';
import { analyzer } from '@/lib/ai/analyzer';
import { rankAllIdeas } from '@/lib/scoring/engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const mode = body.mode || 'all'; // 'screen' | 'deep' | 'all'
    const limit = Math.min(body.limit || 10, 50);

    if (!['screen', 'deep', 'all'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "screen", "deep", or "all"' },
        { status: 400 }
      );
    }

    console.log(`Starting analysis: mode=${mode}, limit=${limit}`);

    const result = await analyzer.analyzeUnanalyzed(mode as 'screen' | 'deep' | 'all', limit);

    // Update scores after analysis
    if (result.analyzed > 0) {
      console.log('Updating scores after analysis...');
      await rankAllIdeas();
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      {
        error: 'Analysis failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
