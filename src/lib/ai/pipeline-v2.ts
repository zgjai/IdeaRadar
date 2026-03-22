import { db } from '../db';
import { ideas } from '../db/schema';
import { eq } from 'drizzle-orm';
import { createAIProvider } from './provider';
import type { Idea, Keyword, Competitor, MonetizationSignal } from '../db/schema';

// =============================================================================
// Types
// =============================================================================

export interface SEOAnalysis {
  targetKeywords: Array<{ keyword: string; priority: 'high' | 'medium' | 'low'; reason: string }>;
  contentStrategy: string[];
  competitionLevel: 'low' | 'medium' | 'high';
  competitorWeaknesses: string[];
  estimatedMonthlyTraffic: number;
  seoDifficulty: number; // 0-100
  trafficScore: number; // 0-100 (computed)
}

export interface CompetitorAnalysis {
  marketStructure: 'monopoly' | 'oligopoly' | 'fragmented' | 'emerging';
  topCompetitors: Array<{
    name: string;
    domain: string;
    strengths: string[];
    weaknesses: string[];
  }>;
  trafficChannels: Array<{ channel: string; viability: 'high' | 'medium' | 'low' }>;
  differentiationOpportunities: string[];
  competitionIntensity: number; // 0-100
}

export interface MonetizationAnalysis {
  recommendedModel: string;
  reasoning: string;
  pricingStrategy: {
    primary: string;
    tiers: string[];
  };
  alternativeRevenue: string[];
  breakEvenTraffic: number;
  monetizationScore: number; // 0-100
}

export interface OpportunityRecommendation {
  verdict: 'strong_go' | 'go' | 'cautious' | 'skip';
  productForm: string;
  mvpFeatures: string[];
  trafficStrategy: string;
  monetizationPath: string;
  timeToMvp: string;
  risks: string[];
  reasoning: string;
  counterEvidence?: {
    failure_reasons: string[];
    kill_criteria: string[];
    counter_arguments: string[];
  };
  verificationStatus?: {
    status: 'validated' | 'conditional' | 'needs_evidence' | 'skip';
    reasoning: string;
    confidence_level: number;
  };
}

export interface StrategyAnalysis {
  discoveryStrategy: {
    primary: 'community_pain' | 'keyword_opportunity' | 'competitor_gap' | 'shadow_clone' | 'service_productization';
    secondary: string | null;
    reasoning: string;
  };
  soapEvaluation: {
    hasExistingService: boolean;
    serviceExamples: string[];
    processSteps: string[];
    automationPotential: number;  // 0-100
    automationApis: string[];
    packagingModel: string;
    soapScore: number;            // 0-100
  };
  shadowClone: {
    bestTarget: string;
    targetWeaknesses: string[];
    differentiationAngle: string;
    cloneComplexity: 'low' | 'medium' | 'high';
    estimatedAdvantage: string;
  };
  fiveCircleValidation: {
    marketDemand: number;        // 0-10
    toolFeasibility: number;     // 0-10
    differentiation: number;     // 0-10
    businessViability: number;   // 0-10
    personalFit: number;         // 0-10
  };
}

export interface V2AnalysisResult {
  seo: SEOAnalysis;
  competitor: CompetitorAnalysis;
  monetization: MonetizationAnalysis;
  strategy: StrategyAnalysis;
  recommendation: OpportunityRecommendation;
  trafficScore: number;
  monetizationScoreValue: number;
  executionScore: number;
  opportunityScore: number;
}

// =============================================================================
// Analysis Context Builder
// =============================================================================

interface AnalysisContext {
  idea: Idea;
  keywords: Keyword[];
  serpDomains: string[];
  competitors: Competitor[];
  monetizationSignals: MonetizationSignal[];
}

