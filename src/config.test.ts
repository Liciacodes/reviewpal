import { describe, expect, it } from 'vitest';
import { configProblems, loadPrivateKey } from './config.js';

// A complete local setup with fake values (32 zero bytes for the key)
const good = {
  DATABASE_URL: 'postgres://example',
  WEBHOOK_SECRET: 'secret',
  GITHUB_APP_ID: '123',
  GITHUB_CLIENT_ID: 'Iv1.example',
  GITHUB_CLIENT_SECRET: 'client-secret',
  GROQ_API_KEY: 'gsk_example',
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
  GITHUB_PRIVATE_KEY_PATH: '/keys/app.pem',
};
const exists = (path: string) => path === '/keys/app.pem';

describe('configProblems', () => {
  it('finds nothing wrong with a complete setup', () => {
    expect(configProblems(good, exists)).toEqual([]);
  });

  it('lists every missing variable by name', () => {
    const problems = configProblems({}, exists);
    for (const name of ['DATABASE_URL', 'WEBHOOK_SECRET', 'GITHUB_APP_ID', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GROQ_API_KEY', 'TOKEN_ENCRYPTION_KEY']) {
      expect(problems).toContain(`${name} is missing`);
    }
    expect(problems).toContain('GITHUB_PRIVATE_KEY_PATH or GITHUB_PRIVATE_KEY is missing (set one of them)');
  });

  it('treats blank values as missing', () => {
    expect(configProblems({ ...good, GROQ_API_KEY: '   ' }, exists)).toEqual(['GROQ_API_KEY is missing']);
  });

  it('never puts a value in a message', () => {
    const problems = configProblems({ ...good, TOKEN_ENCRYPTION_KEY: 'super-secret-but-too-short' }, exists);
    expect(problems.join(' ')).not.toContain('super-secret');
  });

  it('accepts the private key as a variable instead of a file', () => {
    const { GITHUB_PRIVATE_KEY_PATH: _path, ...rest } = good;
    expect(configProblems({ ...rest, GITHUB_PRIVATE_KEY: '-----BEGIN RSA PRIVATE KEY-----\\n...' }, exists)).toEqual([]);
  });

  it('reports a key path that points nowhere (e.g. a typo in the Render Secret File name)', () => {
    expect(configProblems({ ...good, GITHUB_PRIVATE_KEY_PATH: '/etc/secrets/typo.pem' }, exists)).toEqual([
      'GITHUB_PRIVATE_KEY_PATH points to a file that does not exist',
    ]);
  });

  it('rejects an encryption key that is not 32 bytes', () => {
    expect(configProblems({ ...good, TOKEN_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64') }, exists)).toEqual([
      'TOKEN_ENCRYPTION_KEY must be 32 random bytes in base64',
    ]);
  });

  it('needs an https DASHBOARD_URL in production only', () => {
    expect(configProblems(good, exists)).toEqual([]); // local: optional
    expect(configProblems({ ...good, NODE_ENV: 'production' }, exists)).toEqual([
      'DASHBOARD_URL is missing (the dashboard address, e.g. https://reviewpal.vercel.app)',
    ]);
    expect(configProblems({ ...good, NODE_ENV: 'production', DASHBOARD_URL: 'http://reviewpal.vercel.app' }, exists)).toEqual([
      'DASHBOARD_URL must start with https:// in production',
    ]);
    expect(configProblems({ ...good, NODE_ENV: 'production', DASHBOARD_URL: 'https://reviewpal.vercel.app' }, exists)).toEqual([]);
  });
});

describe('loadPrivateKey', () => {
  const pem = '-----BEGIN RSA PRIVATE KEY-----\nAAA\nBBB\n-----END RSA PRIVATE KEY-----\n';

  it('reads the file when GITHUB_PRIVATE_KEY_PATH is set (and prefers it)', () => {
    const read = (path: string) => (path === '/etc/secrets/app.pem' ? pem : '');
    expect(loadPrivateKey({ GITHUB_PRIVATE_KEY_PATH: '/etc/secrets/app.pem', GITHUB_PRIVATE_KEY: 'ignored' }, read)).toBe(pem);
  });

  it('turns the two characters "\\n" back into line breaks', () => {
    const oneLine = '-----BEGIN RSA PRIVATE KEY-----\\nAAA\\nBBB\\n-----END RSA PRIVATE KEY-----';
    expect(loadPrivateKey({ GITHUB_PRIVATE_KEY: oneLine }, () => '')).toBe(pem);
  });

  it('keeps a key pasted with real line breaks as it is', () => {
    expect(loadPrivateKey({ GITHUB_PRIVATE_KEY: pem }, () => '')).toBe(pem);
  });

  it('throws when neither is set', () => {
    expect(() => loadPrivateKey({}, () => '')).toThrow(/GITHUB_PRIVATE_KEY/);
  });
});
