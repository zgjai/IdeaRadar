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

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, ideasRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/ideas?page=1&limit=10&sort=finalScore&order=desc'),
      ]);

      const statsData = await statsRes.json();
      const ideasData = await ideasRes.json();

      setStats(statsData);
      setTopIdeas(ideasData?.ideas || []);
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
          <p className="text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Dashboard</h1>
        <p className="text-slate-600">Monitor your product idea discovery pipeline</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Lightbulb}
          title="Total Ideas"
          value={stats?.totalIdeas || 0}
        />
        <StatCard
          icon={Brain}
          title="Analyzed"
          value={stats?.analyzedCount || 0}
        />
        <StatCard
          icon={Database}
          title="Sources Online"
          value={stats?.sourcesOnline?.length || 0}
        />
        <StatCard
          icon={TrendingUp}
          title="New This Week"
          value={stats?.recentCount || 0}
          change={`+${stats?.recentCount || 0} this week`}
        />
      </div>

      {/* Quick Actions */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={handleCollect}
              disabled={collecting}
            >
              {collecting ? 'Collecting...' : 'Collect Data'}
            </Button>
            <Button
              variant="secondary"
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing ? 'Analyzing...' : 'Run Analysis'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Top Ideas */}
      {topIdeas.length > 0 && <RecentIdeas ideas={topIdeas} />}
    </div>
  );
}