async function buildContext(ideaId: string): Promise<AnalysisContext | null> {
  const idea = await db.query.ideas.findFirst({ where: eq(ideas.id, ideaId) });
  if (!idea) return null;

  // Get linked keywords
  const linkedKws = await db.query.ideaKeywords.findMany({
    where: (ik, { eq: e }) => e(ik.ideaId, ideaId),
  });
  const kwIds = linkedKws.map((lk) => lk.keywordId);
  const kws =
    kwIds.length > 0
      ? await db.query.keywords.findMany({
          where: (k, { inArray }) => inArray(k.id, kwIds),
        })
      : [];

  // Get SERP domains
  const kwTexts = kws.map((k) => k.keyword);
  const serpData =
    kwTexts.length > 0
      ? await db.query.serpSnapshots.findMany({
          where: (s, { inArray }) => inArray(s.keyword, kwTexts),
        })
      : [];
  const domainSet = new Set(serpData.map((s) => s.domain));

  // Get competitor details
  const compDomains = Array.from(domainSet);
  const comps =
    compDomains.length > 0
      ? await db.query.competitors.findMany({
          where: (c, { inArray }) => inArray(c.domain, compDomains),
        })
      : [];

  // Get monetization signals
  const signals =
    compDomains.length > 0
      ? await db.query.monetizationSignals.findMany({
          where: (m, { inArray }) => inArray(m.domain, compDomains),
        })
      : [];

  return {
    idea,
    keywords: kws,
    serpDomains: compDomains,
    competitors: comps,
    monetizationSignals: signals,
  };
}

// =============================================================================
// Prompt Templates
// =============================================================================

function seoAnalysisPrompt(ctx: AnalysisContext): string {
  const kwData = ctx.keywords
    .filter((k) => k.searchVolume)
    .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0))
    .slice(0, 20)
    .map((k) => `- "${k.keyword}": 搜索量 ${k.searchVolume}, 难度 ${k.difficulty ?? 'N/A'}, CPC $${k.cpc ?? 'N/A'}`)
    .join('\n');

  const serpInfo = ctx.serpDomains.slice(0, 10).join(', ');

  return `你是一位资深 SEO 专家。分析以下产品创意的 SEO 流量获取机会。

产品创意：${ctx.idea.title}
描述：${ctx.idea.description}

关键词数据：
${kwData || '暂无关键词数据'}

SERP 主要竞争域名：${serpInfo || '暂无数据'}

请分析并以 JSON 格式返回：
{
  "targetKeywords": [{"keyword": "...", "priority": "high/medium/low", "reason": "..."}],
  "contentStrategy": ["创建什么内容能获得排名"],
  "competitionLevel": "low/medium/high",
  "competitorWeaknesses": ["可以突破的竞品弱点"],
  "estimatedMonthlyTraffic": 预计Top3月流量,
  "seoDifficulty": 0-100的SEO难度,
  "trafficScore": 0-100的流量获取力评分
}

评分标准：
- trafficScore 90+: 搜索量大(>10K/月)、难度低(<30)、CPC高
- trafficScore 70-89: 搜索量中等(1K-10K)、难度适中(30-50)
- trafficScore 50-69: 有流量机会但竞争大或搜索量偏低
- trafficScore <50: 流量获取困难

返回纯 JSON，不要其他文字。`;
}

function competitorAnalysisPrompt(ctx: AnalysisContext): string {
  const compInfo = ctx.competitors
    .slice(0, 10)
    .map((c) => {
      const pricing = ctx.monetizationSignals.find((m) => m.domain === c.domain);
      return `- ${c.domain}: ${c.description || '未知'}, 定价: ${pricing?.pricingModel || '未知'}, 价格: ${pricing?.priceRange || '未知'}`;
    })
    .join('\n');

  return `你是一位市场分析师。分析以下产品创意的竞争格局。

产品创意：${ctx.idea.title}
描述：${ctx.idea.description}

SERP 中发现的竞品：
${compInfo || '暂未发现明确竞品'}

请分析并以 JSON 格式返回：
{
  "marketStructure": "monopoly/oligopoly/fragmented/emerging",
  "topCompetitors": [{"name": "...", "domain": "...", "strengths": ["..."], "weaknesses": ["..."]}],
  "trafficChannels": [{"channel": "organic_search/paid/social/direct", "viability": "high/medium/low"}],
  "differentiationOpportunities": ["可以做的差异化方向"],
  "competitionIntensity": 0-100的竞争强度评分
}

返回纯 JSON，不要其他文字。`;
}

