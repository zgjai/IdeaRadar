'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/spinner';

interface Settings {
  aiConfig: {
    baseUrl: string;
    screeningModel: {
      provider: string;
      model: string;
      apiKey: string;
    };
    analysisModel: {
      provider: string;
      model: string;
      apiKey: string;
    };
    temperature: number;
    dailyBudget: number;
  };
  seoApis: {
    dataForSeoLogin: string;
    dataForSeoPassword: string;
    serpApiKey: string;
  };
  dataSources: {
    hackernews: { enabled: boolean };
    producthunt: { enabled: boolean; apiToken: string };
    googleTrends: { enabled: boolean };
  };
  scheduler: {
    collectionInterval: string;
    analysisInterval: string;
  };
}

const DEFAULT_SETTINGS: Settings = {
  aiConfig: {
    baseUrl: '',
    screeningModel: {
      provider: 'openrouter',
      model: 'anthropic/claude-haiku-4.5',
      apiKey: '',
    },
    analysisModel: {
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4.6',
      apiKey: '',
    },
    temperature: 0.3,
    dailyBudget: 5,
  },
  seoApis: {
    dataForSeoLogin: '',
    dataForSeoPassword: '',
    serpApiKey: '',
  },
  dataSources: {
    hackernews: { enabled: true },
    producthunt: { enabled: false, apiToken: '' },
    googleTrends: { enabled: false },
  },
  scheduler: {
    collectionInterval: '0 */6 * * *',
    analysisInterval: '0 */6 * * *',
  },
};

