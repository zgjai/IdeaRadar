import type { CollectedIdea } from './types';

// --- Signal Pattern Definitions ---

interface SignalPattern {
  pattern: RegExp;
  weight: number; // 1-10, higher = stronger signal
  category: 'pain' | 'demand' | 'payment' | 'launch' | 'opportunity';
}

const SIGNAL_PATTERNS: SignalPattern[] = [
  // Pain points (weight 7-9)
  { pattern: /\b(frustrated|frustrating)\b/i, weight: 8, category: 'pain' },
  { pattern: /\bhate\b/i, weight: 7, category: 'pain' },
  { pattern: /\b(broken|terrible|awful|horrible)\b/i, weight: 8, category: 'pain' },
  { pattern: /\b(annoying|annoyed)\b/i, weight: 7, category: 'pain' },
  { pattern: /wish there (was|were)|wish (i|we) (had|could)/i, weight: 9, category: 'pain' },
  { pattern: /\b(sucks|nightmare|pain point|painpoint)\b/i, weight: 7, category: 'pain' },
  { pattern: /\b(struggle|struggling) (with|to)\b/i, weight: 7, category: 'pain' },
  { pattern: /sick (of|and tired)/i, weight: 7, category: 'pain' },
  { pattern: /can't (believe|stand) (there'?s no|how bad)/i, weight: 8, category: 'pain' },

  // Explicit demand (weight 8-10)
  { pattern: /looking for\b/i, weight: 9, category: 'demand' },
  { pattern: /alternative to\b/i, weight: 10, category: 'demand' },
  { pattern: /better than\b/i, weight: 9, category: 'demand' },
  { pattern: /instead of\b/i, weight: 8, category: 'demand' },
  { pattern: /\b(i need|we need)\b/i, weight: 9, category: 'demand' },
  { pattern: /anyone know\b|anyone recommend/i, weight: 9, category: 'demand' },
  { pattern: /\brecommend\s+(a|an|any|some)\b/i, weight: 8, category: 'demand' },
  { pattern: /does anyone (have|use|know)/i, weight: 8, category: 'demand' },
  { pattern: /has anyone (tried|used|found)/i, weight: 8, category: 'demand' },
  { pattern: /what (tool|app|software|service|platform) do you/i, weight: 9, category: 'demand' },
  { pattern: /\bswitched from\b/i, weight: 8, category: 'demand' },
  { pattern: /\bmoved away from\b/i, weight: 8, category: 'demand' },

  // Payment intent (weight 9-10)
  { pattern: /i'?d pay/i, weight: 10, category: 'payment' },
  { pattern: /worth paying/i, weight: 10, category: 'payment' },
  { pattern: /take my money/i, weight: 10, category: 'payment' },
  { pattern: /shut up and take/i, weight: 10, category: 'payment' },
  { pattern: /willing to pay/i, weight: 10, category: 'payment' },
  { pattern: /\$\d+\s*\/?\/?\s*(mo|month|yr|year|m)\b/i, weight: 9, category: 'payment' },
  { pattern: /pricing (is|seems) (insane|crazy|too high|ridiculous)/i, weight: 9, category: 'payment' },
  { pattern: /\bpay for (a|an|this|that|better)\b/i, weight: 9, category: 'payment' },

  // Product launch signals (weight 6-8)
  { pattern: /\b(i built|i made|i created|we built|we made)\b/i, weight: 8, category: 'launch' },
  { pattern: /\bjust launched\b/i, weight: 8, category: 'launch' },
  { pattern: /\bshow hn\b/i, weight: 8, category: 'launch' },
  { pattern: /\bside project\b/i, weight: 7, category: 'launch' },
  { pattern: /\b(feedback wanted|looking for feedback)\b/i, weight: 6, category: 'launch' },
  { pattern: /\b(check out|please try)\b/i, weight: 5, category: 'launch' },
  { pattern: /\bopen source[d]?\b/i, weight: 6, category: 'launch' },
  { pattern: /\blaunch(ed|ing)?\s+(my|our|the)\b/i, weight: 7, category: 'launch' },

  // Opportunity signals (weight 7-9)
  { pattern: /no good (solution|tool|option|alternative)/i, weight: 9, category: 'opportunity' },
  { pattern: /missing feature/i, weight: 8, category: 'opportunity' },
  { pattern: /gap in (the )?(market|space)/i, weight: 9, category: 'opportunity' },
  { pattern: /\b(underserved|overlooked|untapped)\b/i, weight: 8, category: 'opportunity' },
  { pattern: /surprised (there|that) (isn'?t|is no|are no)/i, weight: 8, category: 'opportunity' },
  { pattern: /why (isn'?t|doesn'?t|hasn'?t) (there|anyone)/i, weight: 8, category: 'opportunity' },
  { pattern: /nobody (has|is) (built|building|made|making)/i, weight: 7, category: 'opportunity' },
  { pattern: /\bmarket opportunity\b/i, weight: 7, category: 'opportunity' },
  { pattern: /\bniche\b/i, weight: 5, category: 'opportunity' },
];

// --- Types ---

export interface DemandSignalResult {
  score: number; // 0-100
  matchedSignals: Array<{
    text: string;
    category: string;
    weight: number;
  }>;
  categoryBreakdown: Record<string, number>;
}

// --- Scoring ---

export function scoreDemandSignals(
  title: string,
  description: string
): DemandSignalResult {
  // Combine and truncate to avoid performance issues on very long text
  const combined = `${title} ${description}`.slice(0, 5000).toLowerCase();
  const titleLower = title.toLowerCase();

  const matchedSignals: DemandSignalResult['matchedSignals'] = [];
  const categoryBreakdown: Record<string, number> = {};

  for (const signal of SIGNAL_PATTERNS) {
    const match = combined.match(signal.pattern);
    if (match) {
      matchedSignals.push({
        text: match[0],
        category: signal.category,
        weight: signal.weight,
      });
      categoryBreakdown[signal.category] =
        (categoryBreakdown[signal.category] || 0) + 1;
    }
  }

  if (matchedSignals.length === 0) {
    return { score: 0, matchedSignals: [], categoryBreakdown: {} };
  }

  // Sum weights
  let rawScore = 0;
  for (const m of matchedSignals) {
    rawScore += m.weight;
  }

  // Multi-category bonus: +20% if signals from 3+ categories
  const categoryCount = Object.keys(categoryBreakdown).length;
  if (categoryCount >= 3) {
    rawScore *= 1.2;
  }

  // Payment intent super-boost: +30%
  if (categoryBreakdown.payment) {
    rawScore *= 1.3;
  }

  // Title visibility bonus: +20% if any signal appears in title
  const titleHasSignal = SIGNAL_PATTERNS.some((s) => s.pattern.test(titleLower));
  if (titleHasSignal) {
    rawScore *= 1.2;
  }

  // Normalize to 0-100 (50 raw = 100 normalized)
  const normalized = Math.min(Math.round((rawScore / 50) * 100), 100);

  return {
    score: normalized,
    matchedSignals,
    categoryBreakdown,
  };
}

// --- Thresholds ---

export const SOURCE_THRESHOLDS: Record<string, number> = {
  hackernews: 20,
  reddit: 15,
  producthunt: 10,
};

export const DEFAULT_SIGNAL_THRESHOLD = 20;

// --- Helpers ---

export function enrichWithSignals(idea: CollectedIdea): CollectedIdea {
  const signals = scoreDemandSignals(idea.title, idea.description);
  return {
    ...idea,
    metadata: {
      ...idea.metadata,
      demandSignalScore: signals.score,
      demandSignals: signals.matchedSignals,
      demandCategories: signals.categoryBreakdown,
    },
  };
}

export function shouldKeepIdea(
  idea: CollectedIdea,
  threshold?: number
): boolean {
  const result = scoreDemandSignals(idea.title, idea.description);
  const effectiveThreshold =
    threshold ?? SOURCE_THRESHOLDS[idea.source] ?? DEFAULT_SIGNAL_THRESHOLD;
  return result.score >= effectiveThreshold;
}
