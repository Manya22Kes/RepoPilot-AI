<div align="center">

# 🤖 RepoPilot AI

### *Autonomous GitHub Operations, Intelligent Issue Triage & PR Management*

An AI bot that triages GitHub issues, summarizes pull requests, catches duplicate issues, nudges stale PRs, drafts release notes on tag pushes, and flags documentation that a merged PR probably made stale — with a dashboard to review and approve anything higher-stakes than a label.

<br/>

[![Live Deployment](https://img.shields.io/badge/Live_Deployment-Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)](https://repopilot-ai-production.up.railway.app)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![Redis](https://img.shields.io/badge/Redis-BullMQ-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

<br/>

🌐 **Live Deployment:** [https://repopilot-ai-production.up.railway.app](https://repopilot-ai-production.up.railway.app)  
*(Demo Credentials — **Email:** `user@repopilot.live` • **Password:** `repopilot`)*

<br/>

[Features](#-features) •
[Tech Stack](#-stack) •
[Setup & Installation](#-setup) •
[Running Tests](#-tests) •
[Deployment](#-deploying) •
[License](#-license)

---

</div>

## ✨ Features

- **🏷️ Automated Issue Labeling & Priority Estimation**
  - Auto-labels new issues (`bug` / `feature` / `docs` / `question`) and estimates priority.

- **🔍 Semantic Duplicate Detection**
  - Detects likely duplicate issues using embeddings + an LLM verification step, not just title matching.

- **📝 PR Summarization**
  - Summarizes new pull requests as a bot comment.

- **⏰ Inactivity Nudges**
  - Nudges pull requests that have gone quiet.

- **🚀 Automated Release Notes**
  - Drafts release notes as a GitHub draft release when you push a tag.

- **📚 Documentation Staleness Alerts**
  - Flags merged PRs that might have made docs stale, with suggested updates.

- **🎛️ Operations & Control Dashboard**
  - View installed repos and configure per-repo feature toggles.
  - Review comprehensive run history and logs.
  - Human-in-the-loop approval queue for anything the bot won't do automatically.
  - Transparent cost breakdown of LLM usage.

---

## 🛠️ Stack

| Category | Technologies |
| :--- | :--- |
| **Backend & Runtime** | Node.js, Express |
| **Task Queue & Cache** | BullMQ, Redis |
| **Database & Vector Store** | PostgreSQL + pgvector |
| **Frontend Dashboard** | React (Vite) |
| **AI / LLM Providers** | Gemini / OpenAI |
| **Orchestration** | Docker Compose |

> Everything runs seamlessly via **Docker Compose**.

---

## 🚀 Setup

You'll need a **GitHub App** (for the bot to act on your behalf) and a **Gemini** or **OpenAI** API key.

### 1. Configure Environment

Copy the example environment file and add your credentials:

```bash
cp .env.example .env
# fill in your GitHub App credentials and LLM API key
```

### 2. Start Infrastructure & Run Migrations

Start PostgreSQL and Redis services, install dependencies, and run database migrations:

```bash
docker compose up -d redis postgres
npm install
npm run migrate
```

### 3. Run the Application

Build and start all services using Docker Compose:

```bash
docker compose up --build
```

### 4. Access URLs & Demo Credentials

Once started, the services are available at:

| Environment | Service | URL | Details / Credentials |
| :--- | :--- | :--- | :--- |
| **Production** | **Live App & Dashboard** | [`https://repopilot-ai-production.up.railway.app`](https://repopilot-ai-production.up.railway.app) | **Email:** `user@repopilot.live`<br/>**Password:** `repopilot` |
| **Local** | **Application / API** | [`http://localhost:3000`](http://localhost:3000) | Root API endpoint |
| **Local** | **Dashboard** | [`http://localhost:3000/dashboard`](http://localhost:3000/dashboard) | Web interface |

> 🔑 **Demo Login Details:**  
> - **Email:** `user@repopilot.live`  
> - **Password:** `repopilot`

> **Local Webhook Testing:** Point a tunnel (`ngrok` or similar) at port `3000` and use that URL as your GitHub App's webhook URL.

---

## 🧪 Tests

Run test suites for the backend and dashboard:

```bash
npm test              # backend
cd dashboard && npm test   # dashboard
```

> **Requirement:** Requires Redis and Postgres running.

---

## 🚢 Deploying

- **Live Deployment:** Accessible in production at [`https://repopilot-ai-production.up.railway.app`](https://repopilot-ai-production.up.railway.app) (Demo login: `user@repopilot.live` / `repopilot`).
- Any host that can run **Docker** works.
- Postgres needs the **`pgvector`** extension — the `pgvector/pgvector:pg16` image used in `docker-compose.yml` has it built in.

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
