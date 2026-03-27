'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Globe, Search, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/spinner';
import type { SiteAnalysis, ResearchRecord, ResearchDetail } from '@/components/research/types';
import {
  VerificationBanner,
  FiveDimScores,
  EvidenceFramework,
  ProductDesignCard,
  UserPersonaCard,
  BusinessModelCard,
  StrengthsWeaknesses,
  CounterEvidence,
  OpportunitiesCard,
  FeatureMatrixCard,
  UserScenariosCard,
  BuildRecommendationsCard,
  ConfidenceCard,
} from '@/components/research/result-cards';

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
    <div className="font-sora min-h-screen">
      {/* ── Hero Search Section ── */}
      <div className="relative overflow-hidden noise-bg bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 px-8 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(14,165,233,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(139,92,246,0.06),transparent_50%)]" />
        <div className="relative z-10 max-w-3xl">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
            网站调研
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            输入网址，AI 自动分析产品设计、用户画像、商业模式与竞争优劣势
          </p>
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="flex-1 relative">
              <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="notion.so, linear.app, stripe.com ..."
                className="pl-10 h-11 bg-white/10 border-white/10 text-white placeholder:text-slate-500 focus:bg-white/15 focus:border-teal-500/50 rounded-lg"
                disabled={analyzing}
              />
            </div>
            <Button
              type="submit"
              disabled={analyzing || !url.trim()}
              size="lg"
              className="h-11 px-6 bg-teal-600 hover:bg-teal-500 text-white border-0 rounded-lg font-semibold"
            >
              {analyzing ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  分析中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  开始分析
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* ── Results ── */}
      <div className="px-8 py-8">
        {analysis && activeResearch && (
          <div className="space-y-5 mb-10">
            {/* Header */}
            <div className="anim-enter anim-delay-1 rounded-xl border border-slate-200 bg-white p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-teal-50 to-transparent rounded-bl-full" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="font-sora text-xl font-bold text-slate-900 tracking-tight">{analysis.overview.name}</h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100 font-medium">
                    {analysis.overview.category}
                  </span>
                  <span className={`font-mono-data text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    analysis.overallRating >= 7 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    analysis.overallRating >= 5 ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                    'bg-red-50 text-red-700 border border-red-100'
                  }`}>
                    {analysis.overallRating}/10
                  </span>
                </div>
                <p className="text-base text-slate-700 mb-2 font-medium">{analysis.overview.oneLiner}</p>
                <p className="text-sm text-slate-500 leading-relaxed mb-5">{analysis.summary}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">核心价值</p>
                    <p className="text-sm text-slate-800 font-medium">{analysis.overview.coreValue}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">解决的问题</p>
                    <p className="text-sm text-slate-800 font-medium">{analysis.overview.problemSolved}</p>
                  </div>
                </div>
              </div>
            </div>

            {analysis.verificationStatus && <VerificationBanner v={analysis.verificationStatus} />}
            {analysis.fiveDimensionalScores && <FiveDimScores scores={analysis.fiveDimensionalScores} />}
            {analysis.evidenceFramework && <EvidenceFramework ef={analysis.evidenceFramework} />}

            {/* Product Design + User Persona */}
            <div className="anim-enter anim-delay-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ProductDesignCard pd={analysis.productDesign} />
              <UserPersonaCard up={analysis.userPersona} />
            </div>

            <BusinessModelCard bm={analysis.businessModel} />
            <StrengthsWeaknesses strengths={analysis.strengths} weaknesses={analysis.weaknesses} />
            {analysis.counterEvidence && <CounterEvidence ce={analysis.counterEvidence} />}
            <OpportunitiesCard opp={analysis.opportunities} />
            {analysis.featureMatrix && <FeatureMatrixCard fm={analysis.featureMatrix} />}
            {analysis.userScenarios && <UserScenariosCard us={analysis.userScenarios} />}
            {analysis.buildRecommendations && <BuildRecommendationsCard br={analysis.buildRecommendations} />}
            {analysis.confidenceAssessment && <ConfidenceCard ca={analysis.confidenceAssessment} />}
          </div>
        )}

        {/* ── History ── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-slate-400" />
            <h2 className="font-sora text-sm font-semibold text-slate-700 uppercase tracking-wider">调研历史</h2>
          </div>

          {loadingHistory ? (
            <LoadingState text="加载中..." />
          ) : history.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                <Globe className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">暂无调研记录</p>
              <p className="text-xs text-slate-400 mt-1">输入网址开始第一次调研</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => loadResearch(item.id)}
                  className={`group text-left p-4 rounded-xl border transition-all hover:shadow-md hover:border-teal-200 ${
                    activeResearch?.id === item.id
                      ? 'border-teal-300 bg-teal-50/30 shadow-sm'
                      : 'border-slate-150 bg-white hover:bg-teal-50/10'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-500 transition-colors" />
                    <span className="font-mono-data text-xs text-slate-500 truncate">{item.domain}</span>
                    <span className={`ml-auto w-1.5 h-1.5 rounded-full shrink-0 ${
                      item.status === 'completed' ? 'bg-emerald-400' :
                      item.status === 'failed' ? 'bg-red-400' : 'bg-amber-400'
                    }`} />
                  </div>
                  <p className="text-sm font-medium text-slate-800 truncate">{item.title || item.url}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {new Date(item.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
