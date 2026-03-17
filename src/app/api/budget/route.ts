import { NextRequest, NextResponse } from 'next/server';
import { getBudgetOverview } from '@/lib/budget/manager';

export const dynamic = 'force-dynamic';

/**
 * GET /api/budget
 * Get budget overview with daily/monthly spend and per-API breakdown
 */
export async function GET(_request: NextRequest) {
  try {
    const overview = await getBudgetOverview();
    return NextResponse.json(overview);
  } catch (error) {
    console.error('[Budget API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch budget data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
