export function screeningPrompt(
  title: string,
  description: string,
  source: string,
  score: number
): string {
  return `You are an expert product analyst evaluating startup ideas.

Analyze this idea from ${source} (score: ${score}):

Title: ${title}
Description: ${description}

Provide a quick screening assessment in valid JSON format:

{
  "category": "one of: SaaS, Mobile App, Web App, API/Platform, Developer Tools, E-commerce, MarketPlace, Content/Media, Hardware, Other",
  "targetUsers": "brief description of primary target users",
  "problemDomain": "brief description of problem space (e.g., 'productivity', 'developer tools', 'healthcare')",
  "innovationScore": <number 0-100 indicating novelty and innovation>,
  "summary": "one-sentence summary of what this product does"
}

Return ONLY valid JSON, no other text.`;
}

export function deepAnalysisPrompt(
  title: string,
  description: string,
  commentsSummary?: string,
  trendData?: string
): string {
  const commentsSection = commentsSummary
    ? `\nUser Comments/Feedback:\n${commentsSummary}`
    : '';
  const trendsSection = trendData ? `\nTrend Data:\n${trendData}` : '';

  return `You are an expert product strategist and investor evaluating startup ideas for viability.

Analyze this product idea in depth:

Title: ${title}
Description: ${description}${commentsSection}${trendsSection}

Provide a comprehensive analysis in valid JSON format:

{
  "painPoint": "clear description of the pain point this solves",
  "painPointIntensity": <number 0-100, how severe/urgent is this pain?>,
  "targetUsers": "detailed description of target user segments",
  "marketSize": "large" | "medium" | "small",
  "coreFeatures": ["feature 1", "feature 2", "feature 3"],
  "competitors": ["competitor 1", "competitor 2", "or 'none identified'"],
  "differentiationSpace": "how this could differentiate from competitors",
  "techFeasibility": <number 0-100, technical difficulty/feasibility>,
  "mvpEstimateWeeks": <number, estimated weeks to build MVP>,
  "demandScore": <number 0-100, market demand potential>,
  "competitionScore": <number 0-100, competitive landscape favorability>,
  "feasibilityScore": <number 0-100, technical + resource feasibility>,
  "growthScore": <number 0-100, potential for rapid growth>,
  "recommendation": "Go" | "Cautious" | "Stop",
  "reasoning": "2-3 sentence explanation of recommendation"
}

Scoring guidelines:
- demandScore: Higher = stronger market demand and user pain
- competitionScore: Higher = less competition, more opportunity
- feasibilityScore: Higher = easier to build and execute
- growthScore: Higher = better potential for viral growth and scaling

Return ONLY valid JSON, no other text.`;
}
