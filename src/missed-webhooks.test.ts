import { describe, expect, it } from 'vitest';
import { MAX_REDELIVERIES, pickRedeliveries, type Delivery } from './missed-webhooks.js';

const now = new Date('2026-10-22T12:00:00Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

let nextId = 1;
const delivery = (overrides: Partial<Delivery>): Delivery => ({
  id: nextId++,
  guid: 'guid-a',
  event: 'pull_request',
  action: 'opened',
  status_code: 0, // 0 = GitHub got no answer in time (our server was asleep)
  delivered_at: minutesAgo(5),
  ...overrides,
});

describe('pickRedeliveries', () => {
  it('redelivers a pull_request webhook that failed', () => {
    const failed = delivery({ guid: 'g1', status_code: 0 });
    expect(pickRedeliveries([failed], now)).toEqual([failed.id]);
  });

  it('skips webhooks that succeeded', () => {
    expect(pickRedeliveries([delivery({ guid: 'g1', status_code: 200 })], now)).toEqual([]);
  });

  it('skips a webhook if any attempt (same guid) already succeeded', () => {
    const first = delivery({ guid: 'g1', status_code: 503, delivered_at: minutesAgo(30) });
    const retried = delivery({ guid: 'g1', status_code: 200, delivered_at: minutesAgo(20) });
    expect(pickRedeliveries([first, retried], now)).toEqual([]);
  });

  it('redelivers the latest attempt once when all attempts failed', () => {
    const first = delivery({ guid: 'g1', status_code: 0, delivered_at: minutesAgo(30) });
    const second = delivery({ guid: 'g1', status_code: 502, delivered_at: minutesAgo(10) });
    expect(pickRedeliveries([first, second], now)).toEqual([second.id]);
  });

  it('only cares about the events we act on (opened, synchronize)', () => {
    const closed = delivery({ guid: 'g1', action: 'closed' });
    const ping = delivery({ guid: 'g2', event: 'ping', action: null });
    const sync = delivery({ guid: 'g3', action: 'synchronize' });
    expect(pickRedeliveries([closed, ping, sync], now)).toEqual([sync.id]);
  });

  it('ignores anything older than 6 hours', () => {
    expect(pickRedeliveries([delivery({ guid: 'g1', delivered_at: minutesAgo(6 * 60 + 1) })], now)).toEqual([]);
    const recent = delivery({ guid: 'g2', delivered_at: minutesAgo(6 * 60 - 1) });
    expect(pickRedeliveries([recent], now)).toEqual([recent.id]);
  });

  it(`asks for at most ${MAX_REDELIVERIES} at a time`, () => {
    const many = Array.from({ length: 30 }, (_, i) => delivery({ guid: `g${i}` }));
    expect(pickRedeliveries(many, now)).toHaveLength(MAX_REDELIVERIES);
  });
});
