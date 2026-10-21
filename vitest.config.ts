import { defineConfig } from 'vitest/config';

// Server tests only. The dashboard in /web has its own Vitest config.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
