# RepoPilot AI

An AI agent that handles the repetitive parts of maintaining a GitHub
repo: labeling issues, catching duplicates, summarizing pull requests,
nudging stale PRs, drafting release notes, and flagging documentation
that's fallen out of date.

## Why

Maintaining a repo involves a lot of small, repetitive work that nobody
particularly enjoys: reading every new issue and figuring out if it's a
bug or a feature request, noticing when someone's reported the same
thing three times under different wording, reading a 300-line diff just
to understand what it does before reviewing it properly, remembering to
write release notes, and so on. None of it is hard. It's just constant
and easy to let slip.

This project automates the parts that are safe to automate, and leaves
the parts that actually matter — like closing someone's issue as a
duplicate — to an actual human, via a review queue in a dashboard.

## How it works

A GitHub App receives webhooks for issues, pull requests, and pushes.
Each event goes into a queue and gets picked up by a worker, which calls
an LLM to decide what to do, then writes the result back to GitHub
(a label, a comment, a draft release).

The LLM layer is provider-agnostic — it can call Gemini or OpenAI, and
falls back automatically if one is down. If every provider fails,
classification falls back to a simple rule-based approach rather than
failing the whole job.

Duplicate detection works by embedding each issue and comparing it
against previously seen issues in the same repo using pgvector, then
asking the LLM to confirm whether a semantically similar issue is
actually the same bug, not just a related topic.

Anything higher-consequence than applying a label — closing an issue,
suggesting a docs change — gets queued for a human to approve or reject
from the dashboard instead of happening automatically.

## Stack

- Node.js / Express backend, BullMQ + Redis for the job queue
- PostgreSQL with pgvector for embeddings
- React (Vite) dashboard
- Gemini / OpenAI for classification, summarization, and embeddings
- Docker Compose for local dev and deployment

## What's not here yet

- A public demo repo with the app installed
- Multi-user accounts for the dashboard (currently one shared login)
- Support for anything other than GitHub

## License

MIT
