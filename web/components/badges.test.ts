import { describe, expect, it } from "vitest";
import { presentSeverities, severityWord } from "./badges";

describe("severityWord", () => {
  it("is singular for exactly one", () => {
    expect(severityWord("bug", 1)).toBe("bug");
    expect(severityWord("risk", 1)).toBe("risk");
    expect(severityWord("style", 1)).toBe("style");
  });

  it("is plural for zero and for more than one", () => {
    expect(severityWord("bug", 2)).toBe("bugs");
    expect(severityWord("risk", 5)).toBe("risks");
    expect(severityWord("style", 0)).toBe("styles");
  });
});

describe("presentSeverities", () => {
  it("leaves out zero counts and keeps the bug, risk, style order", () => {
    expect(presentSeverities({ bug: 2, risk: 0, style: 3 })).toEqual(["bug", "style"]);
    expect(presentSeverities({ bug: 0, risk: 0, style: 0 })).toEqual([]);
  });
});
