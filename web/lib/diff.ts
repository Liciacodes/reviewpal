// Turns a GitHub "patch" (unified diff text) into rows we can render.
//
// A patch looks like:
//   @@ -10,4 +10,5 @@ function foo() {
//    unchanged line
//   -removed line
//   +added line
// The @@ header says where each chunk ("hunk") starts in the old and new file.
// From there we count: context lines move both counters, "-" only the old one, "+" only the new one.

export type DiffRow = {
  kind: "hunk" | "add" | "del" | "context" | "meta";
  oldLine: number | null;
  newLine: number | null; // line number in the NEW file: this is what AI comments refer to
  text: string;
};

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/;

export function parsePatch(patch: string): DiffRow[] {
  const rows: DiffRow[] = [];
  const lines = patch.split("\n");
  if (lines.at(-1) === "") lines.pop(); // trailing newline, not a real line

  let oldLine = 0;
  let newLine = 0;

  for (const raw of lines) {
    const header = HUNK_HEADER.exec(raw);
    if (header) {
      oldLine = Number(header[1]);
      newLine = Number(header[2]);
      rows.push({ kind: "hunk", oldLine: null, newLine: null, text: raw });
    } else if (raw.startsWith("\\")) {
      // "\ No newline at end of file"
      rows.push({ kind: "meta", oldLine: null, newLine: null, text: raw.slice(2) });
    } else if (raw.startsWith("+")) {
      rows.push({ kind: "add", oldLine: null, newLine: newLine++, text: raw.slice(1) });
    } else if (raw.startsWith("-")) {
      rows.push({ kind: "del", oldLine: oldLine++, newLine: null, text: raw.slice(1) });
    } else {
      rows.push({ kind: "context", oldLine: oldLine++, newLine: newLine++, text: raw.slice(1) });
    }
  }
  return rows;
}
