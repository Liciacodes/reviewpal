// The real API routes behind the real guards, called as a demo visitor.
// The database, GitHub and the review pipeline are replaced by stand-ins that fail the test
// if anything touches them: a refused write must be stopped before it reaches a route.
import express from 'express';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const touched = vi.hoisted(() => ({ list: [] as string[] }));

vi.mock('./db.js', () => ({
  prisma: new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return undefined; // not a promise
        touched.list.push(`database.${String(prop)}`);
        throw new Error(`the database must not be touched (${String(prop)})`);
      },
    }
  ),
}));
vi.mock('./github-app.js', () => ({ githubApp: {} }));
vi.mock('./pipeline.js', () => ({
  prepareRerun: vi.fn(async () => {
    touched.list.push('prepareRerun');
    return { ok: true };
  }),
  processReview: vi.fn(async () => {
    touched.list.push('processReview');
  }),
}));

const { apiRouter } = await import('./api.js');
const { apiGuards } = await import('./auth/session.js');
const { DEMO_PROFILE, DEMO_READ_ONLY_MESSAGE } = await import('./auth/demo.js');

// Every route registered on the API router, read from the router itself, so a write
// endpoint added later is tested automatically
type Layer = { route?: { path: string; methods: Record<string, boolean> } };
const routes = (apiRouter.stack as unknown as Layer[])
  .filter((layer) => layer.route)
  .flatMap((layer) =>
    Object.keys(layer.route!.methods)
      .filter((m) => m !== '_all')
      .map((m) => ({ method: m.toUpperCase(), path: layer.route!.path }))
  );
const writeRoutes = routes.filter((r) => !['GET', 'HEAD', 'OPTIONS'].includes(r.method));

let baseUrl = '';
let server: ReturnType<express.Express['listen']>;

beforeAll(async () => {
  const app = express();
  // Same order as src/index.ts, with requireUser replaced by "this request is a demo visitor"
  app.use(
    '/api',
    express.json(),
    (req, _res, next) => {
      req.auth = { kind: 'demo', allowed: [{ installationId: 101, fullName: 'liciacodes/reviewpal-playground' }] };
      next();
    },
    ...apiGuards,
    apiRouter
  );
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => server?.close());

describe('demo visitors and the real API routes', () => {
  it('finds the write routes we know about (so the next test really checks something)', () => {
    expect(writeRoutes).toEqual(
      expect.arrayContaining([
        { method: 'PATCH', path: '/comments/:id/feedback' },
        { method: 'POST', path: '/reviews/:id/rerun' },
      ])
    );
  });

  it('refuses EVERY write route with 403, before it touches anything', async () => {
    for (const { method, path } of writeRoutes) {
      const res = await fetch(baseUrl + '/api' + path.replace(/:\w+/g, 'some-id'), {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'anything' },
        body: JSON.stringify({ feedback: 'useful' }),
      });
      expect(res.status, `${method} ${path}`).toBe(403);
      expect(await res.json()).toEqual({ error: DEMO_READ_ONLY_MESSAGE });
    }
    expect(touched.list).toEqual([]);
  });

  it('shows the demo profile on /api/me, with no personal data', async () => {
    const res = await fetch(baseUrl + '/api/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(DEMO_PROFILE);
  });
});
