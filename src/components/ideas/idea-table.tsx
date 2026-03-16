import Link from 'next/link';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScoreBadge } from './score-badge';

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

interface IdeaTableProps {
  ideas: Idea[];
}

export function IdeaTable({ ideas }: IdeaTableProps) {
  const getRankVariant = (rank: string) => {
    const variants: Record<string, any> = {
      'S': 'rank-s',
      'A': 'rank-a',
      'B': 'rank-b',
      'C': 'rank-c',
      'D': 'rank-d',
    };
    return variants[rank] || 'default';
  };

  const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
      'HN': 'bg-orange-100 text-orange-700',
      'PH': 'bg-teal-100 text-teal-700',
      'GT': 'bg-blue-100 text-blue-700',
    };
    return colors[source] || 'bg-slate-100 text-slate-700';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 tracking-wider">
              等级
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 tracking-wider">
              标题
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 tracking-wider">
              评分
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 tracking-wider">
              分类
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 tracking-wider">
              来源
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 tracking-wider">
              趋势
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 tracking-wider">
              发现时间
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {ideas.map((idea) => (
            <tr
              key={idea.id}
              className="hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <Link href={`/ideas/${idea.id}`}>
                  <Badge variant={getRankVariant(idea.rankCategory)}>
                    {idea.rankCategory}
                  </Badge>
                </Link>
              </td>
              <td className="px-6 py-4">
                <Link href={`/ideas/${idea.id}`}>
                  <span className="text-sm font-medium text-slate-900 hover:text-blue-600">
                    {idea.title}
                  </span>
                </Link>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <ScoreBadge score={idea.finalScore} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm text-slate-600">
                  {idea.category || 'N/A'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 text-xs font-medium rounded ${getSourceColor(idea.source)}`}>
                  {idea.source}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {idea.trendDirection === 'up' && (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                )}
                {idea.trendDirection === 'down' && (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
                {!idea.trendDirection && (
                  <span className="text-slate-400">-</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                {formatDate(idea.discoveredAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {ideas.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500">暂无创意数据</p>
        </div>
      )}
    </div>
  );
}
