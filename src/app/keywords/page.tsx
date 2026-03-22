'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { Search, Zap, ArrowRight, Loader2, Plus, X, Replace, Wrench, Trophy } from 'lucide-react';

// --- Types ---

interface Keyword {
  id: number;
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  cpc: number | null;
  competition: string | null;
  intent: string | null;
  dataSource: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type TabType = 'browser' | 'discovery';
type DiscoveryMode = 'alternatives' | 'how-to' | 'best-tools';

interface DiscoveryResult {
  keyword: string;
  searchVolume: number;
  difficulty: number;
  cpc: number;
  opportunityScore: number;
  seed: string;
}

// --- Component ---

export default function KeywordsPage() {
  // Tab state
  const [tab, setTab] = useState<TabType>('browser');

  // Browser tab state
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('search_volume');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);

  // Discovery tab state
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>('alternatives');
  const [customSeeds, setCustomSeeds] = useState<string[]>([]);
  const [seedInput, setSeedInput] = useState('');
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryResult[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryStats, setDiscoveryStats] = useState<{
    keywordsChecked: number;
    resultsFound: number;
    saved: number;
  } | null>(null);

  useEffect(() => {
    if (tab === 'browser') fetchKeywords();
  }, [search, sort, order, page, tab]);

  // --- Browser tab logic ---

