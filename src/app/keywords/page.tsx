'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/spinner';

interface Keyword {
  id: number;
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  cpc: number | null;
  competition: string | null;
  intent: string | null;
  dataSource: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('search_volume');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchKeywords();
  }, [search, sort, order, page]);

  const fetchKeywords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        sort,
        order,
      });
      if (search) params.set('search', search);

      const response = await fetch(`/api/keywords?${params}`);
      const data = await response.json();
      setKeywords(data.keywords || []);
      setPagination(data.pagination || null);
    } catch (error) {
      console.error('Failed to fetch keywords:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (d: number | null) => {
    if (d === null) return 'text-slate-400';
    if (d <= 30) return 'text-green-600';
    if (d <= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDifficultyLabel = (d: number | null) => {
    if (d === null) return '-';
    if (d <= 30) return '低';
    if (d <= 60) return '中';
    return '高';
  };

  const formatVolume = (v: number | null) => {
    if (v === null) return '-';
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return String(v);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">关键词浏览器</h1>
        <p className="text-slate-600">浏览和分析 SEO 关键词数据</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Input
                placeholder="搜索关键词..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              <option value="search_volume">搜索量</option>
              <option value="difficulty">难度</option>
              <option value="cpc">CPC</option>
              <option value="keyword">关键词</option>
            </Select>
            <Select
              value={order}
              onChange={(e) => {
                setOrder(e.target.value);
                setPage(1);
              }}
            >
              <option value="desc">降序</option>
              <option value="asc">升序</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      {pagination && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-slate-500">总关键词数</p>
              <p className="text-2xl font-bold text-slate-900">
                {pagination.total.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-slate-500">当前页</p>
              <p className="text-2xl font-bold text-slate-900">
                {pagination.page} / {pagination.totalPages}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-slate-500">显示条目</p>
              <p className="text-2xl font-bold text-slate-900">{keywords.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Keywords Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <LoadingState text="加载关键词数据中..." />
          ) : keywords.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-slate-500 mb-2">暂无关键词数据</p>
                <p className="text-sm text-slate-400">
                  运行 V2 分析后会自动采集关键词
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                      关键词
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">
                      月搜索量
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">
                      难度
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">
                      CPC
                    </th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">
                      竞争度
                    </th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">
                      搜索意图
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((kw) => (
                    <tr
                      key={kw.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900">{kw.keyword}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-sm text-slate-700">
                          {formatVolume(kw.searchVolume)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-mono text-sm ${getDifficultyColor(kw.difficulty)}`}>
                          {kw.difficulty !== null ? `${kw.difficulty}` : '-'}
                        </span>
                        <span className="text-xs text-slate-400 ml-1">
                          {getDifficultyLabel(kw.difficulty)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-sm text-slate-700">
                          {kw.cpc !== null ? `$${kw.cpc.toFixed(2)}` : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {kw.competition ? (
                          <Badge
                            variant={
                              kw.competition === 'LOW'
                                ? 'green'
                                : kw.competition === 'MEDIUM'
                                  ? 'yellow'
                                  : 'red'
                            }
                          >
                            {kw.competition}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {kw.intent ? (
                          <Badge variant="blue">{kw.intent}</Badge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            上一页
          </button>
          <span className="px-4 py-2 text-sm text-slate-600">
            {page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
            disabled={page >= pagination.totalPages}
            className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
