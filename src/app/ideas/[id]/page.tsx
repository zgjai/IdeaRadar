'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Target, Users, Lightbulb, Star, AlertTriangle, ShieldAlert, CheckCircle, FileSearch, XCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/spinner';
import { ScoreRadar } from '@/components/charts/score-radar';
import { TrendLine } from '@/components/charts/trend-line';

interface IdeaDetail {
  id: string;
  title: string;
  url?: string;
  source: string;
  category?: string;
  status?: string;
  finalScore: number;
  rankCategory: string;
  discoveredAt: string;
  analyzedAt?: string;
  trendScore: number;
  demandScore: number;
  competitionScore: number;
  feasibilityScore: number;
  growthScore: number;
  // V2 fields
  trafficScore?: number;
  monetizationScore?: number;
  executionScore?: number;
  opportunityScore?: number;
  primaryKeyword?: string;
  targetSearchVolume?: number;
  targetKeywordDifficulty?: number;
  targetCpc?: number;
  estimatedTraffic?: number;
  competitorCount?: number;
  aiSeoAnalysis?: Record<string, unknown>;
  aiCompetitorAnalysis?: Record<string, unknown>;
  aiMonetizationAnalysis?: Record<string, unknown>;
  aiRecommendation?: Record<string, unknown>;
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

function V2VerificationStatus({ rec }: { rec?: Record<string, unknown> }) {
  if (!rec?.verificationStatus) return null;
  const vs = rec.verificationStatus as { status: string; reasoning: string; confidence_level: number };
  return (
    <Card className={`mb-6 border-2 ${
      vs.status === 'validated' ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300' :
      vs.status === 'conditional' ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300' :
      vs.status === 'needs_evidence' ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-300' :
      'bg-gradient-to-r from-red-50 to-rose-50 border-red-300'
    }`}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
            vs.status === 'validated' ? 'bg-green-500' :
            vs.status === 'conditional' ? 'bg-yellow-500' :
            vs.status === 'needs_evidence' ? 'bg-blue-500' : 'bg-red-500'
          }`}>
            {vs.status === 'validated' && <CheckCircle className="w-6 h-6 text-white" />}
            {vs.status === 'conditional' && <AlertTriangle className="w-6 h-6 text-white" />}
            {vs.status === 'needs_evidence' && <FileSearch className="w-6 h-6 text-white" />}
            {vs.status === 'skip' && <XCircle className="w-6 h-6 text-white" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-lg font-bold text-slate-900">
                {vs.status === 'validated' ? 'PASS - 通过验证' :
                 vs.status === 'conditional' ? 'CONDITIONAL - 有条件通过' :
                 vs.status === 'needs_evidence' ? 'PENDING - 待补关键证据' : 'SKIP - 建议放弃'}
              </h3>
              <Badge variant={
                vs.status === 'validated' ? 'green' :
                vs.status === 'conditional' ? 'yellow' :
                vs.status === 'needs_evidence' ? 'blue' : 'red'
              }>
                {vs.confidence_level}%
              </Badge>
            </div>
            <p className="text-sm text-slate-700">{vs.reasoning}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function V2CounterEvidence({ rec }: { rec?: Record<string, unknown> }) {
  if (!rec?.counterEvidence) return null;
  const ce = rec.counterEvidence as { failure_reasons: string[]; kill_criteria: string[]; counter_arguments: string[] };
  return (
    <Card className="mb-6 border-orange-200 bg-orange-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-700">
          <ShieldAlert className="w-5 h-5" />
          反证分析
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {ce.failure_reasons?.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">失败风险：</p>
            <ul className="space-y-1.5">
              {ce.failure_reasons.map((r, i) => (
                <li key={i} className="text-sm text-slate-700 flex items-start">
                  <span className="w-5 h-5 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-bold mr-2 shrink-0">{i + 1}</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
        {ce.kill_criteria?.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-sm font-semibold text-slate-700 mb-2">终止标准：</p>
            <div className="space-y-1.5">
              {ce.kill_criteria.map((k, i) => (
                <div key={i} className="flex items-start p-2 bg-white rounded-lg border border-orange-200">
                  <Badge variant="red" className="mr-2 mt-0.5 shrink-0 text-xs">STOP</Badge>
                  <p className="text-sm text-slate-700 flex-1">{k}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {ce.counter_arguments?.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-sm font-semibold text-slate-700 mb-2">反驳论据：</p>
            <ul className="space-y-1.5">
              {ce.counter_arguments.map((a, i) => (
                <li key={i} className="text-sm text-slate-700 flex items-start p-2 bg-yellow-50 rounded">
                  <span className="mr-2 text-yellow-600 shrink-0">!</span>{a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function IdeaDetailPage() {
  const params = useParams();
  const [idea, setIdea] = useState<IdeaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningV2, setRunningV2] = useState(false);

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

  const runV2Analysis = async () => {
    if (!idea) return;
    setRunningV2(true);
    toast.loading('正在运行 V2 深度分析（约 30 秒）...', { id: 'v2-analysis' });
    try {
      const res = await fetch('/api/analyze-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaId: idea.id }),
      });
      if (res.ok) {
        await fetchIdea();
        toast.success('V2 深度分析完成！', { id: 'v2-analysis' });
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'V2 分析失败', { id: 'v2-analysis' });
      }
    } catch (e) {
      console.error(e);
      toast.error('V2 分析请求失败，请重试', { id: 'v2-analysis' });
    } finally {
      setRunningV2(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <LoadingState text="加载创意详情中..." />
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
          <div className="flex gap-2">
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
      </div>

      {/* V2 Analysis - Prominent CTA or Results */}
      {idea.opportunityScore !== undefined && idea.opportunityScore > 0 ? (
        <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200">
          <CardContent className="p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Star className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">V2 深度分析结果</h2>
                <p className="text-slate-600">基于 SEO 数据、竞品分析和市场机会评估</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">流量获取力</p>
                <p className="text-3xl font-bold text-blue-600">{idea.trafficScore ?? 0}</p>
                <p className="text-xs text-slate-500">权重 40%</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">变现潜力</p>
                <p className="text-3xl font-bold text-green-600">{idea.monetizationScore ?? 0}</p>
                <p className="text-xs text-slate-500">权重 35%</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">执行可行性</p>
                <p className="text-3xl font-bold text-purple-600">{idea.executionScore ?? 0}</p>
                <p className="text-xs text-slate-500">权重 25%</p>
              </div>
              <div className="text-center border-l-2 border-blue-200 pl-6">
                <p className="text-sm text-slate-600 mb-1">机会总分</p>
                <p className="text-4xl font-bold text-slate-900">{idea.opportunityScore}</p>
                <Badge variant={
                  (idea.aiRecommendation as Record<string, unknown>)?.verdict === 'strong_go' ? 'green' :
                  (idea.aiRecommendation as Record<string, unknown>)?.verdict === 'go' ? 'green' :
                  (idea.aiRecommendation as Record<string, unknown>)?.verdict === 'cautious' ? 'yellow' : 'red'
                } className="mt-1">
                  {(idea.aiRecommendation as Record<string, unknown>)?.verdict === 'strong_go' ? '强烈推荐' :
                   (idea.aiRecommendation as Record<string, unknown>)?.verdict === 'go' ? '建议做' :
                   (idea.aiRecommendation as Record<string, unknown>)?.verdict === 'cautious' ? '需验证' : '不建议'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : !idea.aiSeoAnalysis ? (
        <Card className="mb-6 border-2 border-dashed border-blue-300 bg-blue-50/50">
          <CardContent className="p-8 text-center">
            <Lightbulb className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">运行 V2 深度分析</h3>
            <p className="text-slate-600 mb-4">获取 SEO 数据、竞品分析和 AI 商业建议</p>
            <Button size="lg" onClick={runV2Analysis} disabled={runningV2}>
              {runningV2 ? '分析中...' : '开始分析（约 30 秒）'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

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

      {/* V2 SEO & Keyword Data */}
      {idea.primaryKeyword && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>SEO 关键词数据</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-slate-600">主要关键词</p>
                <p className="font-medium text-slate-900">{idea.primaryKeyword}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">月搜索量</p>
                <p className="font-mono font-medium text-slate-900">
                  {idea.targetSearchVolume?.toLocaleString() ?? '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">关键词难度</p>
                <p className="font-mono font-medium text-slate-900">
                  {idea.targetKeywordDifficulty ?? '-'}/100
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">CPC</p>
                <p className="font-mono font-medium text-slate-900">
                  {idea.targetCpc ? `$${idea.targetCpc.toFixed(2)}` : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">竞品数量</p>
                <p className="font-mono font-medium text-slate-900">
                  {idea.competitorCount ?? '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* V2 AI Recommendation */}
      {idea.aiRecommendation && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>AI 可执行建议</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const rec = idea.aiRecommendation as Record<string, string | string[]>;
              return (
                <>
                  {rec.productForm && (
                    <div>
                      <p className="text-sm text-slate-600 mb-1">建议产品形态</p>
                      <p className="font-medium text-slate-900">
                        {String(rec.productForm)}
                      </p>
                    </div>
                  )}
                  {Array.isArray(rec.mvpFeatures) && (
                    <div>
                      <p className="text-sm text-slate-600 mb-2">MVP 核心功能</p>
                      <div className="flex flex-wrap gap-2">
                        {(rec.mvpFeatures as string[]).map(
                          (f: string, i: number) => (
                            <Badge key={i} variant="blue">{f}</Badge>
                          )
                        )}
                      </div>
                    </div>
                  )}
                  {rec.trafficStrategy && (
                    <div>
                      <p className="text-sm text-slate-600 mb-1">流量获取策略</p>
                      <p className="text-slate-700">
                        {String(rec.trafficStrategy)}
                      </p>
                    </div>
                  )}
                  {rec.monetizationPath && (
                    <div>
                      <p className="text-sm text-slate-600 mb-1">变现路径</p>
                      <p className="text-slate-700">
                        {String(rec.monetizationPath)}
                      </p>
                    </div>
                  )}
                  {Array.isArray(rec.risks) && (
                    <div>
                      <p className="text-sm text-slate-600 mb-2">风险提示</p>
                      <ul className="space-y-1">
                        {(rec.risks as string[]).map(
                          (r: string, i: number) => (
                            <li key={i} className="text-sm text-red-700 flex items-start">
                              <span className="mr-2">!</span>{r}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                  {rec.reasoning && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-slate-600 italic">
                        {String(rec.reasoning)}
                      </p>
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* V2 Verification Status */}
      <V2VerificationStatus rec={idea.aiRecommendation} />

      {/* V2 Counter-Evidence */}
      <V2CounterEvidence rec={idea.aiRecommendation} />

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
