import { NextRequest, NextResponse } from 'next/server';
import { collectAll } from '@/lib/collectors';
import { rankAllIdeas } from '@/lib/scoring/engine';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting manual collection...');

    // Collect from all sources
    const collectionSummary = await collectAll();

    // Update scores for new ideas
    if (collectionSummary.new > 0) {
      console.log('Updating scores for new ideas...');
      await rankAllIdeas();
    }

    return NextResponse.json({
      success: true,
      message: `Collected ${collectionSummary.new} new ideas`,
      summary: collectionSummary,
    });
  } catch (error) {
    console.error('Collection error:', error);
    return NextResponse.json(
      {
        error: 'Collection failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
