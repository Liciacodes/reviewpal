# ReviewPal dashboard

Next.js app that shows the AI reviews stored by the ReviewPal server.

## Run

1. Start the API first, from the repo root: `npm run dev` (port 3000)
2. Then here: `npm install` (first time only) and `npm run dev`
3. Open http://localhost:3001 and sign in with GitHub

The browser only talks to this dashboard. `next.config.ts` forwards `/api`, `/auth` and `/health`
to the API at `API_ORIGIN` (default `http://localhost:3000`), so the sign-in cookies stay on one domain.
To change it, copy `.env.example` to `.env.local` and edit it.

## Pages

- `/sign-in`: Sign in with GitHub (every other page needs a session; see `proxy.ts`)
- `/`: stats and recent reviews
- `/reviews`: the 50 most recent reviews
- `/reviews/[id]`: diffs with the AI comments inline, and Useful / Not useful buttons
- `/settings`: a connection check
