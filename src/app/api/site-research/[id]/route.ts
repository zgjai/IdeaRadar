import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { siteResearches } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/site-research/[id] - Get a single site research detail
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const researchId = parseInt(id, 10);

    if (isNaN(researchId)) {
      return NextResponse.json({ error: '无效的 ID' }, { status: 400 });
    }

    const [research] = await db
      .select()
      .from(siteResearches)
      .where(eq(siteResearches.id, researchId))
      .limit(1);

    if (!research) {
      return NextResponse.json({ error: '未找到该调研记录' }, { status: 404 });
    }

    // Parse JSON fields
    const result = {
      ...research,
      aiAnalysis: research.aiAnalysis ? JSON.parse(research.aiAnalysis) : null,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[SiteResearch] GET [id] error:', error);
    return NextResponse.json({ error: '获取调研详情失败' }, { status: 500 });
  }
}
