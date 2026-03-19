'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Globe, Search, Clock, CheckCircle, XCircle, ArrowRight, Star, Users, Zap, TrendingUp, ShieldAlert, Lightbulb, Target, AlertTriangle, FileSearch } from 'lucide-react';
import { FiveDimRadar } from '@/components/charts/five-dim-radar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/spinner';

interface SiteAnalysis {
  overview: {
    name: string;
    oneLiner: string;
    category: string;
    coreValue: string;
    problemSolved: string;
  };
  productDesign: {
    coreFeatures: string[];
    userFlow: string;
    techStackGuess: string[];
    designStyle: string;
    highlights: string[];
  };
  userPersona: {
    primaryAudience: string;
    secondaryAudience: string;
    useCases: string[];
    userNeeds: string[];
    userJourney: string;
  };
  businessModel: {
    monetization: string;
    pricingStrategy: string;
    revenueStreams: string[];
    marketSize: string;
  };
  strengths: string[];
  weaknesses: string[];
  opportunities: {
    marketGaps: string[];
    improvements: string[];
    inspirations: string[];
  };
  fiveDimensionalScores?: {
    demand_score: number;
    pain_score: number;
    pay_score: number;
    build_fit_score: number;
    competition_risk_score: number;
  };
  evidenceFramework?: {
    help_seeking: { signals: string[]; strength: string; examples: string[] };
    alternative_seeking: { signals: string[]; strength: string; examples: string[] };
    complaints: { signals: string[]; strength: string; examples: string[] };
    transaction_intent: { signals: string[]; strength: string; examples: string[] };
    coverage_summary: string;
  };
  counterEvidence?: {
    failure_reasons: string[];
    kill_criteria: string[];
    counter_arguments: string[];
    validation_plan: {
      next_steps: string[];
      critical_assumptions: string[];
      timeline: string;
    };
  };
  verificationStatus?: {
    status: string;
    reasoning: string;
    confidence_level: number;
    evidence_gaps: string[];
  };
  overallRating: number;
  summary: string;
}

interface ResearchRecord {
  id: number;
  url: string;
  domain: string;
  title: string;
  status: string;
  createdAt: string;
}

interface ResearchDetail extends ResearchRecord {
  aiAnalysis: SiteAnalysis | null;
  errorMessage: string | null;
}

