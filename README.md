# RepoPilot AI

An AI bot that triages GitHub issues, summarizes pull requests, catches
duplicate issues, nudges stale PRs, drafts release notes on tag pushes,
and flags documentation that a merged PR probably made stale — with a
dashboard to review and approve anything higher-stakes than a label.

## Features

- Auto-labels new issues (bug / feature / docs / question) and estimates
  priority
- Detects likely duplicate issues using embeddings + an LLM verification
  step, not just title matching
- Summarizes new pull requests as a bot comment
- Nudges pull requests that have gone quiet
- Drafts release notes as a GitHub draft release when you push a tag
- Flags merged PRs that might have made docs stale, with suggested
  updates
- Dashboard: installed repos, per-repo feature toggles, run history, an
  approval queue for anything the bot won't do automatically, and a cost
  breakdown of LLM usage

## Stack

Node.js, Express, BullMQ, Redis, PostgreSQL + pgvector, React (Vite),
Gemini / OpenAI. Everything runs via Docker Compose.

## Setup

You'll need a GitHub App (for the bot to act on your behalf) and a
Gemini or OpenAI API key.

```bash
cp .env.example .env
# fill in your GitHub App credentials and LLM API key
```

Start the infrastructure and run migrations:

```bash
docker compose up -d redis postgres
npm install
npm run migrate
```

Run everything:

```bash
docker compose up --build
```

The app runs on `http://localhost:3000`, and the dashboard is at
`http://localhost:3000/dashboard`.

For local webhook testing, point a tunnel (ngrok or similar) at port
3000 and use that URL as your GitHub App's webhook URL.

## Tests

```bash
npm test              # backend
cd dashboard && npm test   # dashboard
```

Requires Redis and Postgres running.

## Deploying

Any host that can run Docker works. Postgres needs the pgvector
extension — the `pgvector/pgvector:pg16` image used in
`docker-compose.yml` has it built in.

## License

MIT
