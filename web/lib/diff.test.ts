import { describe, expect, it } from "vitest";
import { parsePatch } from "./diff";

describe("parsePatch", () => {
  it("gives each row its kind and its old/new line numbers", () => {
    const rows = parsePatch(
      ["@@ -10,3 +10,3 @@", " let sum = 0;", "-old line", "+new line", " return sum;"].join("\n")
    );
    expect(rows.map(({ kind, oldLine, newLine, text }) => ({ kind, oldLine, newLine, text }))).toEqual([
      { kind: "hunk", oldLine: null, newLine: null, text: "Lines 10–12" },
      { kind: "context", oldLine: 10, newLine: 10, text: "let sum = 0;" },
      { kind: "del", oldLine: 11, newLine: null, text: "old line" },
      { kind: "add", oldLine: null, newLine: 11, text: "new line" },
      { kind: "context", oldLine: 12, newLine: 12, text: "return sum;" },
    ]);
  });

  it("restarts the numbers at each chunk", () => {
    const rows = parsePatch(["@@ -1,1 +1,2 @@", " a", "+b", "@@ -20,1 +21,1 @@", " z"].join("\n"));
    expect(rows.filter((r) => r.newLine !== null).map((r) => r.newLine)).toEqual([1, 2, 21]);
  });

  it("ignores the trailing newline and keeps the 'no newline' note as a meta row", () => {
    const rows = parsePatch("@@ -0,0 +1 @@\n+a\n\\ No newline at end of file\n");
    expect(rows.map((r) => r.kind)).toEqual(["hunk", "add", "meta"]);
    expect(rows[2].text).toBe("No newline at end of file");
  });
});

describe("hunk labels", () => {
  const label = (header: string) => parsePatch(header)[0];

  it('turns "@@ -0,0 +1,7 @@" into "Lines 1–7" and keeps the raw header', () => {
    expect(label("@@ -0,0 +1,7 @@")).toMatchObject({ text: "Lines 1–7", raw: "@@ -0,0 +1,7 @@" });
  });

  it('says "Line 5" for a one-line chunk (no count means 1)', () => {
    expect(label("@@ -5 +5 @@").text).toBe("Line 5");
  });

  it('uses the old range and adds "(removed)" when the chunk only deletes lines', () => {
    expect(label("@@ -3,7 +2,0 @@").text).toBe("Lines 3–9 (removed)");
  });

  it("keeps the function name GitHub adds after the header", () => {
    expect(label("@@ -10,3 +10,3 @@ function total(items) {").text).toBe("Lines 10–12  function total(items) {");
  });
});
