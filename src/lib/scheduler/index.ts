import cron from 'node-cron';
import { collectAll } from '../collectors';
import { analyzer } from '../ai/analyzer';
import { rankAllIdeas } from '../scoring/engine';

let collectionJob: ReturnType<typeof cron.schedule> | null = null;
let analysisJob: ReturnType<typeof cron.schedule> | null = null;

/**
 * Collection job - runs every 6 hours by default
 */
async function runCollectionJob() {
  console.log('[Scheduler] Starting collection job...');
  try {
    const summary = await collectAll();
    console.log(`[Scheduler] Collection complete: ${summary.new} new ideas`);

    // Update scores for new ideas
    if (summary.new > 0) {
      await rankAllIdeas();
    }
  } catch (error) {
    console.error('[Scheduler] Collection job failed:', error);
  }
}

/**
 * Analysis job - runs every hour by default
 */
async function runAnalysisJob() {
  console.log('[Scheduler] Starting analysis job...');
  try {
    const result = await analyzer.analyzeUnanalyzed('all', 5);
    console.log(`[Scheduler] Analysis complete: ${result.message}`);

    // Update scores after analysis
    if (result.analyzed > 0) {
      await rankAllIdeas();
    }
  } catch (error) {
    console.error('[Scheduler] Analysis job failed:', error);
  }
}

/**
 * Start the scheduler with configurable intervals
 */
export function startScheduler(options?: {
  collectInterval?: string;
  analyzeInterval?: string;
}) {
  const collectInterval = options?.collectInterval || process.env.COLLECT_INTERVAL || '0 */6 * * *'; // Every 6 hours
  const analyzeInterval = options?.analyzeInterval || process.env.ANALYZE_INTERVAL || '0 * * * *'; // Every hour

  // Validate cron expressions
  if (!cron.validate(collectInterval)) {
    console.error(`[Scheduler] Invalid collect interval: ${collectInterval}`);
    return false;
  }

  if (!cron.validate(analyzeInterval)) {
    console.error(`[Scheduler] Invalid analyze interval: ${analyzeInterval}`);
    return false;
  }

  // Stop existing jobs if running
  stopScheduler();

  // Start collection job
  collectionJob = cron.schedule(collectInterval, runCollectionJob, {
    timezone: 'UTC',
  });

  // Start analysis job
  analysisJob = cron.schedule(analyzeInterval, runAnalysisJob, {
    timezone: 'UTC',
  });

  console.log('[Scheduler] Started successfully');
  console.log(`[Scheduler] Collection: ${collectInterval}`);
  console.log(`[Scheduler] Analysis: ${analyzeInterval}`);

  return true;
}

/**
 * Stop the scheduler
 */
export function stopScheduler() {
  if (collectionJob) {
    collectionJob.stop();
    collectionJob = null;
  }

  if (analysisJob) {
    analysisJob.stop();
    analysisJob = null;
  }

  console.log('[Scheduler] Stopped');
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return collectionJob !== null && analysisJob !== null;
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
  return {
    running: isSchedulerRunning(),
    collectionJobActive: collectionJob !== null,
    analysisJobActive: analysisJob !== null,
  };
}

/**
 * Run collection job immediately (manual trigger)
 */
export async function triggerCollection() {
  await runCollectionJob();
}

/**
 * Run analysis job immediately (manual trigger)
 */
export async function triggerAnalysis() {
  await runAnalysisJob();
}