export default function ResearchPage() {
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [history, setHistory] = useState<ResearchRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeResearch, setActiveResearch] = useState<ResearchDetail | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/site-research');
      const data = await res.json();
      setHistory(data.researches || []);
    } catch {
      console.error('Failed to fetch research history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || analyzing) return;

    setAnalyzing(true);
    setActiveResearch(null);
    toast.loading('正在抓取并分析网站（约 30-60 秒）...', { id: 'research' });

    try {
      const res = await fetch('/api/site-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.analysis) {
        toast.success('分析完成！', { id: 'research' });
        // Fetch full detail
        const detailRes = await fetch(`/api/site-research/${data.id}`);
        const detail = await detailRes.json();
        setActiveResearch(detail);
        setUrl('');
        fetchHistory();
      } else {
        toast.error(data.error || '分析失败', { id: 'research' });
      }
    } catch {
      toast.error('请求失败，请检查网络连接', { id: 'research' });
    } finally {
      setAnalyzing(false);
    }
  };

  const loadResearch = async (id: number) => {
    try {
      const res = await fetch(`/api/site-research/${id}`);
      const data = await res.json();
      setActiveResearch(data);
    } catch {
      toast.error('加载调研详情失败');
    }
  };

  const analysis = activeResearch?.aiAnalysis;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">网站调研</h1>
        <p className="text-slate-600">输入网址，AI 自动分析网站的产品设计、用户画像、优劣势</p>
      </div>

      {/* URL Input */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="输入网址，如 notion.so、linear.app、stripe.com"
                className="pl-10"
                disabled={analyzing}
              />
            </div>
            <Button type="submit" disabled={analyzing || !url.trim()} size="lg">
              {analyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  分析中...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  开始分析
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && activeResearch && (
        <div className="space-y-6 mb-8">
          {/* Header Card */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200">
            <CardContent className="p-8">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-slate-900">{analysis.overview.name}</h2>
                    <Badge variant="blue">{analysis.overview.category}</Badge>
                    <Badge variant={analysis.overallRating >= 7 ? 'green' : analysis.overallRating >= 5 ? 'yellow' : 'red'}>
                      {analysis.overallRating}/10
                    </Badge>
                  </div>
                  <p className="text-lg text-slate-700 mb-3">{analysis.overview.oneLiner}</p>
                  <p className="text-slate-600">{analysis.summary}</p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">核心价值</p>
                  <p className="text-slate-800 font-medium">{analysis.overview.coreValue}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">解决的问题</p>
                  <p className="text-slate-800 font-medium">{analysis.overview.problemSolved}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Verification Status Banner */}
          {analysis.verificationStatus && (
            <Card className={`border-2 ${
              analysis.verificationStatus.status === 'validated' ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300' :
              analysis.verificationStatus.status === 'conditional' ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300' :
              analysis.verificationStatus.status === 'needs_evidence' ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-300' :
              'bg-gradient-to-r from-red-50 to-rose-50 border-red-300'
            }`}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${
                    analysis.verificationStatus.status === 'validated' ? 'bg-green-500' :
                    analysis.verificationStatus.status === 'conditional' ? 'bg-yellow-500' :
                    analysis.verificationStatus.status === 'needs_evidence' ? 'bg-blue-500' : 'bg-red-500'
                  }`}>
                    {analysis.verificationStatus.status === 'validated' && <CheckCircle className="w-7 h-7 text-white" />}
                    {analysis.verificationStatus.status === 'conditional' && <AlertTriangle className="w-7 h-7 text-white" />}
                    {analysis.verificationStatus.status === 'needs_evidence' && <FileSearch className="w-7 h-7 text-white" />}
                    {analysis.verificationStatus.status === 'skip' && <XCircle className="w-7 h-7 text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-slate-900">
                        {analysis.verificationStatus.status === 'validated' && 'PASS - 通过验证'}
                        {analysis.verificationStatus.status === 'conditional' && 'CONDITIONAL - 有条件通过'}
                        {analysis.verificationStatus.status === 'needs_evidence' && 'PENDING - 待补关键证据'}
                        {analysis.verificationStatus.status === 'skip' && 'SKIP - 建议放弃'}
                      </h3>
                      <Badge variant={
                        analysis.verificationStatus.status === 'validated' ? 'green' :
                        analysis.verificationStatus.status === 'conditional' ? 'yellow' :
                        analysis.verificationStatus.status === 'needs_evidence' ? 'blue' : 'red'
                      }>
                        {analysis.verificationStatus.confidence_level}%
                      </Badge>
                    </div>
                    <p className="text-slate-700 text-sm">{analysis.verificationStatus.reasoning}</p>
                    {analysis.verificationStatus.evidence_gaps.length > 0 && (
                      <div className="mt-3 p-3 bg-white/60 rounded-lg border border-slate-200">
                        <p className="text-xs font-semibold text-slate-600 mb-1">证据缺口：</p>
                        <ul className="space-y-1">
                          {analysis.verificationStatus.evidence_gaps.map((gap, i) => (
                            <li key={i} className="text-xs text-slate-600 flex items-start">
                              <span className="mr-1.5">-</span>{gap}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Five-Dimensional Market Validation Scores */}
          {analysis.fiveDimensionalScores && (
            <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  五维市场验证评分
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="grid grid-cols-5 gap-3">
                    {[
                      { key: 'demand_score' as const, label: '需求强度', color: 'from-blue-500 to-blue-600' },
                      { key: 'pain_score' as const, label: '痛点强度', color: 'from-red-500 to-red-600' },
                      { key: 'pay_score' as const, label: '付费意愿', color: 'from-green-500 to-green-600' },
                      { key: 'build_fit_score' as const, label: '开发可行性', color: 'from-amber-500 to-amber-600' },
                      { key: 'competition_risk_score' as const, label: '竞争风险', color: 'from-purple-500 to-purple-600' },
                    ].map(({ key, label, color }) => (
                      <div key={key} className="text-center">
                        <div className={`w-16 h-16 mx-auto mb-2 rounded-full bg-gradient-to-br ${color} flex items-center justify-center`}>
                          <span className="text-xl font-bold text-white">
                            {analysis.fiveDimensionalScores![key].toFixed(1)}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-700">{label}</p>
                      </div>
                    ))}
                  </div>
                  <FiveDimRadar scores={analysis.fiveDimensionalScores} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Four-Route Evidence Framework */}
          {analysis.evidenceFramework && (
            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-blue-600" />
                  四路证据框架
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'help_seeking' as const, label: '求助信号', bg: 'bg-blue-50/50', dot: 'text-blue-500' },
                    { key: 'alternative_seeking' as const, label: '替代信号', bg: 'bg-purple-50/50', dot: 'text-purple-500' },
                    { key: 'complaints' as const, label: '吐槽信号', bg: 'bg-red-50/50', dot: 'text-red-500' },
                    { key: 'transaction_intent' as const, label: '交易信号', bg: 'bg-green-50/50', dot: 'text-green-500' },
                  ].map(({ key, label, bg, dot }) => {
                    const route = analysis.evidenceFramework![key];
                    return (
                      <div key={key} className={`border rounded-lg p-4 ${bg}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-slate-800 text-sm">{label}</h4>
                          <Badge variant={
                            route.strength === 'strong' ? 'green' :
                            route.strength === 'moderate' ? 'yellow' :
                            route.strength === 'weak' ? 'red' : 'secondary'
                          }>
                            {route.strength === 'strong' ? '强' : route.strength === 'moderate' ? '中' : route.strength === 'weak' ? '弱' : '无'}
                          </Badge>
                        </div>
                        <ul className="space-y-1.5 mb-3">
                          {route.signals.map((s, i) => (
                            <li key={i} className="text-xs text-slate-700 flex items-start">
                              <span className={`mr-1.5 ${dot}`}>*</span>{s}
                            </li>
                          ))}
                        </ul>
                        {route.examples.length > 0 && (
                          <div className="border-t pt-2">
                            <p className="text-xs text-slate-500 mb-1">例子:</p>
                            {route.examples.map((ex, i) => (
                              <p key={i} className="text-xs text-slate-600 italic mb-0.5">&ldquo;{ex}&rdquo;</p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">覆盖度总结：</span>
                    {analysis.evidenceFramework.coverage_summary}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Product Design + User Persona */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  产品设计分析
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500 mb-2">核心功能</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.productDesign.coreFeatures.map((f, i) => (
                      <Badge key={i} variant="secondary">{f}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">用户流程</p>
                  <p className="text-slate-700 text-sm">{analysis.productDesign.userFlow}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-2">推测技术栈</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.productDesign.techStackGuess.map((t, i) => (
                      <Badge key={i} variant="outline">{t}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">设计风格</p>
                  <p className="text-slate-700 text-sm">{analysis.productDesign.designStyle}</p>
                </div>
                {analysis.productDesign.highlights.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-500 mb-2">设计亮点</p>
                    <ul className="space-y-1">
                      {analysis.productDesign.highlights.map((h, i) => (
                        <li key={i} className="text-sm text-slate-700 flex items-start">
                          <Star className="w-3.5 h-3.5 text-amber-500 mr-2 mt-0.5 shrink-0" />
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  用户画像
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">主要用户</p>
                    <p className="text-slate-800 font-medium text-sm">{analysis.userPersona.primaryAudience}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">次要用户</p>
                    <p className="text-slate-800 font-medium text-sm">{analysis.userPersona.secondaryAudience}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-2">使用场景</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.userPersona.useCases.map((u, i) => (
                      <Badge key={i} variant="secondary">{u}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-2">核心需求</p>
                  <ul className="space-y-1">
                    {analysis.userPersona.userNeeds.map((n, i) => (
                      <li key={i} className="text-sm text-slate-700 flex items-start">
                        <ArrowRight className="w-3.5 h-3.5 text-blue-500 mr-2 mt-0.5 shrink-0" />
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">用户旅程</p>
                  <p className="text-slate-700 text-sm">{analysis.userPersona.userJourney}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Business Model */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                商业模式
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-slate-500 mb-1">变现方式</p>
                  <p className="text-slate-800 font-medium">{analysis.businessModel.monetization}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">定价策略</p>
                  <p className="text-slate-800 font-medium">{analysis.businessModel.pricingStrategy}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">收入来源</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.businessModel.revenueStreams.map((r, i) => (
                      <Badge key={i} variant="outline">{r}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">市场规模</p>
                  <p className="text-slate-800 font-medium">{analysis.businessModel.marketSize}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Strengths + Weaknesses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="w-5 h-5" />
                  优势分析
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {analysis.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-start">
                      <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold mr-3 shrink-0">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <ShieldAlert className="w-5 h-5" />
                  劣势分析
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {analysis.weaknesses.map((w, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-start">
                      <span className="w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-bold mr-3 shrink-0">{i + 1}</span>
                      {w}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Counter-Evidence & Kill Criteria */}
          {analysis.counterEvidence && (
            <Card className="border-orange-200 bg-orange-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700">
                  <AlertTriangle className="w-5 h-5" />
                  反证与终止标准
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <h4 className="font-semibold text-slate-800 mb-2 text-sm flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-red-600" />
                    为什么可能失败
                  </h4>
                  <ul className="space-y-2">
                    {analysis.counterEvidence.failure_reasons.map((reason, i) => (
                      <li key={i} className="text-sm text-slate-700 flex items-start">
                        <span className="w-5 h-5 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-bold mr-2 shrink-0">{i + 1}</span>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-slate-800 mb-2 text-sm flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-orange-600" />
                    终止标准 (Kill Criteria)
                  </h4>
                  <div className="space-y-2">
                    {analysis.counterEvidence.kill_criteria.map((criterion, i) => (
                      <div key={i} className="flex items-start p-2.5 bg-white rounded-lg border border-orange-200">
                        <Badge variant="red" className="mr-2 mt-0.5 shrink-0 text-xs">STOP</Badge>
                        <p className="text-sm text-slate-700 flex-1">{criterion}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-slate-800 mb-2 text-sm flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    反驳论据
                  </h4>
                  <ul className="space-y-1.5">
                    {analysis.counterEvidence.counter_arguments.map((arg, i) => (
                      <li key={i} className="text-sm text-slate-700 flex items-start p-2 bg-yellow-50 rounded">
                        <span className="mr-2 text-yellow-600 shrink-0">!</span>
                        {arg}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-slate-800 mb-2 text-sm flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    验证计划
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-1.5">下一步行动：</p>
                      <ol className="space-y-1.5">
                        {analysis.counterEvidence.validation_plan.next_steps.map((step, i) => (
                          <li key={i} className="text-sm text-slate-700 flex items-start">
                            <span className="w-5 h-5 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold mr-2 shrink-0">{i + 1}</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-1.5">关键假设（需验证）：</p>
                      <ul className="space-y-1">
                        {analysis.counterEvidence.validation_plan.critical_assumptions.map((a, i) => (
                          <li key={i} className="text-xs text-slate-700 flex items-start">
                            <span className="mr-1.5 text-blue-500">-&gt;</span>{a}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-slate-700">
                        <span className="font-semibold text-blue-700">验证时间表：</span>
                        {analysis.counterEvidence.validation_plan.timeline}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Opportunities */}
          <Card className="border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700">
                <Lightbulb className="w-5 h-5" />
                市场机会与启发
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3">市场空白</p>
                  <ul className="space-y-2">
                    {analysis.opportunities.marketGaps.map((g, i) => (
                      <li key={i} className="text-sm text-slate-700 flex items-start">
                        <span className="mr-2 text-amber-600">-</span>{g}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3">改进方向</p>
                  <ul className="space-y-2">
                    {analysis.opportunities.improvements.map((im, i) => (
                      <li key={i} className="text-sm text-slate-700 flex items-start">
                        <span className="mr-2 text-amber-600">-</span>{im}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3">创业启发</p>
                  <ul className="space-y-2">
                    {analysis.opportunities.inspirations.map((ins, i) => (
                      <li key={i} className="text-sm text-slate-700 flex items-start">
                        <span className="mr-2 text-amber-600">-</span>{ins}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-600" />
            调研历史
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <LoadingState text="加载历史记录中..." />
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">暂无调研记录</p>
              <p className="text-sm text-slate-400 mt-1">输入一个网址开始你的第一次调研</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-3 cursor-pointer hover:bg-slate-50 px-3 -mx-3 rounded-lg transition-colors"
                  onClick={() => loadResearch(item.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                    ) : item.status === 'failed' ? (
                      <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                    ) : (
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {item.title || item.domain}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{item.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-slate-400">
                      {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
