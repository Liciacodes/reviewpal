import { describe, expect, it } from 'vitest';
import { buildDiff, newSideLines, numberPatch, skipReason } from './diff.js';

// A small edit: line 11 changed, with one unchanged line on each side
const EDIT = [
  '@@ -10,3 +10,3 @@ function x() {',
  ' let sum = 0;',
  '-for (let i = 0; i <= n; i++) {',
  '+for (let i = 0; i < n; i++) {',
  ' return sum;',
].join('\n');

// Two chunks: one near the top, one further down (new-file numbers start at 21)
const TWO_CHUNKS = [
  '@@ -1,2 +1,3 @@',
  ' a',
  '+b',
  ' c',
  '@@ -20,2 +21,2 @@',
  '-x',
  '+y',
  ' z',
].join('\n');

// A brand-new file with `n` added lines
function newFile(n: number): string {
  const lines = Array.from({ length: n }, (_, i) => `+const v${i} = ${i};`);
  return [`@@ -0,0 +1,${n} @@`, ...lines].join('\n');
}

describe('numberPatch', () => {
  it('numbers added and unchanged lines, and leaves removed lines unnumbered', () => {
    expect(numberPatch(EDIT)).toBe(
      [
        '@@ -10,3 +10,3 @@ function x() {',
        '  10   let sum = 0;',
        '     - for (let i = 0; i <= n; i++) {',
        '  11 + for (let i = 0; i < n; i++) {',
        '  12   return sum;',
      ].join('\n')
    );
  });

  it('restarts numbering at each @@ chunk', () => {
    expect(numberPatch(TWO_CHUNKS)).toBe(
      [
        '@@ -1,2 +1,3 @@',
        '   1   a',
        '   2 + b',
        '   3   c',
        '@@ -20,2 +21,2 @@',
        '     - x',
        '  21 + y',
        '  22   z',
      ].join('\n')
    );
  });

  it('keeps "\\ No newline at end of file" without a number', () => {
    const patch = '@@ -0,0 +1 @@\n+a\n\\ No newline at end of file';
    expect(numberPatch(patch)).toBe('@@ -0,0 +1 @@\n   1 + a\n\\ No newline at end of file');
  });
});

describe('newSideLines', () => {
  it('returns every line of a new file', () => {
    expect([...newSideLines(newFile(3) + '\n')]).toEqual([1, 2, 3]);
  });

  it('returns only added and unchanged lines of an edit with two chunks', () => {
    expect([...newSideLines(TWO_CHUNKS)]).toEqual([1, 2, 3, 21, 22]);
  });
});

describe('skipReason', () => {
  it.each([
    ['package-lock.json', 'lock file'],
    ['yarn.lock', 'lock file'],
    ['web/pnpm-lock.yaml', 'lock file'],
    ['dist/app.js', 'generated file'],
    ['web/.next/server/page.js', 'generated file'],
    ['src/generated/prisma/client.ts', 'generated file'],
    ['public/lib.min.js', 'generated file'],
    ['app.js.map', 'generated file'],
  ])('skips %s as "%s"', (filename, reason) => {
    expect(skipReason({ filename, patch: '+x' })).toBe(reason);
  });

  it('skips files with no patch (binary or too big for GitHub)', () => {
    expect(skipReason({ filename: 'logo.png', patch: null })).toBe('binary or no diff');
  });

  it('skips deleted files', () => {
    expect(skipReason({ filename: 'old.ts', status: 'removed', patch: '-a' })).toBe('deleted file');
  });

  it('reviews a normal source file', () => {
    expect(skipReason({ filename: 'src/cart.js', status: 'added', patch: newFile(1) })).toBeNull();
  });
});

describe('buildDiff', () => {
  it('stays within the budget, including the gaps between files', () => {
    const files = ['a.ts', 'b.ts', 'c.ts', 'd.ts'].map((filename) => ({ filename, patch: newFile(100) }));
    const { text } = buildDiff(files, 3000);
    expect(text.length).toBeLessThanOrEqual(3000);
  });

  it('puts small files in whole', () => {
    const small = newFile(5);
    const { text, notReviewed } = buildDiff(
      [
        { filename: 'small.ts', patch: small },
        { filename: 'huge.ts', patch: newFile(2000) },
      ],
      2000
    );
    expect(text).toContain(`File: small.ts\n${numberPatch(small)}`);
    expect(notReviewed.map((f) => f.filename)).not.toContain('small.ts');
  });

  it('marks a file that does not fit as "too large, partly reviewed" and cuts it at a whole line', () => {
    const { text, notReviewed } = buildDiff([{ filename: 'huge.ts', patch: newFile(2000) }], 2000);
    expect(notReviewed).toEqual([{ filename: 'huge.ts', reason: 'too large, partly reviewed' }]);
    expect(text.split('\n').at(-1)).toMatch(/^ +\d+ \+ const v\d+ = \d+;$/);
  });

  it('skips a file as "too large" when its share would be too small to be useful', () => {
    const files = ['a.ts', 'b.ts', 'c.ts'].map((filename) => ({ filename, patch: newFile(300) }));
    const { notReviewed } = buildDiff(files, 500);
    expect(notReviewed.filter((f) => f.reason === 'too large').length).toBeGreaterThan(0);
  });

  it('keeps files in their original order, even though small files are measured first', () => {
    const { text } = buildDiff(
      [
        { filename: 'big-first.ts', patch: newFile(20) },
        { filename: 'small-second.ts', patch: newFile(2) },
      ],
      12000
    );
    const order = [...text.matchAll(/^File: (.+)$/gm)].map((m) => m[1]);
    expect(order).toEqual(['big-first.ts', 'small-second.ts']);
  });

  it('records skipped files with their reason and leaves them out of the text', () => {
    const { text, notReviewed } = buildDiff(
      [
        { filename: 'package-lock.json', patch: newFile(50) },
        { filename: 'logo.png', patch: null },
        { filename: 'src/cart.js', patch: newFile(3) },
      ],
      12000
    );
    expect(notReviewed).toEqual([
      { filename: 'package-lock.json', reason: 'lock file' },
      { filename: 'logo.png', reason: 'binary or no diff' },
    ]);
    expect(text).not.toContain('package-lock.json');
    expect(text).toContain('File: src/cart.js');
  });

  it('returns empty text when every file is skipped', () => {
    expect(buildDiff([{ filename: 'yarn.lock', patch: newFile(5) }], 12000).text).toBe('');
  });
});
