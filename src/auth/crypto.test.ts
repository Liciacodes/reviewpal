import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, parseKey, randomToken, safeEqual, sha256, tryDecrypt } from './crypto.js';

// A throwaway key for the tests (never a real one)
const key = crypto.randomBytes(32);

describe('encrypt / decrypt', () => {
  it('gets the original text back', () => {
    expect(decrypt(encrypt('ghu_example_token', key), key)).toBe('ghu_example_token');
  });

  it('never stores the token as readable text', () => {
    expect(encrypt('ghu_example_token', key)).not.toContain('ghu_example_token');
  });

  it('gives a different result each time (random IV)', () => {
    expect(encrypt('same', key)).not.toBe(encrypt('same', key));
  });

  it('refuses a value that was changed', () => {
    const [iv, tag, data] = encrypt('ghu_example_token', key).split('.');
    const flipped = Buffer.from(data!, 'base64url');
    flipped[0] = flipped[0]! ^ 1; // change one bit
    expect(() => decrypt([iv, tag, flipped.toString('base64url')].join('.'), key)).toThrow();
  });

  it('refuses the wrong key', () => {
    expect(() => decrypt(encrypt('secret', key), crypto.randomBytes(32))).toThrow();
  });
});

describe('tryDecrypt', () => {
  it('reads a value encrypted with the same key', () => {
    expect(tryDecrypt(encrypt('ghu_example_token', key), key)).toBe('ghu_example_token');
  });

  it('gives null (no crash) for a value encrypted with another key, e.g. local vs production', () => {
    const otherEnvironmentsKey = crypto.randomBytes(32);
    expect(tryDecrypt(encrypt('ghu_example_token', otherEnvironmentsKey), key)).toBeNull();
  });

  it('gives null for a malformed value', () => {
    expect(tryDecrypt('not-encrypted', key)).toBeNull();
  });
});

describe('parseKey', () => {
  it('accepts 32 bytes in base64', () => {
    expect(parseKey(key.toString('base64'))).toHaveLength(32);
  });

  it('rejects a missing or short key', () => {
    expect(() => parseKey(undefined)).toThrow(/32 random bytes/);
    expect(() => parseKey(crypto.randomBytes(16).toString('base64'))).toThrow(/32 random bytes/);
  });
});

describe('tokens and comparisons', () => {
  it('makes long, different random tokens', () => {
    const a = randomToken();
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(a).not.toBe(randomToken());
  });

  it('hashes the same input the same way', () => {
    expect(sha256('abc')).toBe(sha256('abc'));
    expect(sha256('abc')).not.toBe(sha256('abd'));
  });

  it('safeEqual is true only for identical strings', () => {
    expect(safeEqual('token', 'token')).toBe(true);
    expect(safeEqual('token', 'tokem')).toBe(false);
    expect(safeEqual('token', 'token-longer')).toBe(false);
  });
});
