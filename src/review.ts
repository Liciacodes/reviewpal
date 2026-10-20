import Groq from 'groq-sdk';
import { z } from 'zod';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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

export type Review = z.infer<typeof ReviewSchema>;

type ChangedFile = { filename: string; patch?: string };

export async function reviewFiles(files: ChangedFile[]): Promise<Review> {
  // 2. Turn the changed files into one text, and cap the size to control cost
  const diffText = files
    .filter((f) => f.patch)
    .map((f) => `File: ${f.filename}\n${f.patch}`)
    .join('\n\n')
    .slice(0, 12000);

  // 3. Ask the AI for a review, in JSON only
  const completion = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
    response_format: { type: 'json_object' },
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'You are a careful senior code reviewer. Review only the added lines (starting with +). ' +
          'Return at most 5 comments that are specific and useful: real bugs, risks, or clear style problems. ' +
          'If nothing is worth saying, return an empty list. ' +
          'Respond ONLY with JSON: {"comments":[{"path":string,"line":number,"severity":"bug"|"risk"|"style","body":string}]}. ' +
          '"line" is the line number in the new version of the file.',
      },
      { role: 'user', content: diffText },
    ],
  });

  // 4. Check the answer has the right shape before trusting it
  const raw = completion.choices[0]?.message?.content ?? '{"comments":[]}';
  return ReviewSchema.parse(JSON.parse(raw));
}