function mergeSettings(saved: Record<string, string>): Settings {
  const s: Settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if (saved['ai.baseUrl']) s.aiConfig.baseUrl = saved['ai.baseUrl'];
  if (saved['ai.screening.provider']) s.aiConfig.screeningModel.provider = saved['ai.screening.provider'];
  if (saved['ai.screening.model']) s.aiConfig.screeningModel.model = saved['ai.screening.model'];
  if (saved['ai.screening.apiKey']) s.aiConfig.screeningModel.apiKey = saved['ai.screening.apiKey'];
  if (saved['ai.analysis.provider']) s.aiConfig.analysisModel.provider = saved['ai.analysis.provider'];
  if (saved['ai.analysis.model']) s.aiConfig.analysisModel.model = saved['ai.analysis.model'];
  if (saved['ai.analysis.apiKey']) s.aiConfig.analysisModel.apiKey = saved['ai.analysis.apiKey'];
  if (saved['ai.temperature']) s.aiConfig.temperature = parseFloat(saved['ai.temperature']);
  if (saved['ai.dailyBudget']) s.aiConfig.dailyBudget = parseInt(saved['ai.dailyBudget']);
  if (saved['seo.dataforseo.login']) s.seoApis.dataForSeoLogin = saved['seo.dataforseo.login'];
  if (saved['seo.dataforseo.password']) s.seoApis.dataForSeoPassword = saved['seo.dataforseo.password'];
  if (saved['seo.serpapi.apiKey']) s.seoApis.serpApiKey = saved['seo.serpapi.apiKey'];
  if (saved['sources.hackernews.enabled']) s.dataSources.hackernews.enabled = saved['sources.hackernews.enabled'] === 'true';
  if (saved['sources.producthunt.enabled']) s.dataSources.producthunt.enabled = saved['sources.producthunt.enabled'] === 'true';
  if (saved['sources.producthunt.apiToken']) s.dataSources.producthunt.apiToken = saved['sources.producthunt.apiToken'];
  if (saved['sources.googleTrends.enabled']) s.dataSources.googleTrends.enabled = saved['sources.googleTrends.enabled'] === 'true';
  if (saved['scheduler.collectInterval']) s.scheduler.collectionInterval = saved['scheduler.collectInterval'];
  if (saved['scheduler.analyzeInterval']) s.scheduler.analysisInterval = saved['scheduler.analyzeInterval'];
  return s;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      setSettings(mergeSettings(data?.settings || {}));
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const flat: Record<string, string> = {
        'ai.baseUrl': settings.aiConfig.baseUrl,
        'ai.screening.baseUrl': settings.aiConfig.baseUrl,
        'ai.analysis.baseUrl': settings.aiConfig.baseUrl,
        'ai.screening.provider': settings.aiConfig.screeningModel.provider,
        'ai.screening.model': settings.aiConfig.screeningModel.model,
        'ai.screening.apiKey': settings.aiConfig.screeningModel.apiKey,
        'ai.analysis.provider': settings.aiConfig.analysisModel.provider,
        'ai.analysis.model': settings.aiConfig.analysisModel.model,
        'ai.analysis.apiKey': settings.aiConfig.analysisModel.apiKey,
        'ai.temperature': String(settings.aiConfig.temperature),
        'ai.dailyBudget': String(settings.aiConfig.dailyBudget),
        'seo.dataforseo.login': settings.seoApis.dataForSeoLogin,
        'seo.dataforseo.password': settings.seoApis.dataForSeoPassword,
        'seo.serpapi.apiKey': settings.seoApis.serpApiKey,
        'sources.hackernews.enabled': String(settings.dataSources.hackernews.enabled),
        'sources.producthunt.enabled': String(settings.dataSources.producthunt.enabled),
        'sources.producthunt.apiToken': settings.dataSources.producthunt.apiToken,
        'sources.googleTrends.enabled': String(settings.dataSources.googleTrends.enabled),
        'scheduler.collectInterval': settings.scheduler.collectionInterval,
        'scheduler.analyzeInterval': settings.scheduler.analysisInterval,
      };
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: flat }),
      });
      toast.success('设置保存成功！');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('保存设置失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <LoadingState text="加载设置中..." />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-slate-500">加载设置失败</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">设置</h1>
        <p className="text-slate-600">配置你的 IdeaRadar 实例</p>
      </div>

      {/* AI Model Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>AI 模型配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Shared API Base URL */}
          <div>
            <label className="block text-sm text-slate-600 mb-1">API 端点地址</label>
            <Input
              placeholder="https://api.openrouter.ai/api/v1 或 https://yunwu.ai/v1/chat/completions"
              value={settings.aiConfig.baseUrl}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  aiConfig: {
                    ...settings.aiConfig,
                    baseUrl: e.target.value,
                  },
                })
              }
            />
            <p className="text-xs text-slate-400 mt-1">留空则使用 .env 中的 AI_GATEWAY_URL，支持 base URL 或完整端点地址</p>
          </div>

          {/* Screening Model */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">初筛模型</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">服务商</label>
                <Select
                  value={settings.aiConfig.screeningModel.provider}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      aiConfig: {
                        ...settings.aiConfig,
                        screeningModel: {
                          ...settings.aiConfig.screeningModel,
                          provider: e.target.value,
                        },
                      },
                    })
                  }
                >
                  <option value="openrouter">OpenRouter / AI Gateway</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="custom">Custom Endpoint</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">模型名称</label>
                <Input
                  value={settings.aiConfig.screeningModel.model}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      aiConfig: {
                        ...settings.aiConfig,
                        screeningModel: {
                          ...settings.aiConfig.screeningModel,
                          model: e.target.value,
                        },
                      },
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">API 密钥</label>
                <Input
                  type="password"
                  value={settings.aiConfig.screeningModel.apiKey}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      aiConfig: {
                        ...settings.aiConfig,
                        screeningModel: {
                          ...settings.aiConfig.screeningModel,
                          apiKey: e.target.value,
                        },
                      },
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* Analysis Model */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">深度分析模型</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">服务商</label>
                <Select
                  value={settings.aiConfig.analysisModel.provider}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      aiConfig: {
                        ...settings.aiConfig,
                        analysisModel: {
                          ...settings.aiConfig.analysisModel,
                          provider: e.target.value,
                        },
                      },
                    })
                  }
                >
                  <option value="openrouter">OpenRouter / AI Gateway</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="custom">Custom Endpoint</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">模型名称</label>
                <Input
                  value={settings.aiConfig.analysisModel.model}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      aiConfig: {
                        ...settings.aiConfig,
                        analysisModel: {
                          ...settings.aiConfig.analysisModel,
                          model: e.target.value,
                        },
                      },
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">API 密钥</label>
                <Input
                  type="password"
                  value={settings.aiConfig.analysisModel.apiKey}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      aiConfig: {
                        ...settings.aiConfig,
                        analysisModel: {
                          ...settings.aiConfig.analysisModel,
                          apiKey: e.target.value,
                        },
                      },
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* Temperature & Budget */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">温度 (0-1)</label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={settings.aiConfig.temperature}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    aiConfig: {
                      ...settings.aiConfig,
                      temperature: parseFloat(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">每日预算 ($)</label>
              <Input
                type="number"
                step="1"
                min="0"
                value={settings.aiConfig.dailyBudget}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    aiConfig: {
                      ...settings.aiConfig,
                      dailyBudget: parseInt(e.target.value),
                    },
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEO API Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>SEO API 配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">DataForSEO</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">登录名</label>
                <Input
                  placeholder="your@email.com"
                  value={settings.seoApis.dataForSeoLogin}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      seoApis: {
                        ...settings.seoApis,
                        dataForSeoLogin: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">密码</label>
                <Input
                  type="password"
                  value={settings.seoApis.dataForSeoPassword}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      seoApis: {
                        ...settings.seoApis,
                        dataForSeoPassword: e.target.value,
                      },
                    })
                  }
                />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1">用于关键词数据和 SERP 分析，注册地址: dataforseo.com</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">SerpAPI</h3>
            <div>
              <label className="block text-sm text-slate-600 mb-1">API 密钥</label>
              <Input
                type="password"
                placeholder="your-serpapi-key"
                value={settings.seoApis.serpApiKey}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    seoApis: {
                      ...settings.seoApis,
                      serpApiKey: e.target.value,
                    },
                  })
                }
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">备用 SERP 数据源，注册地址: serpapi.com</p>
          </div>
        </CardContent>
      </Card>

      {/* Data Sources */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>数据源</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Hacker News</label>
            <input
              type="checkbox"
              checked={settings.dataSources.hackernews.enabled}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  dataSources: {
                    ...settings.dataSources,
                    hackernews: { enabled: e.target.checked },
                  },
                })
              }
              className="w-4 h-4"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Product Hunt</label>
              <input
                type="checkbox"
                checked={settings.dataSources.producthunt.enabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    dataSources: {
                      ...settings.dataSources,
                      producthunt: {
                        ...settings.dataSources.producthunt,
                        enabled: e.target.checked,
                      },
                    },
                  })
                }
                className="w-4 h-4"
              />
            </div>
            {settings.dataSources.producthunt.enabled && (
              <div>
                <label className="block text-sm text-slate-600 mb-1">API 令牌</label>
                <Input
                  type="password"
                  value={settings.dataSources.producthunt.apiToken}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      dataSources: {
                        ...settings.dataSources,
                        producthunt: {
                          ...settings.dataSources.producthunt,
                          apiToken: e.target.value,
                        },
                      },
                    })
                  }
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Google Trends</label>
            <input
              type="checkbox"
              checked={settings.dataSources.googleTrends.enabled}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  dataSources: {
                    ...settings.dataSources,
                    googleTrends: { enabled: e.target.checked },
                  },
                })
              }
              className="w-4 h-4"
            />
          </div>
          {settings.dataSources.googleTrends.enabled && (
            <p className="text-xs text-slate-500 pl-1">
              Requires SerpAPI key (configured above). Collects trending tech searches as ideas.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Scheduler */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>定时任务</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">采集频率</label>
            <Select
              value={settings.scheduler.collectionInterval}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  scheduler: {
                    ...settings.scheduler,
                    collectionInterval: e.target.value,
                  },
                })
              }
            >
              <option value="0 */6 * * *">每 6 小时</option>
              <option value="0 */12 * * *">每 12 小时</option>
              <option value="0 0 * * *">每天</option>
              <option value="0 0 */2 * *">每 2 天</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">分析频率</label>
            <Select
              value={settings.scheduler.analysisInterval}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  scheduler: {
                    ...settings.scheduler,
                    analysisInterval: e.target.value,
                  },
                })
              }
            >
              <option value="0 */6 * * *">每 6 小时</option>
              <option value="0 */12 * * *">每 12 小时</option>
              <option value="0 0 * * *">每天</option>
              <option value="0 0 */2 * *">每 2 天</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? '保存中...' : '保存设置'}
        </Button>
      </div>
    </div>
  );
}
