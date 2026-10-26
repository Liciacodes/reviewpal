import { describe, expect, it, vi } from 'vitest';

// usage.ts imports the database client; a stand-in is enough because postNoticeOnce gets its steps passed in
vi.mock('./db.js', () => ({ prisma: {} }));

const { postNoticeOnce } = await import('./usage.js');
const { Prisma } = await import('./generated/prisma/client.js');

// The error Prisma throws when the unique row (repo + PR + kind) already exists
const alreadyThere = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });

describe('postNoticeOnce: at most one comment per PR', () => {
  it('posts the first time', async () => {
    const postComment = vi.fn(async () => ({}));
    const result = await postNoticeOnce({ createNotice: async () => ({}), deleteNotice: async () => ({}), postComment }, 'pr');
    expect(result).toBe('posted');
    expect(postComment).toHaveBeenCalledTimes(1);
  });

  it("doesn't post again when the notice was already posted", async () => {
    const postComment = vi.fn(async () => ({}));
    const result = await postNoticeOnce(
      { createNotice: async () => Promise.reject(alreadyThere()), deleteNotice: async () => ({}), postComment },
      'pr'
    );
    expect(result).toBe('already-posted');
    expect(postComment).not.toHaveBeenCalled();
  });

  it('never throws when GitHub refuses, and forgets the notice so a later push can try again', async () => {
    const deleteNotice = vi.fn(async () => ({}));
    const result = await postNoticeOnce(
      { createNotice: async () => ({}), deleteNotice, postComment: async () => Promise.reject(new Error('403')) },
      'pr'
    );
    expect(result).toBe('failed');
    expect(deleteNotice).toHaveBeenCalledTimes(1);
  });
});
