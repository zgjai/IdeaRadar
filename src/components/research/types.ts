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
  fiveDimensionalScores?: {
    demand_score: number;
    pain_score: number;
    pay_score: number;
    build_fit_score: number;
    competition_risk_score: number;
  };
  evidenceFramework?: {
    help_seeking: { signals: string[]; strength: string; examples: string[] };
    alternative_seeking: { signals: string[]; strength: string; examples: string[] };
    complaints: { signals: string[]; strength: string; examples: string[] };
    transaction_intent: { signals: string[]; strength: string; examples: string[] };
    coverage_summary: string;
  };
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
  verificationStatus?: {
    status: string;
    reasoning: string;
    confidence_level: number;
    evidence_gaps: string[];
  };
  featureMatrix?: {
    core: Array<{ name: string; description: string; tier: string; quality: string }>;
    unique: string[];
    integrations: string[];
    apiAvailability: string;
    featureGaps: string[];
  };
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
  buildRecommendations?: {
    lessonsToLearn: string[];
    gapsToExploit: string[];
    differentiationStrategy: string;
    mvpFeatures: string[];
    techRecommendations: string[];
    goToMarket: string[];
  };
  confidenceAssessment?: {
    highConfidence: string[];
    needsVerification: string[];
  };
  overallRating: number;
  summary: string;
}

export interface ResearchRecord {
  id: number;
  url: string;
  domain: string;
  title: string;
  status: string;
  createdAt: string;
}

export interface ResearchDetail extends ResearchRecord {
  aiAnalysis: SiteAnalysis | null;
  errorMessage: string | null;
}
