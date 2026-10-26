import { describe, expect, it } from "vitest";
import { canRerunSkipped, skipMessage } from "./skip";

describe("skipMessage", () => {
  it("says a daily limit was reached, for either limit", () => {
    expect(skipMessage("installation_limit").title).toBe("Daily review limit reached");
    expect(skipMessage("global_limit").title).toBe("Daily review limit reached");
    expect(skipMessage("global_limit").detail).toContain("Try again tomorrow");
  });

  it("says a pull request was too large", () => {
    expect(skipMessage("too_large").title).toBe("Too large to review");
  });

  it("still says something when the reason is missing", () => {
    expect(skipMessage(null).title).toBe("Not reviewed");
  });
});

describe("canRerunSkipped", () => {
  it("offers a re-run after a daily limit, not for a too-large pull request", () => {
    expect(canRerunSkipped("installation_limit")).toBe(true);
    expect(canRerunSkipped("global_limit")).toBe(true);
    expect(canRerunSkipped("too_large")).toBe(false);
    expect(canRerunSkipped(null)).toBe(false);
  });
});
