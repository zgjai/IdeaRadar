'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { TrendingUp, Search, Zap, ArrowRight, X, Plus, Loader2, ExternalLink, Sparkles, Factory } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// --- Types ---

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
  metadata: string | null;
  createdAt: string;
}

interface ServiceResult {
  category: string;
  fiverrVolume: number;
  toolVolume: number;
  softwareVolume: number;
  automationVolume: number;
  soapScore: number;
  productizationGap: number;
  avgCpc: number;
  avgDifficulty: number;
}

type TabType = 'trend-mining' | 'service-mining';

const DEFAULT_SEEDS = ['AI', 'SaaS', 'generator', 'maker', 'tool'];

// --- Component ---

export default function TrendsPage() {
  // Tab state
  const [tab, setTab] = useState<TabType>('trend-mining');

  // Trend mining state
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

  // Service mining state
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [serviceCatInput, setServiceCatInput] = useState('');
  const [serviceMining, setServiceMining] = useState(false);
  const [serviceResults, setServiceResults] = useState<ServiceResult[]>([]);
  const [serviceDiscoveries, setServiceDiscoveries] = useState<TrendDiscovery[]>([]);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceStats, setServiceStats] = useState<{
    categories: number;
    keywordsChecked: number;
    saved: number;
  } | null>(null);

  // Load data on mount
  useEffect(() => {
    loadTrends();
    loadSeedSettings();
    loadServiceDiscoveries();
  }, []);

  // --- Trend Mining logic ---

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
      await loadServiceDiscoveries();
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

  // --- Service Mining logic ---

  async function loadServiceDiscoveries() {
    setServiceLoading(true);
    try {
      const res = await fetch('/api/service-mining');
      if (res.ok) {
        const data = await res.json();
        setServiceDiscoveries(data.discoveries || []);
      }
    } catch (error) {
      console.error('Failed to load service discoveries:', error);
    } finally {
      setServiceLoading(false);
    }
  }

  async function startServiceMining() {
    setServiceMining(true);
    setServiceStats(null);
    setServiceResults([]);
    toast.info('Starting service mining...');

    try {
      const body: Record<string, unknown> = {};
      if (serviceCategories.length > 0) body.categories = serviceCategories;

      const res = await fetch('/api/service-mining', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Service mining failed');
      }

      const data = await res.json();
      setServiceResults(data.results || []);
      setServiceStats({
        categories: data.categories,
        keywordsChecked: data.keywordsChecked,
        saved: data.saved,
      });

      toast.success(`Analyzed ${data.categories} service categories!`);
      await loadServiceDiscoveries();
    } catch (error) {
      toast.error(String(error));
    } finally {
      setServiceMining(false);
    }
  }

  function addServiceCategory() {
    const cat = serviceCatInput.trim();
    if (cat && !serviceCategories.includes(cat)) {
      setServiceCategories([...serviceCategories, cat]);
      setServiceCatInput('');
    }
  }

  function removeServiceCategory(cat: string) {
    setServiceCategories(serviceCategories.filter(c => c !== cat));
  }

  // --- Helpers ---

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

  function getSoapColor(score: number): string {
    if (score >= 500) return 'bg-purple-100 text-purple-700';
    if (score >= 200) return 'bg-red-100 text-red-700';
    if (score >= 100) return 'bg-orange-100 text-orange-700';
    if (score >= 50) return 'bg-yellow-100 text-yellow-700';
    return 'bg-slate-100 text-slate-600';
  }

  function getGapColor(gap: number): string {
    if (gap >= 500) return 'text-green-600 font-semibold';
    if (gap >= 100) return 'text-green-500';
    if (gap > 0) return 'text-yellow-600';
    return 'text-red-500';
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
          Trends & Services
        </h1>
        <p className="text-slate-500 mt-1">
          Discover trending keywords and find freelance services ripe for productization.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('trend-mining')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'trend-mining'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          Trend Mining
        </button>
        <button
          onClick={() => setTab('service-mining')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'service-mining'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Factory className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          Service Mining
        </button>
      </div>

      {/* ===== Trend Mining Tab ===== */}
      {tab === 'trend-mining' && (
        <>
          {/* Mining Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-500" />
                Seed Words
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {seeds.map(seed => (
                  <span
                    key={seed}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-sm font-medium border border-orange-200"
                  >
                    {seed}
                    <button onClick={() => removeSeed(seed)} className="ml-1 hover:text-orange-900 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>

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
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Mining...</>
                  ) : (
                    <><Search className="w-4 h-4 mr-2" />Start Mining</>
                  )}
                </Button>
              </div>

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
              <CardTitle className="text-lg">Discovered Trends ({trends.length})</CardTitle>
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
                                {trend.growthNumeric != null && trend.growthNumeric >= 5000 ? 'Breakout' : trend.growthRate}
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-2 text-right font-medium text-slate-700">
                            {trend.searchVolume != null ? trend.searchVolume.toLocaleString() : '-'}
                          </td>
                          <td className="py-3 px-2 text-right">
                            {trend.difficulty != null ? (
                              <Badge className={getDifficultyColor(trend.difficulty)}>{trend.difficulty.toFixed(0)}</Badge>
                            ) : '-'}
                          </td>
                          <td className="py-3 px-2 text-right text-slate-700">
                            {trend.cpc != null ? `$${trend.cpc.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-3 px-2 text-center">{getStatusBadge(trend.validationStatus)}</td>
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
                                  <><ArrowRight className="w-3 h-3 mr-1" />To Idea</>
                                )}
                              </Button>
                            )}
                            {trend.validationStatus === 'converted' && trend.ideaId && (
                              <a href={`/ideas/${trend.ideaId}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
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
        </>
      )}

      {/* ===== Service Mining Tab ===== */}
      {tab === 'service-mining' && (
        <>
          {/* Service Mining Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Factory className="w-5 h-5 text-indigo-500" />
                Service Mining (SOAP Strategy)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-500">
                Find popular freelance services (Fiverr/Upwork) that can be productized into SaaS tools.
                Measures "fiverr [service]" search volume vs "[service] tool" volume to identify productization gaps.
              </p>

              {/* Custom categories */}
              {serviceCategories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {serviceCategories.map(cat => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium border border-indigo-200"
                    >
                      {cat}
                      <button onClick={() => removeServiceCategory(cat)} className="ml-1 hover:text-indigo-900">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  value={serviceCatInput}
                  onChange={e => setServiceCatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addServiceCategory()}
                  placeholder="Add custom service category (or leave empty for defaults)..."
                  className="max-w-md"
                />
                <Button variant="outline" size="sm" onClick={addServiceCategory}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>

              <div className="pt-2">
                <Button
                  onClick={startServiceMining}
                  disabled={serviceMining}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {serviceMining ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Mining Services...</>
                  ) : (
                    <><Factory className="w-4 h-4 mr-2" />Mine Services</>
                  )}
                </Button>
              </div>

              {serviceStats && (
                <div className="flex gap-4 pt-2 text-sm text-slate-600">
                  <span>Categories analyzed: <strong>{serviceStats.categories}</strong></span>
                  <span>Keywords checked: <strong>{serviceStats.keywordsChecked}</strong></span>
                  <span>Saved: <strong>{serviceStats.saved}</strong></span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fresh Results */}
          {serviceResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">SOAP Analysis Results ({serviceResults.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-2 font-medium text-slate-600">Service</th>
                        <th className="text-right py-3 px-2 font-medium text-slate-600">Fiverr Vol</th>
                        <th className="text-right py-3 px-2 font-medium text-slate-600">Tool Vol</th>
                        <th className="text-right py-3 px-2 font-medium text-slate-600">Auto Vol</th>
                        <th className="text-right py-3 px-2 font-medium text-slate-600">Gap</th>
                        <th className="text-right py-3 px-2 font-medium text-slate-600">SOAP Score</th>
                        <th className="text-right py-3 px-2 font-medium text-slate-600">CPC</th>
                        <th className="text-right py-3 px-2 font-medium text-slate-600">KD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceResults.map((result, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-2 font-medium text-slate-900 capitalize">{result.category}</td>
                          <td className="py-3 px-2 text-right font-mono text-slate-700">
                            {result.fiverrVolume.toLocaleString()}
                          </td>
                          <td className="py-3 px-2 text-right font-mono text-slate-700">
                            {result.toolVolume.toLocaleString()}
                          </td>
                          <td className="py-3 px-2 text-right font-mono text-slate-700">
                            {result.automationVolume.toLocaleString()}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span className={getGapColor(result.productizationGap)}>
                              {result.productizationGap > 0 ? '+' : ''}{result.productizationGap.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <Badge className={getSoapColor(result.soapScore)}>
                              {Math.round(result.soapScore)}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 text-right text-slate-700">
                            ${result.avgCpc.toFixed(2)}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <Badge className={getDifficultyColor(result.avgDifficulty)}>
                              {result.avgDifficulty.toFixed(0)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Saved Service Discoveries */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Saved Service Discoveries ({serviceDiscoveries.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {serviceLoading ? (
                <div className="text-center py-12 text-slate-500">Loading...</div>
              ) : serviceDiscoveries.length === 0 && serviceResults.length === 0 ? (
                <div className="text-center py-12">
                  <Factory className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No service discoveries yet. Click "Mine Services" to start.</p>
                  <p className="text-sm text-slate-400 mt-1">Requires DataForSEO API configured in Settings.</p>
                </div>
              ) : serviceDiscoveries.length === 0 ? null : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-2 font-medium text-slate-600">Service</th>
                        <th className="text-right py-3 px-2 font-medium text-slate-600">SOAP Score</th>
                        <th className="text-right py-3 px-2 font-medium text-slate-600">Volume</th>
                        <th className="text-right py-3 px-2 font-medium text-slate-600">KD</th>
                        <th className="text-right py-3 px-2 font-medium text-slate-600">CPC</th>
                        <th className="text-center py-3 px-2 font-medium text-slate-600">Status</th>
                        <th className="text-right py-3 px-2 font-medium text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceDiscoveries.map(disc => (
                        <tr key={disc.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-2 font-medium text-slate-900 capitalize">{disc.keyword}</td>
                          <td className="py-3 px-2 text-right">
                            {disc.growthRate && (
                              <Badge className={getSoapColor(disc.growthNumeric ?? 0)}>
                                {disc.growthRate}
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-2 text-right font-mono text-slate-700">
                            {disc.searchVolume != null ? disc.searchVolume.toLocaleString() : '-'}
                          </td>
                          <td className="py-3 px-2 text-right">
                            {disc.difficulty != null ? (
                              <Badge className={getDifficultyColor(disc.difficulty)}>{disc.difficulty.toFixed(0)}</Badge>
                            ) : '-'}
                          </td>
                          <td className="py-3 px-2 text-right text-slate-700">
                            {disc.cpc != null ? `$${disc.cpc.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-3 px-2 text-center">{getStatusBadge(disc.validationStatus)}</td>
                          <td className="py-3 px-2 text-right">
                            {disc.validationStatus === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => convertToIdea(disc.id)}
                                disabled={converting === disc.id}
                                className="text-xs"
                              >
                                {converting === disc.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <><ArrowRight className="w-3 h-3 mr-1" />To Idea</>
                                )}
                              </Button>
                            )}
                            {disc.validationStatus === 'converted' && disc.ideaId && (
                              <a href={`/ideas/${disc.ideaId}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
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
        </>
      )}
    </div>
  );
}
