// Small, pure helpers for working with GitHub "patch" text (unified diffs).
// No database, no network: easy to test.
//
// A patch looks like:
//   @@ -10,4 +10,5 @@ function foo() {
//    unchanged line
//   -removed line
//   +added line
// The @@ header says where each chunk starts. From there we count: "+" and unchanged
// lines move the new-file counter, "-" lines don't. (Same counting as web/lib/diff.ts.)

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

type PatchRow =
  | { kind: 'hunk'; text: string }
  | { kind: 'add' | 'context'; newLine: number; text: string }
  | { kind: 'del' | 'meta'; text: string };

// Splits a patch into rows and gives each new-side row its line number
function walkPatch(patch: string): PatchRow[] {
  const lines = patch.split('\n');
  if (lines.at(-1) === '') lines.pop(); // trailing newline, not a real line

  const rows: PatchRow[] = [];
  let newLine = 0;
  for (const raw of lines) {
    const header = HUNK_HEADER.exec(raw);
    if (header) {
      newLine = Number(header[1]);
      rows.push({ kind: 'hunk', text: raw });
    } else if (raw.startsWith('\\')) {
      rows.push({ kind: 'meta', text: raw }); // "\ No newline at end of file"
    } else if (raw.startsWith('-')) {
      rows.push({ kind: 'del', text: raw.slice(1) });
    } else if (raw.startsWith('+')) {
      rows.push({ kind: 'add', newLine: newLine++, text: raw.slice(1) });
    } else {
      rows.push({ kind: 'context', newLine: newLine++, text: raw.slice(1) });
    }
  }
  return rows;
}

// The new-file line numbers in a patch: the only lines GitHub accepts
// for an inline comment with side "RIGHT".
export function newSideLines(patch: string): Set<number> {
  const lines = new Set<number>();
  for (const row of walkPatch(patch)) {
    if (row.kind === 'add' || row.kind === 'context') lines.add(row.newLine);
  }
  return lines;
}

// Rewrites a patch so each new-side line starts with its line number, for the AI:
//   @@ -10,3 +10,3 @@
//     10   unchanged
//          - removed
//     11 + added
// The AI then copies the number instead of counting lines itself.
export function numberPatch(patch: string): string {
  return walkPatch(patch)
    .map((row) => {
      switch (row.kind) {
        case 'hunk':
        case 'meta':
          return row.text;
        case 'add':
          return `${String(row.newLine).padStart(4)} + ${row.text}`;
        case 'context':
          return `${String(row.newLine).padStart(4)}   ${row.text}`;
        case 'del':
          return `     - ${row.text}`;
      }
    })
    .join('\n');
}

const LOCK_FILES = new Set([
  'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'bun.lock',
  'Cargo.lock', 'poetry.lock', 'Pipfile.lock', 'Gemfile.lock', 'composer.lock', 'go.sum',
]);
const GENERATED_DIR = /(^|\/)(dist|build|out|\.next|node_modules|coverage|vendor|generated)\//;
const GENERATED_FILE = /\.(min\.js|min\.css|map|snap)$/;

// Why a file should not be sent to the AI at all, or null if it should be reviewed
export function skipReason(file: { filename: string; status?: string; patch?: string | null }): string | null {
  const name = file.filename.split('/').pop() ?? file.filename;
  if (LOCK_FILES.has(name)) return 'lock file';
  if (GENERATED_DIR.test(file.filename) || GENERATED_FILE.test(file.filename)) return 'generated file';
  if (file.status === 'removed') return 'deleted file';
  if (!file.patch) return 'binary or no diff';
  return null;
}

export type NotReviewed = { filename: string; reason: string };

// Below this, a slice of a file is too small to be worth sending
const MIN_SHARE = 400;

// Cuts text to at most `max` characters, at the end of a whole line
function cutAtLine(text: string, max: number): string {
  const cut = text.lastIndexOf('\n', max);
  return text.slice(0, cut > 0 ? cut : max);
}

// Builds the text sent to the AI, sharing `budget` characters fairly between files.
// Small files go in whole; what they don't use is shared by the bigger ones.
// Returns the text and every file that was skipped or only partly included, with why.
export function buildDiff(
  files: { filename: string; status?: string; patch?: string | null }[],
  budget: number
): { text: string; notReviewed: NotReviewed[] } {
  const notReviewed: NotReviewed[] = [];
  const candidates: { filename: string; body: string }[] = [];

  for (const f of files) {
    const reason = skipReason(f);
    if (reason) notReviewed.push({ filename: f.filename, reason });
    else candidates.push({ filename: f.filename, body: `File: ${f.filename}\n${numberPatch(f.patch!)}` });
  }

  // Hand out the budget smallest-first, so leftovers flow to bigger files
  const chosen = new Map<string, string>();
  const SEPARATOR = '\n\n';
  let remaining = budget - SEPARATOR.length * Math.max(candidates.length - 1, 0); // room for the gaps between files
  const bySize = [...candidates].sort((a, b) => a.body.length - b.body.length);
  bySize.forEach((c, i) => {
    const share = Math.floor(remaining / (bySize.length - i));
    if (c.body.length <= share) {
      chosen.set(c.filename, c.body);
      remaining -= c.body.length;
    } else if (share >= MIN_SHARE) {
      const part = cutAtLine(c.body, share);
      chosen.set(c.filename, part);
      remaining -= part.length;
      notReviewed.push({ filename: c.filename, reason: 'too large, partly reviewed' });
    } else {
      notReviewed.push({ filename: c.filename, reason: 'too large' });
    }
  });

  // Keep the files in their original order in the text
  const text = candidates
    .filter((c) => chosen.has(c.filename))
    .map((c) => chosen.get(c.filename))
    .join(SEPARATOR);

  return { text, notReviewed };
}
