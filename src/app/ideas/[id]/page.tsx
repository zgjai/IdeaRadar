'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Calendar, Database, Target, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScoreRadar } from '@/components/charts/score-radar';
import { TrendLine } from '@/components/charts/trend-line';

interface IdeaDetail {
  id: string;
  title: string;
  url?: string;
  source: string;
  category?: string;
  finalScore: number;
  rankCategory: string;
  discoveredAt: string;
  analyzedAt?: string;
  trendScore: number;
  demandScore: number;
  competitionScore: number;
  feasibilityScore: number;
  growthScore: number;
  analysis?: {
    summary?: string;
    painPoint?: string;
    painPointIntensity?: number;
    targetUsers?: string;
    coreFeatures?: string[];
    competitors?: string[];
    techFeasibility?: string;
    recommendation?: string;
    confidence?: number;
  };
  trendHistory?: Array<{ date: string; score: number }>;
}

export default function IdeaDetailPage() {
  const params = useParams();
  const [idea, setIdea] = useState<IdeaDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIdea();
  }, [params.id]);

  const fetchIdea = async () => {
    try {
      const response = await fetch(`/api/ideas/${params.id}`);
      const data = await response.json();
      setIdea(data);
    } catch (error) {
      console.error('Failed to fetch idea:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">加载创意详情中...</p>
        </div>
      </div>
    );
  }

  if (!idea) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-slate-500 mb-4">未找到该创意</p>
          <Link href="/ideas">
            <Button variant="outline">返回创意库</Button>
          </Link>
        </div>
      </div>
    );
  }

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

  const getRecommendationVariant = (rec?: string) => {
    if (rec?.toLowerCase().includes('go')) return 'success';
    if (rec?.toLowerCase().includes('cautious')) return 'warning';
    if (rec?.toLowerCase().includes('stop')) return 'destructive';
    return 'default';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/ideas">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回创意库
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 mb-3">{idea.title}</h1>
            <div className="flex items-center gap-3">
              <Badge variant={getRankVariant(idea.rankCategory)}>
                {idea.rankCategory}
              </Badge>
              <span className={`px-3 py-1 text-sm font-medium rounded ${getSourceColor(idea.source)}`}>
                {idea.source}
              </span>
              <span className="text-lg font-bold text-blue-600">
                评分: {idea.finalScore}
              </span>
            </div>
          </div>
          {idea.url && (
            <a href={idea.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" />
                查看原文
              </Button>
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Score Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>评分分布</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreRadar
              scores={{
                trendScore: idea.trendScore,
                demandScore: idea.demandScore,
                competitionScore: idea.competitionScore,
                feasibilityScore: idea.feasibilityScore,
                growthScore: idea.growthScore,
              }}
            />
          </CardContent>
        </Card>

        {/* AI Analysis Summary */}
        {idea.analysis?.summary && (
          <Card>
            <CardHeader>
              <CardTitle>AI 分析摘要</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 leading-relaxed mb-4">
                {idea.analysis.summary}
              </p>
              {idea.analysis.recommendation && (
                <div className="mt-4">
                  <Badge variant={getRecommendationVariant(idea.analysis.recommendation)} className="text-sm px-3 py-1">
                    {idea.analysis.recommendation}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pain Point */}
      {idea.analysis?.painPoint && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              用户痛点
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700 mb-3">{idea.analysis.painPoint}</p>
            {idea.analysis.painPointIntensity !== undefined && (
              <div>
                <p className="text-sm text-slate-600 mb-2">痛点强度</p>
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600"
                    style={{ width: `${idea.analysis.painPointIntensity}%` }}
                  />
                </div>
                <p className="text-sm text-slate-600 mt-1">{idea.analysis.painPointIntensity}/100</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Target Users & Core Features */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {idea.analysis?.targetUsers && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                目标用户
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">{idea.analysis.targetUsers}</p>
            </CardContent>
          </Card>
        )}

        {idea.analysis?.coreFeatures && idea.analysis.coreFeatures.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>核心功能</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {idea.analysis.coreFeatures.map((feature, index) => (
                  <Badge key={index} variant="secondary">
                    {feature}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Competitors & Tech Feasibility */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {idea.analysis?.competitors && idea.analysis.competitors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>竞争对手</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {idea.analysis.competitors.map((competitor, index) => (
                  <li key={index} className="text-slate-700 flex items-start">
                    <span className="mr-2 text-blue-600">•</span>
                    {competitor}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {idea.analysis?.techFeasibility && (
          <Card>
            <CardHeader>
              <CardTitle>技术可行性</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">{idea.analysis.techFeasibility}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Trend History */}
      {idea.trendHistory && idea.trendHistory.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>趋势历史</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendLine data={idea.trendHistory} />
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>元数据</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-slate-600 mb-1">来源</p>
              <span className={`px-2 py-1 text-xs font-medium rounded ${getSourceColor(idea.source)}`}>
                {idea.source}
              </span>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">分类</p>
              <p className="text-sm font-medium text-slate-900">{idea.category || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">发现时间</p>
              <p className="text-sm font-medium text-slate-900">{formatDate(idea.discoveredAt)}</p>
            </div>
            {idea.analyzedAt && (
              <div>
                <p className="text-sm text-slate-600 mb-1">分析时间</p>
                <p className="text-sm font-medium text-slate-900">{formatDate(idea.analyzedAt)}</p>
              </div>
            )}
            {idea.analysis?.confidence !== undefined && (
              <div>
                <p className="text-sm text-slate-600 mb-1">置信度</p>
                <p className="text-sm font-medium text-slate-900">{idea.analysis.confidence}%</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
