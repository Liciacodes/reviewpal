// Keeps the database in sync when ReviewPal is installed, uninstalled, or given/denied repos.
// Removing a repo (or the whole installation) deletes its reviews, files, comments and notices
// (the database cascades from Repo), so no code is left with data the owner took back.
import { prisma } from './db.js';

type RepoRef = { owner: string; name: string };

export type InstallationChanges = {
  installationId: number;
  upsert: RepoRef[]; // repos we may review now
  remove: RepoRef[]; // repos no longer shared with us
  removeInstallation: boolean; // ReviewPal was uninstalled: delete everything for it
};

type RepoPayload = { full_name: string };
export type InstallationPayload = {
  action: string;
  installation: { id: number };
  repositories?: RepoPayload[];
  repositories_added?: RepoPayload[];
  repositories_removed?: RepoPayload[];
};

const toRef = (r: RepoPayload): RepoRef => {
  const [owner = '', name = ''] = r.full_name.split('/');
  return { owner, name };
};

// What to change for an `installation` or `installation_repositories` webhook. Pure.
// Returns null for events we don't act on (e.g. suspend).
export function installationChanges(event: string, payload: InstallationPayload): InstallationChanges | null {
  const base = { installationId: payload.installation.id, upsert: [], remove: [], removeInstallation: false };
  if (event === 'installation') {
    if (payload.action === 'created' || payload.action === 'new_permissions_accepted') {
      return { ...base, upsert: (payload.repositories ?? []).map(toRef) };
    }
    if (payload.action === 'deleted') return { ...base, removeInstallation: true };
  }
  if (event === 'installation_repositories') {
    if (payload.action === 'added') return { ...base, upsert: (payload.repositories_added ?? []).map(toRef) };
    if (payload.action === 'removed') return { ...base, remove: (payload.repositories_removed ?? []).map(toRef) };
  }
  return null;
}

// The few database calls this needs, so tests can pass a fake
export type InstallationDb = {
  repo: {
    upsert: (args: {
      where: { owner_name: RepoRef };
      update: { installationId: number };
      create: RepoRef & { installationId: number };
    }) => Promise<unknown>;
    deleteMany: (args: { where: object }) => Promise<{ count: number }>;
  };
  aiUsage: { deleteMany: (args: { where: { installationId: number } }) => Promise<{ count: number }> };
};

export async function applyInstallationChanges(changes: InstallationChanges, db: InstallationDb): Promise<string> {
  const { installationId } = changes;

  if (changes.removeInstallation) {
    // Every repo of this installation; reviews, files, comments and notices go with them
    const repos = await db.repo.deleteMany({ where: { installationId } });
    await db.aiUsage.deleteMany({ where: { installationId } });
    return `installation ${installationId} removed: deleted ${repos.count} repo(s) and their reviews`;
  }

  for (const r of changes.upsert) {
    await db.repo.upsert({
      where: { owner_name: { owner: r.owner, name: r.name } },
      update: { installationId },
      create: { owner: r.owner, name: r.name, installationId },
    });
  }

  let removed = 0;
  if (changes.remove.length > 0) {
    // Only this installation's rows, matched by exact owner and name
    const result = await db.repo.deleteMany({
      where: { installationId, OR: changes.remove.map((r) => ({ owner: r.owner, name: r.name })) },
    });
    removed = result.count;
  }
  return `installation ${installationId}: ${changes.upsert.length} repo(s) added, ${removed} removed`;
}

// From the webhook. Never throws.
export async function handleInstallationEvent(event: string, payload: InstallationPayload): Promise<void> {
  try {
    const changes = installationChanges(event, payload);
    if (!changes) return;
    console.log(await applyInstallationChanges(changes, prisma as unknown as InstallationDb));
  } catch (err) {
    console.error(`Could not sync installation: ${err instanceof Error ? err.message : String(err)}`);
  }
}
