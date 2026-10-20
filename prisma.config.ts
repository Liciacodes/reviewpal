import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Settings for the Prisma CLI (migrate, studio, generate).
// Migrations use the DIRECT connection: Neon's pooler doesn't support everything migrations need.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DIRECT_URL') },
});