function monetizationPrompt(ctx: AnalysisContext): string {
  const cpcData = ctx.keywords
    .filter((k) => k.cpc && k.cpc > 0)
    .sort((a, b) => (b.cpc ?? 0) - (a.cpc ?? 0))
    .slice(0, 10)
    .map((k) => `${k.keyword}: $${k.cpc}`)
    .join(', ');

  const signals = ctx.monetizationSignals
    .slice(0, 5)
    .map((m) => `- ${m.domain}: ${m.pricingModel || '未知'}, ${m.priceRange || '未知价格'}`)
    .join('\n');

  return `你是一位商业模式专家。分析以下产品创意的变现潜力。

产品创意：${ctx.idea.title}
描述：${ctx.idea.description}

目标关键词 CPC：${cpcData || '暂无CPC数据'}

竞品变现模式：
${signals || '暂无竞品变现数据'}

请分析并以 JSON 格式返回：
{
  "recommendedModel": "subscription/one-time/freemium/ads/affiliate",
  "reasoning": "为什么推荐这种变现模式",
  "pricingStrategy": {
    "primary": "建议主力价格",
    "tiers": ["$X/mo basic", "$X/mo pro"]
  },
  "alternativeRevenue": ["其他收入来源"],
  "breakEvenTraffic": 月盈亏平衡流量,
  "monetizationScore": 0-100的变现潜力评分
}

评分标准：
- monetizationScore 90+: 高CPC(>$5)、明确付费意愿、清晰定价空间
- monetizationScore 70-89: 中等CPC($1-5)、已验证的变现模式
- monetizationScore 50-69: 低CPC或变现路径不清晰
- monetizationScore <50: 变现困难

返回纯 JSON，不要其他文字。`;
}

function strategyAnalysisPrompt(
  ctx: AnalysisContext,
  seo: SEOAnalysis,
  comp: CompetitorAnalysis
): string {
  const compSummary = comp.topCompetitors
    .slice(0, 5)
    .map((c) => `- ${c.name} (${c.domain}): 优势=[${c.strengths.join(', ')}], 弱点=[${c.weaknesses.join(', ')}]`)
    .join('\n');

  return `你是一位SaaS产品策略专家，精通五大创意发现策略和服务产品化方法论。

产品创意：${ctx.idea.title}
描述：${ctx.idea.description}
来源：${ctx.idea.source}

SEO概况：流量评分 ${seo.trafficScore}/100, 竞争水平 ${seo.competitionLevel}
竞品概况：
${compSummary || '暂无竞品数据'}
差异化机会：${comp.differentiationOpportunities.join(', ') || '暂无'}

## 分析框架

### 五大发现策略（选择最匹配的）
A. community_pain (社区痛点): 来自Reddit/HN/PH等社区的用户吐槽和需求
B. keyword_opportunity (关键词机会): 通过搜索趋势、Google Trends发现的搜索需求
C. competitor_gap (竞品洞察): 通过分析竞品1星差评、定价空白发现的机会
D. shadow_clone (暗影复刻): 改进现有成功产品——精准剪裁+痛点补洞（不是抄代码）
E. service_productization (服务产品化): 将Fiverr/Upwork等高频人工服务自动化为SaaS

### SOAP模型（服务产品化评估）
- Screen: 是否存在对标的高频人工服务（月订单300+）？
- Optimize: 服务流程能否拆解为3-5个标准步骤？
- Automate: 多少比例可以用API/AI自动化（目标80%）？
- Package: 能否包装为订阅制SaaS产品？

### 暗影复刻分析
- 最值得复刻改进的竞品是谁？
- 该竞品的具体弱点在哪？
- 如何用"极致聚焦"策略做差异化？

### 五维验证模型（每项0-10分）
1. 市场需求: 痛点强度 × 用户规模
2. 工具可行性: 能否用现有技术栈（AI API + 低代码）快速实现
3. 差异化优势: 相对竞品的独特切入点
4. 商业模式: 付费意愿 × 定价空间 × 复购率
5. 个人匹配: 独立开发者/小团队能否执行（技术+运营+获客）

请以 JSON 格式返回：
{
  "discoveryStrategy": {
    "primary": "community_pain/keyword_opportunity/competitor_gap/shadow_clone/service_productization",
    "secondary": "可选的第二策略或null",
    "reasoning": "为什么判断为该策略"
  },
  "soapEvaluation": {
    "hasExistingService": true/false,
    "serviceExamples": ["Fiverr/Upwork上的对标服务名称"],
    "processSteps": ["步骤1: ...", "步骤2: ...", "步骤3: ..."],
    "automationPotential": 0-100,
    "automationApis": ["可用的API/工具，如OpenAI API, Canva API"],
    "packagingModel": "subscription/usage-based/tiered",
    "soapScore": 0-100
  },
  "shadowClone": {
    "bestTarget": "最值得复刻的竞品名称",
    "targetWeaknesses": ["具体弱点1", "具体弱点2"],
    "differentiationAngle": "差异化切入角度",
    "cloneComplexity": "low/medium/high",
    "estimatedAdvantage": "预期能获得的竞争优势"
  },
  "fiveCircleValidation": {
    "marketDemand": 0-10,
    "toolFeasibility": 0-10,
    "differentiation": 0-10,
    "businessViability": 0-10,
    "personalFit": 0-10
  }
}

评分参考：
- soapScore 80+: 存在高频服务且80%+可自动化（如Looka之于Logo设计）
- soapScore 50-79: 有对标服务但自动化有一定挑战
- soapScore 30-49: 服务存在但自动化比例低
- soapScore <30: 无明确对标服务或难以产品化
- fiveCircleValidation: 每项≥7为优秀，≥5为及格，<5为薄弱

典型案例参考：
- Looka (SOAP 95): Fiverr Logo设计 → AI生成Logo+品牌套件
- Grammarly (SOAP 90): 人工文案校对 → 实时语法检查+写作建议
- Canva (SOAP 85): 设计师外包 → 模板化设计+拖拽编辑
- Calendly (SOAP 80): 人工预约安排 → 自动化日程协调

返回纯 JSON，不要其他文字。`;
}

