import { describe, expect, it } from 'vitest';
import { reviewBody, splitComments, summary } from './review-body.js';

type Severity = 'bug' | 'risk' | 'style';
const comment = (severity: Severity, path = 'src/cart.js', line = 1, body = 'text') => ({ path, line, severity, body });

describe('summary', () => {
  it('counts each severity', () => {
    expect(summary([comment('bug'), comment('risk'), comment('style')])).toBe(
      'ReviewPal found 3 things: 1 bug, 1 risk, 1 style.'
    );
  });

  it('leaves out zero counts', () => {
    expect(summary([comment('style'), comment('style'), comment('style')])).toBe('ReviewPal found 3 things: 3 styles.');
  });

  it('uses singular and plural correctly', () => {
    expect(summary([comment('bug')])).toBe('ReviewPal found 1 thing: 1 bug.');
    expect(summary([comment('bug'), comment('bug'), comment('risk')])).toBe('ReviewPal found 3 things: 2 bugs, 1 risk.');
  });
});

describe('splitComments', () => {
  // src/cart.js is a new 3-line file; lines 1-3 can take inline comments
  const files = [
    { filename: 'src/cart.js', patch: '@@ -0,0 +1,3 @@\n+a\n+b\n+c' },
    { filename: 'logo.png', patch: null },
  ];

  it('puts comments on lines in the diff inline, formatted with their severity', () => {
    const { inline, outside } = splitComments([comment('bug', 'src/cart.js', 2, 'Off by one')], files);
    expect(inline).toEqual([{ path: 'src/cart.js', line: 2, side: 'RIGHT', body: '**Bug**: Off by one' }]);
    expect(outside).toEqual([]);
  });

  it('lists comments GitHub would reject in the body instead, so nothing is lost', () => {
    const { inline, outside } = splitComments(
      [
        comment('risk', 'src/cart.js', 10, 'Not in the diff'), // line outside the diff
        comment('style', 'src/other.js', 1, 'Unknown file'), // file not in the PR
        comment('bug', 'logo.png', 1, 'No patch'), // file without a diff
      ],
      files
    );
    expect(inline).toEqual([]);
    expect(outside).toEqual([
      '- `src/cart.js:10` - **Risk**: Not in the diff',
      '- `src/other.js:1` - **Style**: Unknown file',
      '- `logo.png:1` - **Bug**: No patch',
    ]);
  });

  it('never puts a comment inline on a removed line', () => {
    // Old line 5 was removed; the new file only has lines 4 and 5 (the added one) here
    const edit = [{ filename: 'a.ts', patch: '@@ -4,2 +4,2 @@\n keep\n-old\n+new' }];
    expect(splitComments([comment('bug', 'a.ts', 6)], edit).inline).toEqual([]);
    expect(splitComments([comment('bug', 'a.ts', 5)], edit).inline).toHaveLength(1);
  });
});

describe('reviewBody', () => {
  it('is just the summary and the footer when everything went inline', () => {
    expect(reviewBody([comment('bug')], [], [])).toBe('ReviewPal found 1 thing: 1 bug.\n\n<sub>Reviewed by ReviewPal</sub>');
  });

  it('adds comments outside the diff and files not reviewed, in that order', () => {
    const body = reviewBody(
      [comment('bug'), comment('risk')],
      ['- `src/cart.js:10` - **Risk**: text'],
      [
        { filename: 'package-lock.json', reason: 'lock file' },
        { filename: 'big.ts', reason: 'too large' },
      ]
    );
    expect(body).toBe(
      [
        'ReviewPal found 2 things: 1 bug, 1 risk.',
        '**Comments on lines outside the diff:**',
        '- `src/cart.js:10` - **Risk**: text',
        'Not reviewed: `package-lock.json` (lock file), `big.ts` (too large)',
        '<sub>Reviewed by ReviewPal</sub>',
      ].join('\n\n')
    );
  });
});
