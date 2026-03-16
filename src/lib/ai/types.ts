export interface AIProviderConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'openrouter' | 'custom';
  model: string;
  apiKey: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIModelConfig {
  screening: AIProviderConfig;
  analysis: AIProviderConfig;
}

export interface AnalysisResult {
  category: string;
  targetUsers: string;
  problemDomain: string;
  innovationScore: number;
  summary: string;
}

export interface DeepAnalysisResult {
  painPoint: string;
  painPointIntensity: number;
  targetUsers: string;
  marketSize: 'large' | 'medium' | 'small';
  coreFeatures: string[];
  competitors: string[];
  differentiationSpace: string;
  techFeasibility: number;
  mvpEstimateWeeks: number;
  demandScore: number;
  competitionScore: number;
  feasibilityScore: number;
  growthScore: number;
  recommendation: 'Go' | 'Cautious' | 'Stop';
  reasoning: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}
