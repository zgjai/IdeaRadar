'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Filters } from '@/components/ideas/filters';
import { IdeaTable } from '@/components/ideas/idea-table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Idea {
  id: string;
  title: string;
  finalScore: number;
  rankCategory: string;
  source: string;
  category?: string;
  discoveredAt: string;
  trendDirection?: string;
}

interface IdeasResponse {
  ideas: Idea[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function IdeasPage() {
  const router = useRouter();

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [source, setSource] = useState('');
  const [rank, setRank] = useState('');
  const [sort, setSort] = useState('finalScore');
  const [order, setOrder] = useState('desc');

  useEffect(() => {
    fetchIdeas();
  }, [page, search, category, source, rank, sort, order]);

  const fetchIdeas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sort,
        order,
        ...(search && { search }),
        ...(category && { category }),
        ...(source && { source }),
        ...(rank && { rank }),
      });

      const response = await fetch(`/api/ideas?${params}`);
      const data: IdeasResponse = await response.json();

      setIdeas(data.ideas || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
    } catch (error) {
      console.error('Failed to fetch ideas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Ideas</h1>
        <p className="text-slate-600">
          {total} ideas discovered and analyzed
        </p>
      </div>

      <Filters
        search={search}
        category={category}
        source={source}
        rank={rank}
        sort={sort}
        order={order}
        onSearchChange={setSearch}
        onCategoryChange={setCategory}
        onSourceChange={setSource}
        onRankChange={setRank}
        onSortChange={setSort}
        onOrderChange={setOrder}
      />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">Loading ideas...</p>
        </div>
      ) : (
        <>
          <IdeaTable ideas={ideas} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </p>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
