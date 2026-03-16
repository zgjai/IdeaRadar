import Link from 'next/link';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface Idea {
  id: string;
  title: string;
  finalScore: number;
  rankCategory: string;
  source: string;
  trendDirection?: string;
}

interface RecentIdeasProps {
  ideas: Idea[];
}

export function RecentIdeas({ ideas }: RecentIdeasProps) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Top Ideas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {ideas.map((idea) => (
            <Link
              key={idea.id}
              href={`/ideas/${idea.id}`}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Badge variant={getRankVariant(idea.rankCategory)}>
                {idea.rankCategory}
              </Badge>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {idea.title}
                </p>
              </div>

              <span className={`px-2 py-1 text-xs font-medium rounded ${getSourceColor(idea.source)}`}>
                {idea.source}
              </span>

              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {idea.finalScore}
                </span>
                {idea.trendDirection === 'up' && (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                )}
                {idea.trendDirection === 'down' && (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
