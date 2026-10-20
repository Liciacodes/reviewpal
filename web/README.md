# ReviewPal dashboard

Next.js app that shows the AI reviews stored by the ReviewPal server.

## Run

1. Start the API first, from the repo root: `npm run dev` (port 3000)
2. Then here: `npm install` (first time only) and `npm run dev`
3. Open http://localhost:3001

The API URL comes from `NEXT_PUBLIC_API_URL` (default `http://localhost:3000`).
To change it, copy `.env.example` to `.env.local` and edit it.

## Pages

- `/`: stats and recent reviews
- `/reviews`: the 50 most recent reviews
- `/reviews/[id]`: diffs with the AI comments inline, and Useful / Not useful buttons
- `/settings`: API URL and a connection check
