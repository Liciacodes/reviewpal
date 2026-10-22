// Imported FIRST by src/index.ts (right after dotenv), so it runs before any other module
// reads the settings. If something is missing, it lists the names and stops the server.
import 'dotenv/config';
import fs from 'node:fs';
import { configProblems } from './config.js';

const problems = configProblems(process.env, (path) => fs.existsSync(path));
if (problems.length > 0) {
  console.error('ReviewPal cannot start. Fix these settings (in .env locally, or in Render → Environment):');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
