import type { SkipReason } from "./types";

// What the dashboard says about a review that was skipped on purpose (no AI call).
// Matches the comment the server posts on the pull request (src/limits.ts).
export function skipMessage(reason: SkipReason | null): { title: string; detail: string } {
  switch (reason) {
    case "too_large":
      return {
        title: "Too large to review",
        detail:
          "This pull request has more changed files or lines than ReviewPal reviews. A short comment on the pull request says so. Smaller pull requests are easier to review, for people and for AI.",
      };
    case "installation_limit":
      return {
        title: "Daily review limit reached",
        detail:
          "This account has used today's reviews. Try again tomorrow: limits reset at midnight UTC. Pushing a new commit after that gets a review.",
      };
    case "global_limit":
      return {
        title: "Daily review limit reached",
        detail:
          "ReviewPal has used all of today's reviews. Try again tomorrow: limits reset at midnight UTC. Pushing a new commit after that gets a review.",
      };
    default:
      return { title: "Not reviewed", detail: "This pull request was skipped." };
  }
}

// Re-running only helps once a daily limit has reset; a too-large PR stays too large
export function canRerunSkipped(reason: SkipReason | null): boolean {
  return reason === "installation_limit" || reason === "global_limit";
}
