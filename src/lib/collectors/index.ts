import { db } from '../db';
import { ideas, collectionLogs, settings } from '../db/schema';
import { generateId } from '../utils';
import { collectHackerNews } from './hackernews';
import { collectProductHunt } from './producthunt';
import { collectGoogleTrends } from './googletrends';
import { collectReddit } from './reddit';
import { collectGitHub } from './github';
import type { CollectedIdea, CollectorResult } from './types';
import { eq } from 'drizzle-orm';

interface CollectionSummary {
  total: number;
  new: number;
  duplicate: number;
  failed: number;
  sources: Array<{
    source: string;
    items: number;
    duration: number;
    errors: string[];
  }>;
}

// --- Settings check ---

const SOURCE_DEFAULTS: Record<string, boolean> = {
  hackernews: true,
  producthunt: false,
  googleTrends: false,
  reddit: false,
  github: false,
};

async function isSourceEnabled(source: string): Promise<boolean> {
  try {
    const key = `sources.${source}.enabled`;
    const setting = await db.query.settings.findFirst({
      where: eq(settings.key, key),
    });
    if (!setting) return SOURCE_DEFAULTS[source] ?? false;
    return setting.value === 'true';
  } catch {
    return SOURCE_DEFAULTS[source] ?? false;
  }
}

// --- Save & process ---

async function saveIdea(item: CollectedIdea): Promise<'new' | 'duplicate'> {
  try {
    // Check if URL already exists
    const existing = await db.query.ideas.findFirst({
      where: (ideas, { eq }) => eq(ideas.url, item.url),
    });

    if (existing) {
      return 'duplicate';
    }

    // Insert new idea
    await db.insert(ideas).values({
      id: generateId(),
      title: item.title,
      description: item.description,
      url: item.url,
      source: item.source,
      sourceId: item.sourceId,
      sourceScore: item.sourceScore,
      sourceComments: item.sourceComments,
      discoveredAt: item.discoveredAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return 'new';
  } catch (error) {
    console.error('Failed to save idea:', error);
    throw error;
  }
}

async function processCollectorResult(result: CollectorResult): Promise<{
  new: number;
  duplicate: number;
  failed: number;
}> {
  let newCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;

  for (const item of result.items) {
    try {
      const status = await saveIdea(item);
      if (status === 'new') {
        newCount++;
      } else {
        duplicateCount++;
      }
    } catch (error) {
      failedCount++;
      console.error(`Failed to save idea from ${result.source}:`, error);
    }
  }

  return { new: newCount, duplicate: duplicateCount, failed: failedCount };
}

async function logCollection(result: CollectorResult, counts: { new: number; failed: number }) {
  const status =
    counts.failed === 0
      ? 'success'
      : counts.new > 0
        ? 'partial'
        : 'failed';

  await db.insert(collectionLogs).values({
    source: result.source,
    status,
    itemsCount: counts.new,
    errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
    startedAt: new Date(Date.now() - result.duration).toISOString(),
    completedAt: new Date().toISOString(),
  });
}

// --- Main orchestrator ---

export async function collectAll(): Promise<CollectionSummary> {
  console.log('Starting collection from all sources...');

  // Check which sources are enabled
  const [hnEnabled, phEnabled, gtEnabled, redditEnabled, githubEnabled] = await Promise.all([
    isSourceEnabled('hackernews'),
    isSourceEnabled('producthunt'),
    isSourceEnabled('googleTrends'),
    isSourceEnabled('reddit'),
    isSourceEnabled('github'),
  ]);

  // Build array of enabled collectors
  const collectors: Promise<CollectorResult>[] = [];
  if (hnEnabled) collectors.push(collectHackerNews());
  if (phEnabled) collectors.push(collectProductHunt());
  if (gtEnabled) collectors.push(collectGoogleTrends());
  if (redditEnabled) collectors.push(collectReddit());
  if (githubEnabled) collectors.push(collectGitHub());

  const enabledNames = [
    hnEnabled && 'HN',
    phEnabled && 'PH',
    gtEnabled && 'GT',
    redditEnabled && 'Reddit',
    githubEnabled && 'GitHub',
  ].filter(Boolean);

  console.log(`Running ${collectors.length} enabled collectors: ${enabledNames.join(', ')}`);

  if (collectors.length === 0) {
    console.log('No collectors enabled. Enable at least one source in Settings.');
    return { total: 0, new: 0, duplicate: 0, failed: 0, sources: [] };
  }

  // Run collectors in parallel
  const results = await Promise.allSettled(collectors);

  const summary: CollectionSummary = {
    total: 0,
    new: 0,
    duplicate: 0,
    failed: 0,
    sources: [],
  };

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Collector failed:', result.reason);
      continue;
    }

    const collectorResult = result.value;
    const counts = await processCollectorResult(collectorResult);

    summary.total += collectorResult.items.length;
    summary.new += counts.new;
    summary.duplicate += counts.duplicate;
    summary.failed += counts.failed;

    summary.sources.push({
      source: collectorResult.source,
      items: counts.new,
      duration: collectorResult.duration,
      errors: collectorResult.errors,
    });

    // Log to database
    await logCollection(collectorResult, counts);
  }

  console.log(`Collection complete: ${summary.new} new ideas, ${summary.duplicate} duplicates`);

  return summary;
}
