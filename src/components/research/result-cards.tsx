'use client';

import {
  CheckCircle, XCircle, AlertTriangle, FileSearch,
  Search, Zap, Users, Star, ArrowRight, TrendingUp,
  ShieldAlert, Lightbulb, Target, Layers, UserCircle,
  Rocket, ShieldCheck, Puzzle, Code, BarChart3,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FiveDimRadar } from '@/components/charts/five-dim-radar';
import { ScoreRing } from './score-ring';
import { SectionHeader } from './section-header';
import { StrengthBar } from './strength-bar';
import type { SiteAnalysis } from './types';

/* ── Verification Banner ── */
export function VerificationBanner({ v }: { v: NonNullable<SiteAnalysis['verificationStatus']> }) {
  const cfg: Record<string, { bg: string; border: string; icon: React.ReactNode; title: string; accent: string }> = {
    validated: { bg: 'from-emerald-50/80 to-teal-50/60', border: 'border-emerald-200', icon: <CheckCircle className="w-5 h-5" />, title: 'PASS - 通过验证', accent: '#059669' },
    conditional: { bg: 'from-amber-50/80 to-yellow-50/60', border: 'border-amber-200', icon: <AlertTriangle className="w-5 h-5" />, title: 'CONDITIONAL - 有条件通过', accent: '#d97706' },
    needs_evidence: { bg: 'from-sky-50/80 to-blue-50/60', border: 'border-sky-200', icon: <FileSearch className="w-5 h-5" />, title: 'PENDING - 待补关键证据', accent: '#0284c7' },
    skip: { bg: 'from-rose-50/80 to-red-50/60', border: 'border-rose-200', icon: <XCircle className="w-5 h-5" />, title: 'SKIP - 建议放弃', accent: '#dc2626' },
  };
  const c = cfg[v.status] || cfg.skip;

  return (
    <div className={`anim-enter anim-delay-2 rounded-xl border ${c.border} bg-gradient-to-r ${c.bg} p-5`}>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${c.accent}18`, color: c.accent }}>
          {c.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="font-sora text-sm font-bold text-slate-900">{c.title}</h3>
            <span className="font-mono-data text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${c.accent}18`, color: c.accent }}>
              {v.confidence_level}%
            </span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{v.reasoning}</p>
          {v.evidence_gaps.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {v.evidence_gaps.map((gap, i) => (
                <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-white/80 text-slate-600 border border-slate-200">
                  {gap}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Five Dimensional Scores ── */
export function FiveDimScores({ scores }: { scores: NonNullable<SiteAnalysis['fiveDimensionalScores']> }) {
  const dims = [
    { key: 'demand_score' as const, label: '需求强度', color: '#0ea5e9' },
    { key: 'pain_score' as const, label: '痛点强度', color: '#ef4444' },
    { key: 'pay_score' as const, label: '付费意愿', color: '#22c55e' },
    { key: 'build_fit_score' as const, label: '开发可行性', color: '#f59e0b' },
    { key: 'competition_risk_score' as const, label: '竞争风险', color: '#8b5cf6' },
  ];

  return (
    <div className="anim-enter anim-delay-3 rounded-xl border border-slate-200 bg-white p-6">
      <SectionHeader icon={<Target className="w-4 h-4" />} title="五维市场验证" subtitle="综合评分体系" accentColor="#8b5cf6" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
        <div className="flex justify-around">
          {dims.map((d, i) => (
            <ScoreRing key={d.key} score={scores[d.key]} label={d.label} color={d.color} delay={i * 100} />
          ))}
        </div>
        <div className="flex justify-center">
          <FiveDimRadar scores={scores} />
        </div>
      </div>
    </div>
  );
}

/* ── Evidence Framework ── */
export function EvidenceFramework({ ef }: { ef: NonNullable<SiteAnalysis['evidenceFramework']> }) {
  const routes = [
    { key: 'help_seeking' as const, label: '求助信号', icon: <Search className="w-3.5 h-3.5" />, accent: '#0ea5e9' },
    { key: 'alternative_seeking' as const, label: '替代信号', icon: <Layers className="w-3.5 h-3.5" />, accent: '#8b5cf6' },
    { key: 'complaints' as const, label: '吐槽信号', icon: <ShieldAlert className="w-3.5 h-3.5" />, accent: '#ef4444' },
    { key: 'transaction_intent' as const, label: '交易信号', icon: <TrendingUp className="w-3.5 h-3.5" />, accent: '#22c55e' },
  ];

  return (
    <div className="anim-enter anim-delay-4 rounded-xl border border-slate-200 bg-white p-6">
      <SectionHeader icon={<Search className="w-4 h-4" />} title="四路证据框架" accentColor="#0ea5e9" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {routes.map(({ key, label, icon, accent }) => {
          const route = ef[key];
          return (
            <div key={key} className="rounded-lg border border-slate-100 p-4 hover:border-slate-200 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span style={{ color: accent }}>{icon}</span>
                <h4 className="text-sm font-semibold text-slate-800">{label}</h4>
              </div>
              <StrengthBar level={route.strength} />
              <ul className="mt-3 space-y-1">
                {route.signals.slice(0, 3).map((s, i) => (
                  <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                    <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: accent }} />
                    {s}
                  </li>
                ))}
              </ul>
              {route.examples.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  {route.examples.slice(0, 2).map((ex, i) => (
                    <p key={i} className="text-[11px] text-slate-500 italic leading-relaxed">&ldquo;{ex}&rdquo;</p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 px-4 py-2.5 bg-slate-50 rounded-lg">
        <p className="text-xs text-slate-600"><span className="font-semibold text-slate-700">覆盖度：</span>{ef.coverage_summary}</p>
      </div>
    </div>
  );
}

/* ── Product Design Card ── */
export function ProductDesignCard({ pd }: { pd: SiteAnalysis['productDesign'] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <SectionHeader icon={<Zap className="w-4 h-4" />} title="产品设计分析" accentColor="#0ea5e9" />
      <div className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">核心功能</p>
          <div className="flex flex-wrap gap-1.5">
            {pd.coreFeatures.map((f, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-100">{f}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">用户流程</p>
          <p className="text-sm text-slate-700 leading-relaxed">{pd.userFlow}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">技术栈</p>
          <div className="flex flex-wrap gap-1.5">
            {pd.techStackGuess.map((t, i) => (
              <span key={i} className="font-mono-data text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">{t}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">设计风格</p>
          <p className="text-sm text-slate-700">{pd.designStyle}</p>
        </div>
        {pd.highlights.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">设计亮点</p>
            {pd.highlights.map((h, i) => (
              <div key={i} className="flex items-start gap-2 mb-1.5">
                <Star className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-slate-700">{h}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── User Persona Card ── */
export function UserPersonaCard({ up }: { up: SiteAnalysis['userPersona'] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <SectionHeader icon={<Users className="w-4 h-4" />} title="用户画像" accentColor="#8b5cf6" />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-violet-50/50 border border-violet-100">
            <p className="text-[10px] uppercase tracking-wider text-violet-400 font-semibold mb-1">主要用户</p>
            <p className="text-sm text-slate-800 font-medium">{up.primaryAudience}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">次要用户</p>
            <p className="text-sm text-slate-800 font-medium">{up.secondaryAudience}</p>
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">使用场景</p>
          <div className="flex flex-wrap gap-1.5">
            {up.useCases.map((u, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-100">{u}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">核心需求</p>
          {up.userNeeds.map((n, i) => (
            <div key={i} className="flex items-start gap-2 mb-1.5">
              <ArrowRight className="w-3 h-3 text-violet-500 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-700">{n}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">用户旅程</p>
          <p className="text-sm text-slate-600 leading-relaxed">{up.userJourney}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Business Model Card ── */
export function BusinessModelCard({ bm }: { bm: SiteAnalysis['businessModel'] }) {
  return (
    <div className="anim-enter anim-delay-6 rounded-xl border border-slate-200 bg-white p-6">
      <SectionHeader icon={<BarChart3 className="w-4 h-4" />} title="商业模式" accentColor="#d97706" />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">变现模式</p>
          <p className="text-sm text-slate-800 font-medium">{bm.monetization}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">定价策略</p>
          <p className="text-sm text-slate-800 font-medium">{bm.pricingStrategy}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">市场规模</p>
          <p className="text-sm text-slate-800 font-medium">{bm.marketSize}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">收入来源</p>
          <div className="flex flex-wrap gap-1.5">
            {bm.revenueStreams.map((r, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">{r}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Strengths & Weaknesses ── */
export function StrengthsWeaknesses({ strengths, weaknesses }: { strengths: string[]; weaknesses: string[] }) {
  return (
    <div className="anim-enter anim-delay-7 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <h3 className="font-sora text-sm font-semibold text-slate-900">核心优势</h3>
        </div>
        <div className="space-y-2">
          {strengths.map((s, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="font-mono-data text-[10px] font-bold text-emerald-500 mt-0.5 w-4 shrink-0">{String(i + 1).padStart(2, '0')}</span>
              <p className="text-sm text-slate-700 leading-relaxed">{s}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-rose-100 bg-gradient-to-br from-white to-rose-50/30 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <h3 className="font-sora text-sm font-semibold text-slate-900">潜在弱点</h3>
        </div>
        <div className="space-y-2">
          {weaknesses.map((w, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="font-mono-data text-[10px] font-bold text-rose-400 mt-0.5 w-4 shrink-0">{String(i + 1).padStart(2, '0')}</span>
              <p className="text-sm text-slate-700 leading-relaxed">{w}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Counter Evidence ── */
export function CounterEvidence({ ce }: { ce: NonNullable<SiteAnalysis['counterEvidence']> }) {
  return (
    <div className="anim-enter anim-delay-7 rounded-xl border border-slate-200 bg-white p-6">
      <SectionHeader icon={<AlertTriangle className="w-4 h-4" />} title="反面证据 & Kill Criteria" accentColor="#dc2626" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-red-400 font-semibold mb-2">失败风险</p>
          {ce.failure_reasons.map((r, i) => (
            <div key={i} className="flex items-start gap-2 mb-1.5">
              <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-700">{r}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-red-400 font-semibold mb-2">Kill Criteria</p>
          {ce.kill_criteria.map((k, i) => (
            <div key={i} className="flex items-start gap-2 mb-1.5">
              <ShieldAlert className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-700">{k}</p>
            </div>
          ))}
        </div>
      </div>
      {ce.counter_arguments.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">反面论据</p>
          <div className="flex flex-wrap gap-1.5">
            {ce.counter_arguments.map((a, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100">{a}</span>
            ))}
          </div>
        </div>
      )}
      {ce.validation_plan && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">验证计划</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-slate-50">
              <p className="text-[10px] uppercase text-slate-400 font-semibold mb-1">下一步</p>
              {ce.validation_plan.next_steps.map((s, i) => <p key={i} className="text-xs text-slate-600 mb-0.5">{s}</p>)}
            </div>
            <div className="p-3 rounded-lg bg-slate-50">
              <p className="text-[10px] uppercase text-slate-400 font-semibold mb-1">关键假设</p>
              {ce.validation_plan.critical_assumptions.map((a, i) => <p key={i} className="text-xs text-slate-600 mb-0.5">{a}</p>)}
            </div>
            <div className="p-3 rounded-lg bg-slate-50">
              <p className="text-[10px] uppercase text-slate-400 font-semibold mb-1">时间线</p>
              <p className="text-xs text-slate-600">{ce.validation_plan.timeline}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Opportunities ── */
export function OpportunitiesCard({ opp }: { opp: SiteAnalysis['opportunities'] }) {
  return (
    <div className="anim-enter anim-delay-8 rounded-xl border border-slate-200 bg-white p-6">
      <SectionHeader icon={<Lightbulb className="w-4 h-4" />} title="机会洞察" accentColor="#22c55e" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold mb-2">市场空白</p>
          {opp.marketGaps.map((g, i) => (
            <div key={i} className="flex items-start gap-2 mb-1.5">
              <Target className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-700">{g}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-teal-400 font-semibold mb-2">改进方向</p>
          {opp.improvements.map((imp, i) => (
            <div key={i} className="flex items-start gap-2 mb-1.5">
              <ArrowRight className="w-3 h-3 text-teal-500 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-700">{imp}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-cyan-400 font-semibold mb-2">灵感启发</p>
          {opp.inspirations.map((ins, i) => (
            <div key={i} className="flex items-start gap-2 mb-1.5">
              <Lightbulb className="w-3 h-3 text-cyan-500 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-700">{ins}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Feature Matrix ── */
export function FeatureMatrixCard({ fm }: { fm: NonNullable<SiteAnalysis['featureMatrix']> }) {
  const qualityColors: Record<string, string> = {
    excellent: '#059669', good: '#0ea5e9', average: '#d97706', poor: '#dc2626',
  };
  const tierColors: Record<string, string> = {
    free: '#64748b', basic: '#0ea5e9', pro: '#8b5cf6', enterprise: '#d97706',
  };

  return (
    <div className="anim-enter anim-delay-8 rounded-xl border border-slate-200 bg-white p-6">
      <SectionHeader icon={<Layers className="w-4 h-4" />} title="功能矩阵" accentColor="#0ea5e9" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 pr-4 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">功能</th>
              <th className="text-left py-2 pr-4 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">描述</th>
              <th className="text-center py-2 pr-4 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">层级</th>
              <th className="text-center py-2 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">质量</th>
            </tr>
          </thead>
          <tbody>
            {fm.core.map((f, i) => (
              <tr key={i} className="border-b border-slate-50 last:border-0">
                <td className="py-2 pr-4 font-medium text-slate-800">{f.name}</td>
                <td className="py-2 pr-4 text-slate-600 text-xs">{f.description}</td>
                <td className="py-2 pr-4 text-center">
                  <span className="font-mono-data text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: `${tierColors[f.tier.toLowerCase()] || '#64748b'}14`, color: tierColors[f.tier.toLowerCase()] || '#64748b' }}>
                    {f.tier}
                  </span>
                </td>
                <td className="py-2 text-center">
                  <span className="font-mono-data text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: `${qualityColors[f.quality.toLowerCase()] || '#64748b'}14`, color: qualityColors[f.quality.toLowerCase()] || '#64748b' }}>
                    {f.quality}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {fm.unique.length > 0 && (
          <div className="p-3 rounded-lg bg-sky-50/50 border border-sky-100">
            <p className="text-[10px] uppercase tracking-wider text-sky-400 font-semibold mb-1.5">独特功能</p>
            {fm.unique.map((u, i) => <p key={i} className="text-xs text-slate-700 mb-0.5">{u}</p>)}
          </div>
        )}
        {fm.integrations.length > 0 && (
          <div className="p-3 rounded-lg bg-violet-50/50 border border-violet-100">
            <p className="text-[10px] uppercase tracking-wider text-violet-400 font-semibold mb-1.5">集成</p>
            {fm.integrations.map((intg, i) => <p key={i} className="text-xs text-slate-700 mb-0.5">{intg}</p>)}
          </div>
        )}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">API</p>
          <p className="text-xs text-slate-700">{fm.apiAvailability}</p>
        </div>
        {fm.featureGaps.length > 0 && (
          <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-100">
            <p className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold mb-1.5">功能缺口</p>
            {fm.featureGaps.map((g, i) => <p key={i} className="text-xs text-slate-700 mb-0.5">{g}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── User Scenarios ── */
export function UserScenariosCard({ us }: { us: NonNullable<SiteAnalysis['userScenarios']> }) {
  const personaColors = ['#8b5cf6', '#0ea5e9', '#d97706', '#059669'];
  return (
    <div className="anim-enter anim-delay-8 rounded-xl border border-slate-200 bg-white p-6">
      <SectionHeader icon={<UserCircle className="w-4 h-4" />} title="用户场景分析" accentColor="#8b5cf6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {us.personas.map((p, i) => {
          const color = personaColors[i % personaColors.length];
          return (
            <div key={i} className="rounded-lg border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: color }}>
                  {p.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                  <p className="text-[11px] text-slate-500">{p.role}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">目标</p>
                  {p.goals.map((g, j) => <p key={j} className="text-xs text-slate-600 mb-0.5">- {g}</p>)}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">痛点</p>
                  {p.painPoints.map((pp, j) => <p key={j} className="text-xs text-red-600 mb-0.5">- {pp}</p>)}
                </div>
                {p.delightMoments.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">愉悦时刻</p>
                    {p.delightMoments.map((d, j) => <p key={j} className="text-xs text-emerald-600 mb-0.5">- {d}</p>)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {us.jobsToBeDone.length > 0 && (
        <div className="p-4 rounded-lg bg-violet-50/50 border border-violet-100">
          <p className="text-[11px] uppercase tracking-wider text-violet-400 font-semibold mb-2">Jobs-to-be-Done</p>
          <div className="flex flex-wrap gap-1.5">
            {us.jobsToBeDone.map((j, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-white text-violet-700 border border-violet-200">{j}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Build Recommendations ── */
export function BuildRecommendationsCard({ br }: { br: NonNullable<SiteAnalysis['buildRecommendations']> }) {
  const sections = [
    { title: '可借鉴', items: br.lessonsToLearn, icon: <Lightbulb className="w-3 h-3" />, color: '#d97706' },
    { title: '可利用的空白', items: br.gapsToExploit, icon: <Target className="w-3 h-3" />, color: '#059669' },
    { title: 'MVP 功能', items: br.mvpFeatures, icon: <Rocket className="w-3 h-3" />, color: '#8b5cf6' },
    { title: '技术建议', items: br.techRecommendations, icon: <Code className="w-3 h-3" />, color: '#0ea5e9' },
    { title: 'GTM 策略', items: br.goToMarket, icon: <TrendingUp className="w-3 h-3" />, color: '#ef4444' },
  ];

  return (
    <div className="anim-enter anim-delay-8 rounded-xl border border-slate-200 bg-white p-6">
      <SectionHeader icon={<Rocket className="w-4 h-4" />} title="构建建议" accentColor="#059669" />
      {br.differentiationStrategy && (
        <div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-emerald-50/60 to-teal-50/40 border border-emerald-100">
          <p className="text-[11px] uppercase tracking-wider text-emerald-500 font-semibold mb-1">差异化策略</p>
          <p className="text-sm text-slate-800 font-medium leading-relaxed">{br.differentiationStrategy}</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sections.map(({ title, items, icon, color }) => items.length > 0 && (
          <div key={title} className="p-3 rounded-lg border border-slate-100">
            <div className="flex items-center gap-1.5 mb-2">
              <span style={{ color }}>{icon}</span>
              <p className="text-[11px] uppercase tracking-wider font-semibold" style={{ color }}>{title}</p>
            </div>
            {items.map((item, i) => <p key={i} className="text-xs text-slate-600 mb-1">- {item}</p>)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Confidence Assessment ── */
export function ConfidenceCard({ ca }: { ca: NonNullable<SiteAnalysis['confidenceAssessment']> }) {
  return (
    <div className="anim-enter anim-delay-8 rounded-xl border border-slate-200 bg-white p-6">
      <SectionHeader icon={<ShieldCheck className="w-4 h-4" />} title="置信度评估" accentColor="#059669" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-100">
          <p className="text-[11px] uppercase tracking-wider text-emerald-500 font-semibold mb-2">高置信度</p>
          {ca.highConfidence.map((h, i) => (
            <div key={i} className="flex items-start gap-2 mb-1.5">
              <CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-700">{h}</p>
            </div>
          ))}
        </div>
        <div className="p-4 rounded-lg bg-amber-50/50 border border-amber-100">
          <p className="text-[11px] uppercase tracking-wider text-amber-500 font-semibold mb-2">需要验证</p>
          {ca.needsVerification.map((n, i) => (
            <div key={i} className="flex items-start gap-2 mb-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-700">{n}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
