export interface CollectedIdea {
  title: string;
  description: string;
  url: string;
  source: 'hackernews' | 'producthunt' | 'google_trends' | 'reddit' | 'github';
  sourceId: string;
  sourceScore: number;
  sourceComments: number;
  discoveredAt: string;
  metadata?: Record<string, unknown>;
}

export interface CollectorResult {
  source: string;
  items: CollectedIdea[];
  errors: string[];
  duration: number;
}
