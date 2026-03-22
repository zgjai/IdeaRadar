'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { TrendingUp, Search, Zap, ArrowRight, X, Plus, Loader2, ExternalLink, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TrendDiscovery {
  id: string;
  keyword: string;
  seedWord: string | null;
  source: string;
  growthRate: string | null;
  growthNumeric: number | null;
  searchVolume: number | null;
  difficulty: number | null;
  cpc: number | null;
  serpCompetition: string | null;
  validationStatus: string;
  ideaId: string | null;
  createdAt: string;
}

const DEFAULT_SEEDS = ['AI', 'SaaS', 'generator', 'maker', 'tool'];

export default function TrendsPage() {
  const [seeds, setSeeds] = useState<string[]>(DEFAULT_SEEDS);
  const [seedInput, setSeedInput] = useState('');
  const [geo, setGeo] = useState('');
  const [mining, setMining] = useState(false);
  const [trends, setTrends] = useState<TrendDiscovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState<string | null>(null);
  const [miningStats, setMiningStats] = useState<{
    totalRisingQueries: number;
    enriched: number;
    saved: number;
  } | null>(null);

  // Load existing trends on mount
  useEffect(() => {
    loadTrends();
    loadSeedSettings();
  }, []);

  async function loadSeedSettings() {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const savedSeeds = data.settings?.['trendMining.seedWords'];
        if (savedSeeds) {
          setSeeds(savedSeeds.split(',').map((s: string) => s.trim()).filter(Boolean));
        }
      }
    } catch { /* use defaults */ }
  }

  async function loadTrends() {
    try {
      const res = await fetch('/api/trend-mining?limit=100&sort=growth_numeric&order=desc');
      if (res.ok) {
        const data = await res.json();
        setTrends(data.trends || []);
      }
    } catch (error) {
      console.error('Failed to load trends:', error);
    } finally {
      setLoading(false);
    }
  }

  async function startMining() {
    if (seeds.length === 0) {
      toast.error('Please add at least one seed word');
      return;
    }

    setMining(true);
    setMiningStats(null);
    toast.info('Starting trend mining...');

    try {
      const res = await fetch('/api/trend-mining', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedWords: seeds, geo }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Mining failed');
      }

      const data = await res.json();
      setMiningStats({
        totalRisingQueries: data.totalRisingQueries,
        enriched: data.enriched,
        saved: data.saved,
      });

      toast.success(`Found ${data.saved} trending keywords!`);
      await loadTrends();
    } catch (error) {
      toast.error(String(error));
    } finally {
      setMining(false);
    }
  }

  async function convertToIdea(trendId: string) {
    setConverting(trendId);
    try {
      const res = await fetch(`/api/trend-mining/${trendId}/convert`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Convert failed');
      }
      const data = await res.json();
      toast.success(data.message);
      await loadTrends();
    } catch (error) {
      toast.error(String(error));
    } finally {
      setConverting(null);
    }
  }

  function addSeed() {
    const word = seedInput.trim();
    if (word && !seeds.includes(word)) {
      setSeeds([...seeds, word]);
      setSeedInput('');
    }
  }

  function removeSeed(seed: string) {
    setSeeds(seeds.filter(s => s !== seed));
  }

  function getDifficultyColor(kd: number | null): string {
    if (kd == null) return 'bg-slate-100 text-slate-600';
    if (kd < 30) return 'bg-green-100 text-green-700';
    if (kd < 50) return 'bg-yellow-100 text-yellow-700';
    if (kd < 70) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  }

  function getGrowthColor(value: number | null, isBreakout?: boolean): string {
    if (isBreakout || (value != null && value >= 5000)) return 'bg-purple-100 text-purple-700';
    if (value != null && value >= 1000) return 'bg-red-100 text-red-700';
    if (value != null && value >= 500) return 'bg-orange-100 text-orange-700';
    if (value != null && value >= 100) return 'bg-yellow-100 text-yellow-700';
    return 'bg-slate-100 text-slate-600';
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'converted':
        return <Badge className="bg-green-100 text-green-700">Converted</Badge>;
      case 'validated':
        return <Badge className="bg-blue-100 text-blue-700">Validated</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700">Rejected</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-600">Pending</Badge>;
    }
  }

  const pendingTrends = trends.filter(t => t.validationStatus === 'pending');
  const convertedTrends = trends.filter(t => t.validationStatus === 'converted');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-7 h-7 text-orange-600" />
          Trend Mining
        </h1>
        <p className="text-slate-500 mt-1">
          Use seed words to discover rising search queries from Google Trends, then validate with SEO metrics.
        </p>
      </div>

      {/* Mining Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-500" />
            Seed Words
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Seed tags */}
          <div className="flex flex-wrap gap-2">
            {seeds.map(seed => (
              <span
                key={seed}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-sm font-medium border border-orange-200"
              >
                {seed}
                <button
                  onClick={() => removeSeed(seed)}
                  className="ml-1 hover:text-orange-900 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>

          {/* Add seed input */}
          <div className="flex gap-2">
            <Input
              value={seedInput}
              onChange={e => setSeedInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSeed()}
              placeholder="Add seed word..."
              className="max-w-xs"
            />
            <Button variant="outline" size="sm" onClick={addSeed}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>

          {/* Region + Action */}
          <div className="flex items-center gap-4 pt-2">
            <select
              value={geo}
              onChange={e => setGeo(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              <option value="">Global</option>
              <option value="US">United States</option>
              <option value="CN">China</option>
              <option value="GB">United Kingdom</option>
              <option value="DE">Germany</option>
              <option value="JP">Japan</option>
            </select>

            <Button
              onClick={startMining}
              disabled={mining || seeds.length === 0}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {mining ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Mining...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Start Mining
                </>
              )}
            </Button>
          </div>

          {/* Mining stats */}
          {miningStats && (
            <div className="flex gap-4 pt-2 text-sm text-slate-600">
              <span>Rising queries found: <strong>{miningStats.totalRisingQueries}</strong></span>
              <span>SEO enriched: <strong>{miningStats.enriched}</strong></span>
              <span>Saved: <strong>{miningStats.saved}</strong></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {trends.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-slate-900">{trends.length}</div>
              <div className="text-sm text-slate-500">Total Trends</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-orange-600">{pendingTrends.length}</div>
              <div className="text-sm text-slate-500">Pending Review</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{convertedTrends.length}</div>
              <div className="text-sm text-slate-500">Converted to Ideas</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-purple-600">
                {trends.filter(t => t.growthNumeric != null && t.growthNumeric >= 5000).length}
              </div>
              <div className="text-sm text-slate-500">Breakout Keywords</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Discovered Trends ({trends.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading...</div>
          ) : trends.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No trends discovered yet. Add seed words and click "Start Mining".</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-2 font-medium text-slate-600">Keyword</th>
                    <th className="text-left py-3 px-2 font-medium text-slate-600">Seed</th>
                    <th className="text-right py-3 px-2 font-medium text-slate-600">Growth</th>
                    <th className="text-right py-3 px-2 font-medium text-slate-600">Volume</th>
                    <th className="text-right py-3 px-2 font-medium text-slate-600">KD</th>
                    <th className="text-right py-3 px-2 font-medium text-slate-600">CPC</th>
                    <th className="text-center py-3 px-2 font-medium text-slate-600">Status</th>
                    <th className="text-right py-3 px-2 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trends.map(trend => (
                    <tr key={trend.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{trend.keyword}</span>
                          <a
                            href={`https://trends.google.com/trends/explore?q=${encodeURIComponent(trend.keyword)}&date=now%207-d`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-blue-600"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        {trend.seedWord && (
                          <Badge className="bg-slate-100 text-slate-600 text-xs">{trend.seedWord}</Badge>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {trend.growthRate && (
                          <Badge className={getGrowthColor(trend.growthNumeric, trend.growthRate?.includes('Breakout') || trend.growthRate?.includes('暴增'))}>
                            {trend.growthNumeric != null && trend.growthNumeric >= 5000
                              ? 'Breakout'
                              : trend.growthRate}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right font-medium text-slate-700">
                        {trend.searchVolume != null ? trend.searchVolume.toLocaleString() : '-'}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {trend.difficulty != null ? (
                          <Badge className={getDifficultyColor(trend.difficulty)}>
                            {trend.difficulty.toFixed(0)}
                          </Badge>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-2 text-right text-slate-700">
                        {trend.cpc != null ? `$${trend.cpc.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {getStatusBadge(trend.validationStatus)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {trend.validationStatus === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => convertToIdea(trend.id)}
                            disabled={converting === trend.id}
                            className="text-xs"
                          >
                            {converting === trend.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <ArrowRight className="w-3 h-3 mr-1" />
                                To Idea
                              </>
                            )}
                          </Button>
                        )}
                        {trend.validationStatus === 'converted' && trend.ideaId && (
                          <a
                            href={`/ideas/${trend.ideaId}`}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            View Idea
                          </a>
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
    </div>
  );
}
