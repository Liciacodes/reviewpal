import { describe, expect, it } from 'vitest';
import { isStuck, stuckCutoff } from './stuck.js';

const now = new Date('2026-10-22T12:00:00Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

describe('isStuck', () => {
  it('is not stuck while a pending review is younger than 10 minutes', () => {
    expect(isStuck({ status: 'pending', startedAt: minutesAgo(9) }, now)).toBe(false);
  });

  it('is not stuck at exactly 10 minutes', () => {
    expect(isStuck({ status: 'pending', startedAt: minutesAgo(10) }, now)).toBe(false);
  });

  it('is stuck after more than 10 minutes pending', () => {
    expect(isStuck({ status: 'pending', startedAt: minutesAgo(11) }, now)).toBe(true);
  });

  it('never counts finished reviews, however old', () => {
    expect(isStuck({ status: 'done', startedAt: minutesAgo(600) }, now)).toBe(false);
    expect(isStuck({ status: 'failed', startedAt: minutesAgo(600) }, now)).toBe(false);
  });

  it('uses when the current run started, so a fresh re-run of an old review is not stuck', () => {
    // Created days ago, but re-run 1 minute ago: startedAt is 1 minute ago
    expect(isStuck({ status: 'pending', startedAt: minutesAgo(1) }, now)).toBe(false);
  });
});

describe('stuckCutoff', () => {
  it('is 10 minutes before now (the database query uses it)', () => {
    expect(stuckCutoff(now)).toEqual(minutesAgo(10));
  });
});
