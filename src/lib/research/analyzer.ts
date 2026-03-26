/**
 * AI-powered site analysis: sends crawled content to LLM for comprehensive analysis
 */
import { createAIProvider } from '../ai/provider';
import type { CrawlResult } from './crawler';

export interface SiteAnalysis {
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
  // Five-dimensional market validation scores (0-10 each)
  fiveDimensionalScores?: {
    demand_score: number;
    pain_score: number;
    pay_score: number;
    build_fit_score: number;
    competition_risk_score: number;
  };
  // Four-route evidence framework
  evidenceFramework?: {
    help_seeking: {
      signals: string[];
      strength: 'strong' | 'moderate' | 'weak' | 'none';
      examples: string[];
    };
    alternative_seeking: {
      signals: string[];
      strength: 'strong' | 'moderate' | 'weak' | 'none';
      examples: string[];
    };
    complaints: {
      signals: string[];
      strength: 'strong' | 'moderate' | 'weak' | 'none';
      examples: string[];
    };
    transaction_intent: {
      signals: string[];
      strength: 'strong' | 'moderate' | 'weak' | 'none';
      examples: string[];
    };
    coverage_summary: string;
  };
  // Counter-evidence & kill criteria
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
  // Soft-gate verification status
  verificationStatus?: {
    status: 'validated' | 'conditional' | 'needs_evidence' | 'skip';
    reasoning: string;
    confidence_level: number;
    evidence_gaps: string[];
  };
  // Feature Matrix (detailed feature inventory with tiers and quality ratings)
  featureMatrix?: {
    core: Array<{ name: string; description: string; tier: string; quality: string }>;
    unique: string[];
    integrations: string[];
    apiAvailability: string;
    featureGaps: string[];
  };
  // User Scenario Analysis (personas + Jobs-to-be-Done)
  userScenarios?: {
    personas: Array<{
      name: string;
      role: string;
      goals: string[];
      painPoints: string[];
      journey: string;
      delightMoments: string[];
    }>;
    jobsToBeDone: string[];
  };
  // Build Recommendations (actionable advice for entrepreneurs)
  buildRecommendations?: {
    lessonsToLearn: string[];
    gapsToExploit: string[];
    differentiationStrategy: string;
    mvpFeatures: string[];
    techRecommendations: string[];
    goToMarket: string[];
  };
  // Confidence Assessment (per-section reliability)
  confidenceAssessment?: {
    highConfidence: string[];
    needsVerification: string[];
  };
  overallRating: number; // 1-10
  summary: string;
}

/**
 * Build the prompt with crawled content
 */
