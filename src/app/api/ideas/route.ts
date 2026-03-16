import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ideas } from '@/lib/db/schema';
import { desc, asc, like, and, eq, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    // Sorting
    const sort = searchParams.get('sort') || 'finalScore';
    const order = searchParams.get('order') || 'desc';

    // Filters
    const category = searchParams.get('category');
    const source = searchParams.get('source');
    const rank = searchParams.get('rank');
    const search = searchParams.get('search');

    // Build where conditions
    const conditions = [];

    if (category) {
      conditions.push(eq(ideas.category, category));
    }

    if (source) {
      conditions.push(eq(ideas.source, source));
    }

    if (rank) {
      conditions.push(eq(ideas.rankCategory, rank));
    }

    if (search) {
      conditions.push(
        sql`(${ideas.title} LIKE ${`%${search}%`} OR ${ideas.description} LIKE ${`%${search}%`})`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Determine sort column
    let sortColumn;
    switch (sort) {
      case 'trendScore':
        sortColumn = ideas.trendScore;
        break;
      case 'discoveredAt':
        sortColumn = ideas.discoveredAt;
        break;
      case 'sourceScore':
        sortColumn = ideas.sourceScore;
        break;
      default:
        sortColumn = ideas.finalScore;
    }

    const orderBy = order === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Query ideas
    const ideaList = await db.query.ideas.findMany({
      where: whereClause,
      orderBy: [orderBy],
      limit,
      offset,
    });

    // Get total count for pagination
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(ideas)
      .where(whereClause);

    const total = Number(totalResult[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      ideas: ideaList,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching ideas:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ideas', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