  const fetchKeywords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        sort,
        order,
      });
      if (search) params.set('search', search);

      const response = await fetch(`/api/keywords?${params}`);
      const data = await response.json();
      setKeywords(data.keywords || []);
      setPagination(data.pagination || null);
    } catch (error) {
      console.error('Failed to fetch keywords:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- Discovery tab logic ---

  const startDiscovery = async () => {
    setDiscovering(true);
    setDiscoveryStats(null);
    setDiscoveryResults([]);
    toast.info(`Starting ${discoveryMode} keyword discovery...`);

    try {
      const body: Record<string, unknown> = { mode: discoveryMode };
      if (customSeeds.length > 0) body.seeds = customSeeds;

      const res = await fetch('/api/keyword-discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Discovery failed');
      }

      const data = await res.json();
      setDiscoveryResults(data.results || []);
      setDiscoveryStats({
        keywordsChecked: data.keywordsChecked,
        resultsFound: data.results?.length || 0,
        saved: data.saved,
      });
      toast.success(`Found ${data.results?.length || 0} keyword opportunities!`);
    } catch (error) {
      toast.error(String(error));
    } finally {
      setDiscovering(false);
    }
  };

  const addSeed = () => {
    const word = seedInput.trim();
    if (word && !customSeeds.includes(word)) {
      setCustomSeeds([...customSeeds, word]);
      setSeedInput('');
    }
  };

  const removeSeed = (seed: string) => {
    setCustomSeeds(customSeeds.filter(s => s !== seed));
  };

  // --- Helpers ---

  const getDifficultyColor = (d: number | null) => {
    if (d === null) return 'text-slate-400';
    if (d <= 30) return 'text-green-600';
    if (d <= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDifficultyLabel = (d: number | null) => {
    if (d === null) return '-';
    if (d <= 30) return 'Low';
    if (d <= 60) return 'Mid';
    return 'High';
  };

  const formatVolume = (v: number | null) => {
    if (v === null) return '-';
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return String(v);
  };

  const getOpportunityColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-700';
    if (score >= 50) return 'bg-yellow-100 text-yellow-700';
    if (score >= 25) return 'bg-orange-100 text-orange-700';
    return 'bg-slate-100 text-slate-600';
  };

  const MODE_CONFIG: Record<DiscoveryMode, { label: string; icon: typeof Replace; description: string; color: string }> = {
    'alternatives': {
      label: 'Alternatives',
      icon: Replace,
      description: 'Find "X alternative" keywords with high commercial intent',
      color: 'bg-blue-600 hover:bg-blue-700',
    },
    'how-to': {
      label: 'How-to',
      icon: Wrench,
      description: 'Find "how to X" keywords indicating automation opportunities',
      color: 'bg-purple-600 hover:bg-purple-700',
    },
    'best-tools': {
      label: 'Best Tools',
      icon: Trophy,
      description: 'Find "best X tool" keywords showing product comparison intent',
      color: 'bg-teal-600 hover:bg-teal-700',
    },
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Keywords</h1>
        <p className="text-slate-600">Browse SEO keyword data and discover product opportunities</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('browser')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'browser'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Search className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          Browser
        </button>
        <button
          onClick={() => setTab('discovery')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'discovery'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Zap className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          Discovery
        </button>
      </div>

      {/* ===== Browser Tab ===== */}
      {tab === 'browser' && (
        <>
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <Input
                    placeholder="Search keywords..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>
                <Select
                  value={sort}
                  onChange={(e) => { setSort(e.target.value); setPage(1); }}
                >
                  <option value="search_volume">Search Volume</option>
                  <option value="difficulty">Difficulty</option>
                  <option value="cpc">CPC</option>
                  <option value="keyword">Keyword</option>
                </Select>
                <Select
                  value={order}
                  onChange={(e) => { setOrder(e.target.value); setPage(1); }}
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          {pagination && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-slate-500">Total Keywords</p>
                  <p className="text-2xl font-bold text-slate-900">{pagination.total.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-slate-500">Page</p>
                  <p className="text-2xl font-bold text-slate-900">{pagination.page} / {pagination.totalPages}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-slate-500">Showing</p>
                  <p className="text-2xl font-bold text-slate-900">{keywords.length}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Keywords Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <LoadingState text="Loading keywords..." />
              ) : keywords.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <p className="text-slate-500 mb-2">No keyword data yet</p>
                    <p className="text-sm text-slate-400">Run V2 analysis to collect keywords automatically</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Keyword</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Monthly Volume</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Difficulty</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">CPC</th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Competition</th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Intent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keywords.map((kw) => (
                        <tr key={kw.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-900">{kw.keyword}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono text-sm text-slate-700">{formatVolume(kw.searchVolume)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-mono text-sm ${getDifficultyColor(kw.difficulty)}`}>
                              {kw.difficulty !== null ? `${kw.difficulty}` : '-'}
                            </span>
                            <span className="text-xs text-slate-400 ml-1">{getDifficultyLabel(kw.difficulty)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono text-sm text-slate-700">
                              {kw.cpc !== null ? `$${kw.cpc.toFixed(2)}` : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {kw.competition ? (
                              <Badge variant={kw.competition === 'LOW' ? 'green' : kw.competition === 'MEDIUM' ? 'yellow' : 'red'}>
                                {kw.competition}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {kw.intent ? (
                              <Badge variant="blue">{kw.intent}</Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
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

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-slate-600">{page} / {pagination.totalPages}</span>
              <button
                onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                disabled={page >= pagination.totalPages}
                className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* ===== Discovery Tab ===== */}
      {tab === 'discovery' && (
        <>
          {/* Mode Selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {(Object.entries(MODE_CONFIG) as [DiscoveryMode, typeof MODE_CONFIG[DiscoveryMode]][]).map(([mode, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={mode}
                  onClick={() => setDiscoveryMode(mode)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    discoveryMode === mode
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-5 h-5 ${discoveryMode === mode ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="font-semibold text-slate-900">{config.label}</span>
                  </div>
                  <p className="text-xs text-slate-500">{config.description}</p>
                </button>
              );
            })}
          </div>

          {/* Custom Seeds */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Custom Seeds (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-500">
                Leave empty to use defaults, or add your own seed words to customize the discovery.
              </p>
              {customSeeds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {customSeeds.map(seed => (
                    <span
                      key={seed}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-200"
                    >
                      {seed}
                      <button onClick={() => removeSeed(seed)} className="ml-1 hover:text-blue-900">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
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

              <div className="pt-2">
                <Button
                  onClick={startDiscovery}
                  disabled={discovering}
                  className={`text-white ${MODE_CONFIG[discoveryMode].color}`}
                >
                  {discovering ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Discovering...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Start {MODE_CONFIG[discoveryMode].label} Discovery
                    </>
                  )}
                </Button>
              </div>

              {discoveryStats && (
                <div className="flex gap-4 pt-2 text-sm text-slate-600">
                  <span>Keywords checked: <strong>{discoveryStats.keywordsChecked}</strong></span>
                  <span>Opportunities found: <strong>{discoveryStats.resultsFound}</strong></span>
                  <span>Saved: <strong>{discoveryStats.saved}</strong></span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Discovery Results */}
          {discoveryResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Discovery Results ({discoveryResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-2 font-medium text-slate-600">Keyword</th>
                        <th className="text-left py-3 px-2 font-medium text-slate-600">Seed</th>
                        <th className="text-right py-3 px-2 font-medium text-slate-600">Volume</th>
                        <th className="text-right py-3 px-2 font-medium text-slate-600">KD</th>
                        <th className="text-right py-3 px-2 font-medium text-slate-600">CPC</th>
                        <th className="text-right py-3 px-2 font-medium text-slate-600">Opportunity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {discoveryResults.map((result, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-2 font-medium text-slate-900">{result.keyword}</td>
                          <td className="py-3 px-2">
                            <Badge className="bg-slate-100 text-slate-600 text-xs">{result.seed}</Badge>
                          </td>
                          <td className="py-3 px-2 text-right font-mono text-slate-700">
                            {formatVolume(result.searchVolume)}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span className={`font-mono ${getDifficultyColor(result.difficulty)}`}>
                              {result.difficulty.toFixed(0)}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right text-slate-700">
                            ${result.cpc.toFixed(2)}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <Badge className={getOpportunityColor(result.opportunityScore)}>
                              {result.opportunityScore.toFixed(0)}
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

          {/* Empty state */}
          {!discovering && discoveryResults.length === 0 && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Zap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Select a discovery mode and click Start to find keyword opportunities.</p>
                  <p className="text-sm text-slate-400 mt-1">Requires DataForSEO API configured in Settings.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