function buildPrompt(crawl: CrawlResult): string {
  let pagesContent = '';
  for (const page of crawl.pages) {
    pagesContent += `\n\n--- 页面: ${page.path} (${page.title}) [提取方式: ${page.extractionMethod}] ---\n${page.markdown}`;
  }

  // Truncate total content to fit in context window
  if (pagesContent.length > 40000) {
    pagesContent = pagesContent.slice(0, 40000) + '\n...(内容截断)';
  }

  // Build metadata section
  const meta = crawl.metadata;
  let metaSection = '';
  if (crawl.description) {
    metaSection += `网站描述: ${crawl.description}\n`;
  }
  if (meta.siteName) {
    metaSection += `站点名称: ${meta.siteName}\n`;
  }
  if (meta.techSignals.length > 0) {
    metaSection += `检测到的技术栈: ${meta.techSignals.join(', ')}\n`;
  }
  if (meta.jsonLd && meta.jsonLd.length > 0) {
    const jsonLdSummary = meta.jsonLd
      .map((item) => `${item['@type'] || 'Unknown'}: ${item.name || item.headline || ''}`)
      .filter(Boolean)
      .join('; ');
    if (jsonLdSummary) {
      metaSection += `结构化数据: ${jsonLdSummary}\n`;
    }
  }

  return `你是一位资深的产品分析师和市场研究专家。请对以下网站进行全面、深入的分析。

目标网站: ${crawl.url}
域名: ${crawl.domain}
网站标题: ${crawl.title}
抓取到的页面数: ${crawl.pages.length}
总提取文本长度: ${crawl.totalTextLength} 字符
${metaSection}
== 网站内容（Markdown 格式） ==
${pagesContent}

== 分析要求 ==

请从以下 11 个维度进行系统性分析，从整体到细节，要求具体、有洞察力，避免泛泛而谈：

1. **产品概览** - 这个网站/产品是什么？解决什么问题？核心价值主张是什么？属于什么类别？
2. **产品设计分析** - 核心功能列表、用户使用流程、技术栈（结合检测到的技术信号）、设计风格、产品设计亮点
3. **用户画像** - 主要目标用户、次要用户群、使用场景、用户需求、用户旅程
4. **商业模式** - 变现方式、定价策略、收入来源、市场规模判断
5. **优势分析** - 列出 3-5 个具体优势，说明为什么是优势
6. **劣势分析** - 列出 3-5 个具体不足，说明影响和改进方向
7. **市场机会** - 可借鉴之处、市场空白点、对创业者的启发

8. **五维市场验证评分** - 为以下每个维度独立打分（0-10），不合并为总分：
   - demand_score（需求强度）：9-10=高频刚需大量搜索，7-8=中高频有明确场景，4-6=存在但不紧迫，1-3=低频或伪需求
   - pain_score（痛点强度）：9-10=严重影响效率用户急需解决，7-8=明显痛点愿意尝试方案，4-6=有不便但可接受，1-3=轻微不满
   - pay_score（付费意愿）：9-10=高客单价(>$100/月)已验证，7-8=中等($20-100/月)有先例，4-6=低价或freemium，1-3=难以变现
   - build_fit_score（开发可行性）：9-10=2-4周MVP无特殊需求，7-8=1-3月中等复杂度，4-6=3-6月需专业技能，1-3=需大团队或特殊资源
   - competition_risk_score（竞争风险）：9-10=红海寡头垄断，7-8=激烈但有差异化空间，4-6=分散无绝对领导者，1-3=蓝海或新兴赛道

9. **四路证据框架** - 从网站内容中寻找以下 4 类需求信号：
   a) 求助信号（help_seeking）：用户是否在主动寻求解决方案？有"如何""怎么""求推荐"等表述？
   b) 替代信号（alternative_seeking）：用户是否寻找替代品？提到"XX的替代""更好的XX""从XX迁移"？
   c) 吐槽信号（complaints）：用户对现状有哪些不满？负面评价、功能缺失、体验问题？
   d) 交易信号（transaction_intent）：有定价信息？付费计划？用户询价或表达付费意愿？
   每类提供：信号列表、强度(strong/moderate/weak/none)、2-3个具体例子，最后总结覆盖度。

10. **反证与终止标准**（魔鬼代言人视角，必须诚实具体）：
    a) 失败原因（3-5条）：这个产品可能失败的具体原因，避免泛泛而谈
    b) 终止标准（Kill Criteria，3-5条）：遇到什么情况应果断放弃，要可量化
    c) 反驳论据：哪些事实最可能推翻这个机会的成立
    d) 验证计划：下一步做什么来验证假设，关键假设列表，建议验证时间表

11. **验证状态判定** - 综合以上分析给出状态：
    - "validated"：多数维度>=7分，3+路证据strong/moderate，机会大于风险
    - "conditional"：有亮点但需满足特定条件，证据覆盖不全但关键路径有支撑
    - "needs_evidence"：信号模糊缺乏关键证据，多数<6分，需进一步调研
    - "skip"：明确硬伤，反证强于正面论据
    给出状态、理由、置信度(0-100)、证据缺口列表。

12. **功能矩阵（Feature Matrix）** - 详细的功能清单：
    a) 核心功能列表：每个功能包含名称、简短描述、所属层级（Free/Pro/Enterprise）、质量评级（A/B/C/D）
    b) 差异化功能：竞争对手没有的独特功能
    c) 集成生态：支持哪些第三方工具集成
    d) API 可用性：是否提供 API、文档质量如何
    e) 功能缺口：明显缺少的功能或限制

13. **用户场景分析（User Scenario Analysis）** - 基于产品实际目标用户：
    a) 定义 3-4 个用户画像（Persona）：每个包含名称、角色、目标、痛点、使用旅程、惊喜时刻
    b) Jobs-to-be-Done：这个产品帮用户完成的 3-5 个核心任务

14. **创业者行动建议（Build Recommendations）** - 如果你要做一个竞品，应该怎么做：
    a) 值得学习的优点（3-5条）
    b) 可利用的弱点/空白（3-5条）
    c) 差异化策略：如何在市场中差异化定位
    d) MVP 功能集：建议最小可行产品包含哪些功能
    e) 技术建议：推荐的技术栈和架构方向
    f) 市场进入策略（Go-to-Market）：如何获取第一批用户

15. **分析置信度** - 对以上各维度分析的可靠性做自我评估：
    a) 高置信度：哪些结论有充分网站内容支撑
    b) 需进一步验证：哪些结论是基于推测或信息不足

最后给出一个 1-10 的总体评分和一段 100 字以内的总结。

请严格按以下 JSON 格式输出（不要包含 markdown 代码块标记）：

{
  "overview": {
    "name": "产品名称",
    "oneLiner": "一句话描述",
    "category": "产品类别",
    "coreValue": "核心价值主张",
    "problemSolved": "解决的核心问题"
  },
  "productDesign": {
    "coreFeatures": ["功能1", "功能2", "功能3"],
    "userFlow": "主要用户使用流程描述",
    "techStackGuess": ["技术1", "技术2"],
    "designStyle": "设计风格描述",
    "highlights": ["设计亮点1", "设计亮点2"]
  },
  "userPersona": {
    "primaryAudience": "主要目标用户",
    "secondaryAudience": "次要用户群",
    "useCases": ["场景1", "场景2"],
    "userNeeds": ["需求1", "需求2"],
    "userJourney": "用户旅程描述"
  },
  "businessModel": {
    "monetization": "主要变现方式",
    "pricingStrategy": "定价策略",
    "revenueStreams": ["收入来源1", "收入来源2"],
    "marketSize": "市场规模判断"
  },
  "strengths": ["优势1：具体说明", "优势2：具体说明"],
  "weaknesses": ["劣势1：具体说明", "劣势2：具体说明"],
  "opportunities": {
    "marketGaps": ["市场空白1", "市场空白2"],
    "improvements": ["改进方向1", "改进方向2"],
    "inspirations": ["创业启发1", "创业启发2"]
  },
  "fiveDimensionalScores": {
    "demand_score": 8,
    "pain_score": 7,
    "pay_score": 6,
    "build_fit_score": 9,
    "competition_risk_score": 5
  },
  "evidenceFramework": {
    "help_seeking": {
      "signals": ["信号描述1", "信号描述2"],
      "strength": "strong",
      "examples": ["具体例子1", "具体例子2"]
    },
    "alternative_seeking": {
      "signals": ["信号描述"],
      "strength": "moderate",
      "examples": ["具体例子"]
    },
    "complaints": {
      "signals": ["信号描述"],
      "strength": "strong",
      "examples": ["具体例子"]
    },
    "transaction_intent": {
      "signals": ["信号描述"],
      "strength": "strong",
      "examples": ["具体例子"]
    },
    "coverage_summary": "覆盖度总结：哪些路径有强证据，哪些缺失"
  },
  "counterEvidence": {
    "failure_reasons": ["具体失败原因1", "具体失败原因2", "具体失败原因3"],
    "kill_criteria": ["可量化的终止标准1", "可量化的终止标准2", "可量化的终止标准3"],
    "counter_arguments": ["最有力的反驳论据1", "最有力的反驳论据2"],
    "validation_plan": {
      "next_steps": ["验证行动1", "验证行动2", "验证行动3"],
      "critical_assumptions": ["关键假设1", "关键假设2"],
      "timeline": "建议验证时间表"
    }
  },
  "verificationStatus": {
    "status": "conditional",
    "reasoning": "判定理由",
    "confidence_level": 65,
    "evidence_gaps": ["证据缺口1", "证据缺口2"]
  },
  "featureMatrix": {
    "core": [
      {"name": "功能名", "description": "描述", "tier": "Free/Pro/Enterprise", "quality": "A/B/C/D"}
    ],
    "unique": ["独特功能1", "独特功能2"],
    "integrations": ["集成1", "集成2"],
    "apiAvailability": "API 可用性描述",
    "featureGaps": ["缺失功能1", "缺失功能2"]
  },
  "userScenarios": {
    "personas": [
      {
        "name": "用户画像名称",
        "role": "角色描述",
        "goals": ["目标1", "目标2"],
        "painPoints": ["痛点1", "痛点2"],
        "journey": "使用旅程描述",
        "delightMoments": ["惊喜时刻1"]
      }
    ],
    "jobsToBeDone": ["核心任务1", "核心任务2", "核心任务3"]
  },
  "buildRecommendations": {
    "lessonsToLearn": ["值得学习1", "值得学习2"],
    "gapsToExploit": ["可利用空白1", "可利用空白2"],
    "differentiationStrategy": "差异化策略描述",
    "mvpFeatures": ["MVP功能1", "MVP功能2", "MVP功能3"],
    "techRecommendations": ["技术建议1", "技术建议2"],
    "goToMarket": ["GTM策略1", "GTM策略2"]
  },
  "confidenceAssessment": {
    "highConfidence": ["高置信度结论1", "高置信度结论2"],
    "needsVerification": ["需验证结论1", "需验证结论2"]
  },
  "overallRating": 8,
  "summary": "总结文字"
}`;
}

