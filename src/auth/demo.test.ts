import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { canAccessRepo } from './access.js';
import { DEMO_READ_ONLY_MESSAGE, demoAllowedRepos, parseDemoRepo, rejectDemoWrites } from './demo.js';

const playground = { owner: 'Liciacodes', name: 'reviewpal-playground', installationId: 101 };
const privateRepo = { owner: 'Liciacodes', name: 'secret-project', installationId: 101 }; // same installation!
const otherAccount = { owner: 'someone-else', name: 'their-app', installationId: 202 };
const repos = [playground, privateRepo, otherAccount];

describe('parseDemoRepo', () => {
  it('reads owner/name, ignoring case and spaces', () => {
    expect(parseDemoRepo(' Liciacodes/reviewpal-playground ')).toBe('liciacodes/reviewpal-playground');
  });

  it.each([undefined, '', 'reviewpal-playground', 'a/b/c', 'https://github.com/a/b', 'a/ b'])(
    'turns the demo off for %j',
    (value) => {
      expect(parseDemoRepo(value)).toBeNull();
    }
  );
});

describe('the demo can only ever see DEMO_REPO', () => {
  const allowed = demoAllowedRepos(repos, 'liciacodes/reviewpal-playground');

  it('allows the demo repo', () => {
    expect(canAccessRepo(allowed, playground)).toBe(true);
  });

  it('refuses another repo of the same owner and installation', () => {
    expect(canAccessRepo(allowed, privateRepo)).toBe(false);
  });

  it("refuses another account's repo", () => {
    expect(canAccessRepo(allowed, otherAccount)).toBe(false);
  });

  it('allows nothing when the demo repo has no reviews yet', () => {
    expect(demoAllowedRepos([privateRepo, otherAccount], 'liciacodes/reviewpal-playground')).toEqual([]);
  });
});

describe('rejectDemoWrites', () => {
  // A tiny stand-in for Express's req/res
  function run(kind: 'demo' | 'user', method: string) {
    const req = { method, auth: { kind, allowed: [] } } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn() as NextFunction;
    rejectDemoWrites(req, res, next);
    return { res, next };
  }

  it.each(['GET', 'HEAD', 'OPTIONS'])('lets a demo visitor %s', (method) => {
    expect(run('demo', method).next).toHaveBeenCalled();
  });

  it.each(['POST', 'PATCH', 'PUT', 'DELETE'])('refuses a demo visitor %s with 403', (method) => {
    const { res, next } = run('demo', method);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: DEMO_READ_ONLY_MESSAGE });
  });

  it('leaves signed-in users alone (the CSRF check handles them)', () => {
    expect(run('user', 'PATCH').next).toHaveBeenCalled();
  });
});
