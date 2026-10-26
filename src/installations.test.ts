import { describe, expect, it, vi } from 'vitest';
import type { InstallationDb } from './installations.js';

// installations.ts imports the database client; these tests pass their own fake db instead
vi.mock('./db.js', () => ({ prisma: {} }));
const { applyInstallationChanges, installationChanges } = await import('./installations.js');

// A fake database that records every call
function fakeDb() {
  const db = {
    repo: {
      upsert: vi.fn(async (_args: unknown) => ({})),
      deleteMany: vi.fn(async (_args: unknown) => ({ count: 2 })),
    },
    aiUsage: { deleteMany: vi.fn(async (_args: unknown) => ({ count: 5 })) },
  };
  return db as typeof db & InstallationDb;
}

const repos = (...names: string[]) => names.map((n) => ({ full_name: `felicia/${n}` }));

describe('installationChanges', () => {
  it('adds every repo when ReviewPal is installed', () => {
    expect(installationChanges('installation', { action: 'created', installation: { id: 7 }, repositories: repos('a', 'b') })).toEqual({
      installationId: 7,
      upsert: [
        { owner: 'felicia', name: 'a' },
        { owner: 'felicia', name: 'b' },
      ],
      remove: [],
      removeInstallation: false,
    });
  });

  it('removes everything when ReviewPal is uninstalled', () => {
    expect(installationChanges('installation', { action: 'deleted', installation: { id: 7 } })?.removeInstallation).toBe(true);
  });

  it('follows repos being added to and removed from an installation', () => {
    expect(installationChanges('installation_repositories', { action: 'added', installation: { id: 7 }, repositories_added: repos('c') })?.upsert).toEqual([
      { owner: 'felicia', name: 'c' },
    ]);
    expect(installationChanges('installation_repositories', { action: 'removed', installation: { id: 7 }, repositories_removed: repos('a') })?.remove).toEqual([
      { owner: 'felicia', name: 'a' },
    ]);
  });

  it('ignores events it has nothing to do for', () => {
    expect(installationChanges('installation', { action: 'suspend', installation: { id: 7 } })).toBeNull();
  });
});

describe('applyInstallationChanges: uninstall cleanup', () => {
  it("deletes all of the installation's repos (reviews, files, comments follow) and its usage rows", async () => {
    const db = fakeDb();
    const summary = await applyInstallationChanges(
      { installationId: 7, upsert: [], remove: [], removeInstallation: true },
      db
    );
    expect(db.repo.deleteMany).toHaveBeenCalledWith({ where: { installationId: 7 } });
    expect(db.aiUsage.deleteMany).toHaveBeenCalledWith({ where: { installationId: 7 } });
    expect(db.repo.upsert).not.toHaveBeenCalled();
    expect(summary).toContain('deleted 2 repo(s)');
  });

  it("only touches that installation's data", async () => {
    const db = fakeDb();
    await applyInstallationChanges({ installationId: 7, upsert: [], remove: [], removeInstallation: true }, db);
    for (const call of [...db.repo.deleteMany.mock.calls, ...db.aiUsage.deleteMany.mock.calls]) {
      expect(call[0]).toEqual({ where: { installationId: 7 } });
    }
  });

  it('deletes removed repos by exact owner and name, within the installation', async () => {
    const db = fakeDb();
    await applyInstallationChanges(
      { installationId: 7, upsert: [], remove: [{ owner: 'felicia', name: 'a' }], removeInstallation: false },
      db
    );
    expect(db.repo.deleteMany).toHaveBeenCalledWith({ where: { installationId: 7, OR: [{ owner: 'felicia', name: 'a' }] } });
    expect(db.aiUsage.deleteMany).not.toHaveBeenCalled();
  });

  it('adds repos (or moves them to this installation)', async () => {
    const db = fakeDb();
    await applyInstallationChanges(
      { installationId: 7, upsert: [{ owner: 'felicia', name: 'c' }], remove: [], removeInstallation: false },
      db
    );
    expect(db.repo.upsert).toHaveBeenCalledWith({
      where: { owner_name: { owner: 'felicia', name: 'c' } },
      update: { installationId: 7 },
      create: { owner: 'felicia', name: 'c', installationId: 7 },
    });
    expect(db.repo.deleteMany).not.toHaveBeenCalled();
  });
});