/**
 * Parse AI response, stripping markdown code fences if present
 */
function parseAIResponse(content: string): SiteAnalysis {
  let cleaned = content.trim();

  // Strip markdown code fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fallback: extract JSON object from mixed text+JSON response
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch {
        // fall through to error
      }
    }

    console.error(`[SiteResearch] JSON parse failed. Response length: ${content.length}, first 200 chars: "${content.slice(0, 200)}", last 100 chars: "${content.slice(-100)}"`);
    throw new Error(`AI 返回的内容不是有效 JSON（响应长度: ${content.length}字符）。请在设置中尝试更换分析模型。`);
  }
}

/**
 * Run AI analysis on crawled site content
 */
export async function analyzeSite(crawl: CrawlResult): Promise<SiteAnalysis> {
  const provider = await createAIProvider('analysis');
  const prompt = buildPrompt(crawl);

  const response = await provider.callWithRetry(
    [
      { role: 'system', content: '你是一位专业的产品分析师，擅长竞品分析和市场调研。请用中文回答，直接输出 JSON 对象，不要包含任何其他文字说明。' },
      { role: 'user', content: prompt },
    ],
    undefined,
    'site-research',
    3,
    true // jsonMode: force JSON output via response_format
  );

  return parseAIResponse(response);
}
