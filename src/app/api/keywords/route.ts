import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { keywords, ideaKeywords } from '@/lib/db/schema';
import { desc, asc, like, sql, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/keywords
 * List keywords with pagination, sorting, filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const sort = searchParams.get('sort') || 'search_volume';
    const order = searchParams.get('order') || 'desc';
    const search = searchParams.get('search') || '';
    const minVolume = parseInt(searchParams.get('minVolume') || '0');
    const maxDifficulty = parseInt(searchParams.get('maxDifficulty') || '100');
    const ideaId = searchParams.get('ideaId'); // filter by linked idea

    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [];
    if (search) {
      conditions.push(like(keywords.keyword, `%${search}%`));
    }
    if (minVolume > 0) {
      conditions.push(sql`${keywords.searchVolume} >= ${minVolume}`);
    }
    if (maxDifficulty < 100) {
      conditions.push(sql`${keywords.difficulty} <= ${maxDifficulty}`);
    }

    // If filtering by idea, get keyword IDs first
    let keywordIds: number[] | null = null;
    if (ideaId) {
      const links = await db.query.ideaKeywords.findMany({
        where: eq(ideaKeywords.ideaId, ideaId),
      });
      keywordIds = links.map((l) => l.keywordId);
      if (keywordIds.length === 0) {
        return NextResponse.json({ keywords: [], pagination: { page, limit, total: 0 } });
      }
    }

    // Build query
    const where =
      conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined;

    // Sort
    const sortColumn =
      sort === 'difficulty'
        ? keywords.difficulty
        : sort === 'cpc'
          ? keywords.cpc
          : sort === 'keyword'
            ? keywords.keyword
            : keywords.searchVolume;
    const orderBy = order === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Count total
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(keywords)
      .where(where);
    const total = countResult[0]?.count ?? 0;

    // Fetch keywords
    const rows = await db.query.keywords.findMany({
      where,
      orderBy: [orderBy],
      limit,
      offset,
    });

    return NextResponse.json({
      keywords: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Keywords API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keywords', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
