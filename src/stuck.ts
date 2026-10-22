// The "stuck review" rule. Pure: the database query in pipeline.ts uses stuckCutoff().
//
// A review that stays "pending" this long was interrupted (the server restarted mid-review)
// or is hanging. It's marked failed so the dashboard can offer "Re-run review".

export const STUCK_AFTER_MS = 10 * 60 * 1000; // 10 minutes
export const SWEEP_EVERY_MS = 5 * 60 * 1000; // check every 5 minutes
export const TIMED_OUT_MESSAGE = 'Timed out (server restarted or review took too long)';

// Reviews that started before this moment and are still pending count as stuck
export function stuckCutoff(now: Date): Date {
  return new Date(now.getTime() - STUCK_AFTER_MS);
}

// startedAt is when the CURRENT run began (set again on every re-run), not when the review was created
export function isStuck(review: { status: string; startedAt: Date }, now: Date): boolean {
  return review.status === 'pending' && review.startedAt.getTime() < stuckCutoff(now).getTime();
}
