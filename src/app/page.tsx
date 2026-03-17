'use client';

import { useEffect, useState } from 'react';
import { Lightbulb, Brain, Database, TrendingUp } from 'lucide-react';
import { StatCard } from '@/components/dashboard/stat-card';
import { RecentIdeas } from '@/components/dashboard/recent-ideas';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface Stats {
  totalIdeas: number;
  analyzedCount: number;
  unanalyzedCount: number;
  recentCount: number;
  sourcesOnline: string[];
}

interface Idea {
  id: string;
  title: string;
  finalScore: number;
  rankCategory: string;
  source: string;
  trendDirection?: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [topIdeas, setTopIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingV2, setAnalyzingV2] = useState(false);
  const [budget, setBudget] = useState<{
    today: { total: number; remaining: number };
    month: { total: number; remaining: number; byApi: Record<string, number> };
  } | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, ideasRes, budgetRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/ideas?page=1&limit=10&sort=finalScore&order=desc'),
        fetch('/api/budget').catch(() => null),
      ]);

      const statsData = await statsRes.json();
      const ideasData = await ideasRes.json();
      const budgetData = budgetRes ? await budgetRes.json() : null;

      setStats(statsData);
      setTopIdeas(ideasData?.ideas || []);
      if (budgetData) setBudget(budgetData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCollect = async () => {
    setCollecting(true);
    try {
      await fetch('/api/collect', { method: 'POST' });
      await fetchDashboardData();
    } catch (error) {
      console.error('Failed to collect data:', error);
    } finally {
      setCollecting(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'all' }),
      });
      await fetchDashboardData();
    } catch (error) {
      console.error('Failed to analyze:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">加载仪表盘中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">仪表盘</h1>
        <p className="text-slate-600">监控产品创意发现与分析流程</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Lightbulb}
          title="创意总数"
          value={stats?.totalIdeas || 0}
        />
        <StatCard
          icon={Brain}
          title="已分析"
          value={stats?.analyzedCount || 0}
        />
        <StatCard
          icon={Database}
          title="在线数据源"
          value={stats?.sourcesOnline?.length || 0}
        />
        <StatCard
          icon={TrendingUp}
          title="本周新增"
          value={stats?.recentCount || 0}
          change={`本周 +${stats?.recentCount || 0}`}
        />
      </div>

      {/* Quick Actions */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>快捷操作</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={handleCollect}
              disabled={collecting}
            >
              {collecting ? '采集中...' : '采集数据'}
            </Button>
            <Button
              variant="secondary"
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing ? '分析中...' : 'V1 分析'}
            </Button>
            <Button
              variant="default"
              onClick={async () => {
                setAnalyzingV2(true);
                try {
                  await fetch('/api/analyze-v2', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: 'batch', limit: 5 }),
                  });
                  await fetchDashboardData();
                } catch (e) {
                  console.error('V2 analysis failed:', e);
                } finally {
                  setAnalyzingV2(false);
                }
              }}
              disabled={analyzingV2}
            >
              {analyzingV2 ? 'V2 分析中...' : 'V2 深度分析'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Budget Overview */}
      {budget && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>API 成本概览</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-slate-600">今日消耗</p>
                <p className="text-2xl font-bold text-slate-900">
                  ${budget.today.total.toFixed(2)}
                </p>
                <p className="text-xs text-slate-500">
                  剩余 ${budget.today.remaining.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">本月消耗</p>
                <p className="text-2xl font-bold text-slate-900">
                  ${budget.month.total.toFixed(2)}
                </p>
                <p className="text-xs text-slate-500">
                  剩余 ${budget.month.remaining.toFixed(2)}
                </p>
              </div>
              {Object.entries(budget.month.byApi).map(([api, cost]) => (
                <div key={api}>
                  <p className="text-sm text-slate-600">{api}</p>
                  <p className="text-lg font-medium text-slate-700">
                    ${(cost as number).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Top Ideas */}
      {topIdeas.length > 0 && <RecentIdeas ideas={topIdeas} />}
    </div>
  );
}