function recommendationPrompt(
  ctx: AnalysisContext,
  seo: SEOAnalysis,
  comp: CompetitorAnalysis,
  monet: MonetizationAnalysis,
  strategy: StrategyAnalysis
): string {
  const strategyLabel: Record<string, string> = {
    community_pain: '社区痛点',
    keyword_opportunity: '关键词机会',
    competitor_gap: '竞品洞察',
    shadow_clone: '暗影复刻',
    service_productization: '服务产品化',
  };
  const fc = strategy.fiveCircleValidation;

  return `基于以下综合分析，生成最终可执行建议。

产品创意：${ctx.idea.title}

SEO分析：流量评分 ${seo.trafficScore}/100, 预估月流量 ${seo.estimatedMonthlyTraffic}, 难度 ${seo.seoDifficulty}/100
竞争分析：竞争强度 ${comp.competitionIntensity}/100, 市场结构 ${comp.marketStructure}
变现分析：变现评分 ${monet.monetizationScore}/100, 推荐模式 ${monet.recommendedModel}, 盈亏平衡 ${monet.breakEvenTraffic}访问/月
策略分析：发现策略=${strategyLabel[strategy.discoveryStrategy.primary] || strategy.discoveryStrategy.primary}, SOAP评分=${strategy.soapEvaluation.soapScore}/100, 自动化潜力=${strategy.soapEvaluation.automationPotential}%, 暗影复刻目标=${strategy.shadowClone.bestTarget}, 差异化=${strategy.shadowClone.differentiationAngle}
五维验证：需求${fc.marketDemand}/10, 可行性${fc.toolFeasibility}/10, 差异化${fc.differentiation}/10, 商业${fc.businessViability}/10, 匹配${fc.personalFit}/10

请以 JSON 格式返回：
{
  "verdict": "strong_go/go/cautious/skip",
  "productForm": "建议的产品形态(SaaS/工具/内容站等)",
  "mvpFeatures": ["MVP核心功能1", "MVP核心功能2", "MVP核心功能3"],
  "trafficStrategy": "流量获取策略概述",
  "monetizationPath": "变现路径概述",
  "timeToMvp": "预估MVP开发时间",
  "risks": ["风险1", "风险2"],
  "reasoning": "2-3句话总结为什么做出这个判断",
  "counterEvidence": {
    "failure_reasons": ["具体失败原因1（要具体不泛泛）", "具体失败原因2", "具体失败原因3"],
    "kill_criteria": ["可量化的终止标准1（如MVP上线3月自然流量<500/月则终止）", "终止标准2", "终止标准3"],
    "counter_arguments": ["最有力的反驳论据1", "反驳论据2"]
  },
  "verificationStatus": {
    "status": "validated/conditional/needs_evidence/skip",
    "reasoning": "综合流量、变现、执行三维度给出验证状态的理由",
    "confidence_level": 0-100的置信度
  }
}

判断标准：
- strong_go: 流量+变现+执行都很优秀，强烈建议做，verificationStatus=validated
- go: 整体良好，建议做但需注意某些方面，verificationStatus=validated或conditional
- cautious: 有机会但风险较大，建议进一步验证，verificationStatus=conditional或needs_evidence
- skip: 不建议做，流量或变现有明显硬伤，verificationStatus=skip

counterEvidence要求：必须诚实、具体、可操作，避免模糊表述。kill_criteria必须可量化。

返回纯 JSON，不要其他文字。`;
}

// =============================================================================
// Pipeline Execution
// =============================================================================

