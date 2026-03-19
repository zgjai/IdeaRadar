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

请从以下 7 个维度进行系统性分析，从整体到细节，要求具体、有洞察力，避免泛泛而谈：

1. **产品概览** - 这个网站/产品是什么？解决什么问题？核心价值主张是什么？属于什么类别？
2. **产品设计分析** - 核心功能列表、用户使用流程、技术栈（结合检测到的技术信号）、设计风格、产品设计亮点
3. **用户画像** - 主要目标用户、次要用户群、使用场景、用户需求、用户旅程
4. **商业模式** - 变现方式、定价策略、收入来源、市场规模判断
5. **优势分析** - 列出 3-5 个具体优势，说明为什么是优势
6. **劣势分析** - 列出 3-5 个具体不足，说明影响和改进方向
7. **市场机会** - 可借鉴之处、市场空白点、对创业者的启发

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
  return JSON.parse(cleaned);
}

/**
 * Run AI analysis on crawled site content
 */
export async function analyzeSite(crawl: CrawlResult): Promise<SiteAnalysis> {
  const provider = await createAIProvider('analysis');
  const prompt = buildPrompt(crawl);

  const response = await provider.callWithRetry(
    [
      { role: 'system', content: '你是一位专业的产品分析师，擅长竞品分析和市场调研。请用中文回答，输出严格的 JSON 格式。' },
      { role: 'user', content: prompt },
    ],
    undefined,
    'site-research'
  );

  return parseAIResponse(response);
}
