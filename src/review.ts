import Groq from 'groq-sdk';
import { z } from 'zod';
import { buildDiff, type NotReviewed } from './diff.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// The model we use, defined once so the saved Review records the same value
export const MODEL = process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b';

// 1. The exact shape we expect back from the AI
const ReviewSchema = z.object({
  comments: z.array(
    z.object({
      path: z.string(),                              // which file
      line: z.number(),                              // which line
      severity: z.enum(['bug', 'risk', 'style']),    // how serious
      body: z.string(),                              // the comment text
    })
  ),
});

// The most diff text we send per review (characters), to control cost
const DIFF_BUDGET = 12000;

export type Review = z.infer<typeof ReviewSchema> & { notReviewed: NotReviewed[] };

type ChangedFile = { filename: string; status?: string; patch?: string };

export async function reviewFiles(files: ChangedFile[]): Promise<Review> {
  // 2. Turn the changed files into one numbered text, sharing the budget fairly.
  //    Lock files, generated files and anything that doesn't fit are recorded in notReviewed.
  const { text: diffText, notReviewed } = buildDiff(files, DIFF_BUDGET);

  // Nothing left to review (e.g. only a lock file changed): don't call the AI
  if (!diffText) return { comments: [], notReviewed };

  // 3. Ask the AI for a review, in JSON only
  const completion = await groq.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'You are a careful senior code reviewer. ' +
          'Each file starts with "File: <path>". Every line of the new version starts with its line number, ' +
          'then "+" for an added line or a space for an unchanged line. Removed lines have no number and start with "-". ' +
          'Only comment on added (+) lines. ' +
          'Return at most 5 comments that are specific and useful: real bugs, risks, or clear style problems. ' +
          'If nothing is worth saying, return an empty list. ' +
          'Respond ONLY with JSON: {"comments":[{"path":string,"line":number,"severity":"bug"|"risk"|"style","body":string}]}. ' +
          '"line" is the number shown at the start of the line you are commenting on: copy it, never count lines yourself.',
      },
      { role: 'user', content: diffText },
    ],
  });

  // 4. Check the answer has the right shape before trusting it
  const raw = completion.choices[0]?.message?.content ?? '{"comments":[]}';
  return { ...ReviewSchema.parse(JSON.parse(raw)), notReviewed };
}