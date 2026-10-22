// Checks the server's settings and loads the GitHub App private key.
// Pure: the environment and a file reader are passed in, so it's easy to test.
// Never put a variable's VALUE in a message: only its name.

type Env = Record<string, string | undefined>;

// Needed everywhere (local and production)
const REQUIRED = [
  'DATABASE_URL',
  'WEBHOOK_SECRET',
  'GITHUB_APP_ID',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GROQ_API_KEY',
  'TOKEN_ENCRYPTION_KEY',
] as const;

const isSet = (value: string | undefined) => value !== undefined && value.trim() !== '';

// Every problem with the settings, as readable lines (empty = all good)
export function configProblems(env: Env, fileExists: (path: string) => boolean): string[] {
  const problems: string[] = [];
  for (const name of REQUIRED) {
    if (!isSet(env[name])) problems.push(`${name} is missing`);
  }

  // The private key: a file path (local .pem, or a Render Secret File) OR the key itself
  if (isSet(env.GITHUB_PRIVATE_KEY_PATH)) {
    if (!fileExists(env.GITHUB_PRIVATE_KEY_PATH!)) problems.push('GITHUB_PRIVATE_KEY_PATH points to a file that does not exist');
  } else if (!isSet(env.GITHUB_PRIVATE_KEY)) {
    problems.push('GITHUB_PRIVATE_KEY_PATH or GITHUB_PRIVATE_KEY is missing (set one of them)');
  }

  if (isSet(env.TOKEN_ENCRYPTION_KEY) && Buffer.from(env.TOKEN_ENCRYPTION_KEY!.trim(), 'base64').length !== 32) {
    problems.push('TOKEN_ENCRYPTION_KEY must be 32 random bytes in base64');
  }

  // Optional: the public repo shown in the read-only demo
  if (isSet(env.DEMO_REPO) && !/^[\w.-]+\/[\w.-]+$/.test(env.DEMO_REPO!.trim())) {
    problems.push('DEMO_REPO must look like owner/name (e.g. Liciacodes/reviewpal-playground), or be left unset');
  }

  // In production the sign-in callback must point at the real dashboard, over HTTPS
  if (env.NODE_ENV === 'production') {
    if (!isSet(env.DASHBOARD_URL)) problems.push('DASHBOARD_URL is missing (the dashboard address, e.g. https://reviewpal.vercel.app)');
    else if (!env.DASHBOARD_URL!.startsWith('https://')) problems.push('DASHBOARD_URL must start with https:// in production');
  }
  return problems;
}

// The GitHub App private key, from the file if GITHUB_PRIVATE_KEY_PATH is set, else from GITHUB_PRIVATE_KEY.
// Dashboards that store env vars on one line often turn line breaks into the two characters "\n";
// those are turned back into real line breaks.
export function loadPrivateKey(env: Env, readFile: (path: string) => string): string {
  if (isSet(env.GITHUB_PRIVATE_KEY_PATH)) return readFile(env.GITHUB_PRIVATE_KEY_PATH!);
  if (isSet(env.GITHUB_PRIVATE_KEY)) return env.GITHUB_PRIVATE_KEY!.replace(/\\n/g, '\n').trim() + '\n';
  throw new Error('GITHUB_PRIVATE_KEY_PATH or GITHUB_PRIVATE_KEY is missing');
}
