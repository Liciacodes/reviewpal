// Safety net for a sleeping or restarting server (Render's free tier sleeps after 15 minutes
// and takes ~50s to wake, but GitHub gives up on a webhook after 10s and does not retry).
// On startup in production we ask GitHub for recent failed pull_request deliveries and
// request them again. Duplicates are harmless: the same commit is never reviewed twice.
import type { App } from 'octokit';

export const REDELIVER_WINDOW_MS = 6 * 60 * 60 * 1000; // only the last 6 hours
export const MAX_REDELIVERIES = 20;

// The fields we use from GET /app/hook/deliveries
export type Delivery = {
  id: number;
  guid: string; // the same for an original delivery and all of its redeliveries
  event: string;
  action: string | null;
  status_code: number;
  delivered_at: string;
};

const WANTED_ACTIONS = new Set(['opened', 'synchronize', 'reopened', 'ready_for_review']); // the ones runReview acts on
const succeeded = (d: Delivery) => d.status_code >= 200 && d.status_code < 300;

// Which deliveries to ask GitHub to send again. Pure.
// A webhook counts as missed only if NONE of its attempts (same guid) succeeded.
export function pickRedeliveries(deliveries: Delivery[], now: Date): number[] {
  const since = now.getTime() - REDELIVER_WINDOW_MS;
  const attemptsByGuid = new Map<string, Delivery[]>();
  for (const d of deliveries) {
    if (d.event !== 'pull_request' || !WANTED_ACTIONS.has(d.action ?? '')) continue;
    if (new Date(d.delivered_at).getTime() < since) continue;
    attemptsByGuid.set(d.guid, [...(attemptsByGuid.get(d.guid) ?? []), d]);
  }

  const picks: number[] = [];
  for (const attempts of attemptsByGuid.values()) {
    if (attempts.some(succeeded)) continue;
    // Redeliver the most recent attempt
    const latest = attempts.reduce((a, b) => (new Date(b.delivered_at) > new Date(a.delivered_at) ? b : a));
    picks.push(latest.id);
  }
  return picks.slice(0, MAX_REDELIVERIES);
}

// Asks GitHub to send missed webhooks again. Never throws (it's only a safety net).
export async function redeliverMissedWebhooks(githubApp: App): Promise<void> {
  try {
    // githubApp.octokit is signed in as the App itself (JWT), which these endpoints need
    const { data } = await githubApp.octokit.request('GET /app/hook/deliveries', { per_page: 100 });
    const ids = pickRedeliveries(data as Delivery[], new Date());
    for (const id of ids) {
      await githubApp.octokit.request('POST /app/hook/deliveries/{delivery_id}/attempts', { delivery_id: id });
    }
    if (ids.length > 0) console.log(`Asked GitHub to redeliver ${ids.length} missed webhook(s)`);
  } catch (err) {
    console.error(`Could not check for missed webhooks: ${err instanceof Error ? err.message : String(err)}`);
  }
}
