// Shapes returned by the ReviewPal API (see src/api.ts in the server).
// Dates arrive as ISO strings because they travel as JSON.

export type ReviewStatus = "pending" | "done" | "failed";
export type Severity = "bug" | "risk" | "style";
export type Feedback = "useful" | "not_useful";

export type SeverityCounts = Record<Severity, number>;

export type ReviewSummary = {
  id: string;
  repo: string; // "owner/name"
  prNumber: number;
  prTitle: string;
  prUrl: string;
  status: ReviewStatus;
  filesChanged: number;
  createdAt: string;
  commentCount: number;
  counts: SeverityCounts;
};

export type ReviewFile = {
  id: string;
  filename: string;
  status: string; // added, modified, removed, renamed...
  patch: string | null;
};

export type ReviewComment = {
  id: string;
  path: string;
  line: number;
  severity: Severity;
  body: string;
  feedback: Feedback | null;
  createdAt: string;
};

export type ReviewDetail = {
  id: string;
  repo: { owner: string; name: string };
  prNumber: number;
  prTitle: string;
  prUrl: string;
  headSha: string;
  status: ReviewStatus;
  errorMessage: string | null;
  model: string;
  filesChanged: number;
  createdAt: string;
  githubReviewId: string | null; // set once the review is posted on the pull request
  postedAt: string | null;
  postError: string | null;      // why posting to GitHub failed
  files: ReviewFile[];
  comments: ReviewComment[];
};

export type Stats = {
  totalReviews: number;
  totalComments: number;
  counts: SeverityCounts;
  usefulPercent: number | null; // null when nothing has been rated yet
};