function parseJSON<T>(content: string): T | null {
  try {
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1]);
    return JSON.parse(content);
  } catch (error) {
    console.error('[V2 Pipeline] Failed to parse JSON:', error);
    return null;
  }
}

/**
 * Run the full V2 analysis pipeline for an idea
 */
export async function runV2Analysis(ideaId: string): Promise<V2AnalysisResult | null> {
  const ctx = await buildContext(ideaId);
  if (!ctx) {
    console.error(`[V2 Pipeline] Idea ${ideaId} not found`);
    return null;
  }

  console.log(`[V2 Pipeline] Starting analysis for: ${ctx.idea.title}`);

  const provider = await createAIProvider('analysis');

  // Stage 1: SEO Analysis
  console.log('[V2 Pipeline] Stage 1: SEO Analysis');
  let seo: SEOAnalysis;
  try {
    const seoResponse = await provider.callWithRetry(
      [{ role: 'user', content: seoAnalysisPrompt(ctx) }],
      ideaId,
      'seo'
    );
    seo = parseJSON<SEOAnalysis>(seoResponse) || getDefaultSEO();
  } catch (error) {
    console.warn('[V2 Pipeline] SEO analysis failed, using defaults:', error);
    seo = getDefaultSEO();
  }

  // Stage 2: Competitor Analysis
  console.log('[V2 Pipeline] Stage 2: Competitor Analysis');
  let competitor: CompetitorAnalysis;
  try {
    const compResponse = await provider.callWithRetry(
      [{ role: 'user', content: competitorAnalysisPrompt(ctx) }],
      ideaId,
      'competitor'
    );
    competitor = parseJSON<CompetitorAnalysis>(compResponse) || getDefaultCompetitor();
  } catch (error) {
    console.warn('[V2 Pipeline] Competitor analysis failed, using defaults:', error);
    competitor = getDefaultCompetitor();
  }

  // Stage 3: Monetization Analysis
  console.log('[V2 Pipeline] Stage 3: Monetization Analysis');
  let monetization: MonetizationAnalysis;
  try {
    const monetResponse = await provider.callWithRetry(
      [{ role: 'user', content: monetizationPrompt(ctx) }],
      ideaId,
      'monetization'
    );
    monetization = parseJSON<MonetizationAnalysis>(monetResponse) || getDefaultMonetization();
  } catch (error) {
    console.warn('[V2 Pipeline] Monetization analysis failed, using defaults:', error);
    monetization = getDefaultMonetization();
  }

  // Stage 4: Strategy & Productization Analysis
  console.log('[V2 Pipeline] Stage 4: Strategy Analysis');
  let strategy: StrategyAnalysis;
  try {
    const stratResponse = await provider.callWithRetry(
      [{ role: 'user', content: strategyAnalysisPrompt(ctx, seo, competitor) }],
      ideaId,
      'strategy'
    );
    strategy = parseJSON<StrategyAnalysis>(stratResponse) || getDefaultStrategy();
  } catch (error) {
    console.warn('[V2 Pipeline] Strategy analysis failed, using defaults:', error);
    strategy = getDefaultStrategy();
  }

  // Stage 5: Recommendation (enhanced with strategy context)
  console.log('[V2 Pipeline] Stage 5: Recommendation');
  let recommendation: OpportunityRecommendation;
  try {
    const recResponse = await provider.callWithRetry(
      [{ role: 'user', content: recommendationPrompt(ctx, seo, competitor, monetization, strategy) }],
      ideaId,
      'recommendation'
    );
    recommendation = parseJSON<OpportunityRecommendation>(recResponse) || getDefaultRecommendation();
  } catch (error) {
    console.warn('[V2 Pipeline] Recommendation failed, using defaults:', error);
    recommendation = getDefaultRecommendation();
  }

  // Calculate V2 scores using multiplication model
  const trafficScore = clamp(seo.trafficScore || 50);
  const monetizationScoreValue = clamp(monetization.monetizationScore || 50);
  const executionScore = clamp(100 - (competitor.competitionIntensity || 50));
  const opportunityScore = calculateOpportunityScore(
    trafficScore,
    monetizationScoreValue,
    executionScore
  );

  // Save results to database
  await db
    .update(ideas)
    .set({
      trafficScore,
      monetizationScore: monetizationScoreValue,
      executionScore,
      opportunityScore,
      aiSeoAnalysis: JSON.stringify(seo),
      aiCompetitorAnalysis: JSON.stringify(competitor),
      aiMonetizationAnalysis: JSON.stringify(monetization),
      aiStrategyAnalysis: JSON.stringify(strategy),
      aiRecommendation: JSON.stringify(recommendation),
      discoveryStrategy: strategy.discoveryStrategy.primary,
      automationPotential: strategy.soapEvaluation.automationPotential,
      estimatedTraffic: seo.estimatedMonthlyTraffic || null,
      status: 'analyzed',
      analyzedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(ideas.id, ideaId));

  console.log(
    `[V2 Pipeline] Completed: traffic=${trafficScore}, monetization=${monetizationScoreValue}, execution=${executionScore}, opportunity=${opportunityScore}, strategy=${strategy.discoveryStrategy.primary}, soap=${strategy.soapEvaluation.soapScore}`
  );

  return {
    seo,
    competitor,
    monetization,
    strategy,
    recommendation,
    trafficScore,
    monetizationScoreValue,
    executionScore,
    opportunityScore,
  };
}

// =============================================================================
// Scoring
// =============================================================================

/**
 * V2 Opportunity Score: multiplication model
 * Traffic(40%) x Monetization(35%) x Execution(25%)
 *
 * Normalized so a product scoring 70 on all three dimensions gets ~70 overall
 */
function calculateOpportunityScore(
  traffic: number,
  monetization: number,
  execution: number
): number {
  // Weighted geometric mean (equivalent to multiplication with normalization)
  const wTraffic = 0.4;
  const wMonetization = 0.35;
  const wExecution = 0.25;

  // Geometric weighted mean: product of (score^weight)
  const score =
    Math.pow(Math.max(traffic, 1) / 100, wTraffic) *
    Math.pow(Math.max(monetization, 1) / 100, wMonetization) *
    Math.pow(Math.max(execution, 1) / 100, wExecution) *
    100;

  return Math.round(clamp(score) * 100) / 100;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

// =============================================================================
// Defaults (when AI fails)
// =============================================================================

function getDefaultSEO(): SEOAnalysis {
  return {
    targetKeywords: [],
    contentStrategy: [],
    competitionLevel: 'medium',
    competitorWeaknesses: [],
    estimatedMonthlyTraffic: 0,
    seoDifficulty: 50,
    trafficScore: 50,
  };
}

function getDefaultCompetitor(): CompetitorAnalysis {
  return {
    marketStructure: 'fragmented',
    topCompetitors: [],
    trafficChannels: [],
    differentiationOpportunities: [],
    competitionIntensity: 50,
  };
}

function getDefaultMonetization(): MonetizationAnalysis {
  return {
    recommendedModel: 'freemium',
    reasoning: '默认推荐',
    pricingStrategy: { primary: 'TBD', tiers: [] },
    alternativeRevenue: [],
    breakEvenTraffic: 0,
    monetizationScore: 50,
  };
}

function getDefaultStrategy(): StrategyAnalysis {
  return {
    discoveryStrategy: {
      primary: 'keyword_opportunity',
      secondary: null,
      reasoning: 'AI 分析未能完成，默认归类为关键词机会。',
    },
    soapEvaluation: {
      hasExistingService: false,
      serviceExamples: [],
      processSteps: [],
      automationPotential: 0,
      automationApis: [],
      packagingModel: 'subscription',
      soapScore: 0,
    },
    shadowClone: {
      bestTarget: '待分析',
      targetWeaknesses: [],
      differentiationAngle: '待分析',
      cloneComplexity: 'medium',
      estimatedAdvantage: '待分析',
    },
    fiveCircleValidation: {
      marketDemand: 5,
      toolFeasibility: 5,
      differentiation: 5,
      businessViability: 5,
      personalFit: 5,
    },
  };
}

function getDefaultRecommendation(): OpportunityRecommendation {
  return {
    verdict: 'cautious',
    productForm: 'TBD',
    mvpFeatures: [],
    trafficStrategy: '',
    monetizationPath: '',
    timeToMvp: 'TBD',
    risks: ['数据不足，需进一步验证'],
    reasoning: 'AI 分析未能完成，建议手动验证。',
    counterEvidence: {
      failure_reasons: ['数据不足，无法给出具体失败分析'],
      kill_criteria: ['需先完成 AI 分析才能设定终止标准'],
      counter_arguments: ['当前证据不足以做出判断'],
    },
    verificationStatus: {
      status: 'needs_evidence',
      reasoning: 'AI 分析未能完成，需要手动验证。',
      confidence_level: 0,
    },
  };
}
