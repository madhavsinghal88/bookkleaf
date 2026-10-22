# BookLeaf Author Support & Communication Portal

A web app with an author-facing portal and an admin-facing portal for handling
author support queries, with AI-assisted ticket classification, prioritisation
and response drafting.

## Project structure

```
bookleaf/
├── client/            React + Vite + TypeScript (author & admin UIs)
├── server/            Express + TypeScript REST API
│   └── src/
│       ├── config/    Environment validation
│       ├── routes/    HTTP route definitions
│       ├── middleware/ Auth, RBAC, validation, error handling
│       ├── services/  Business logic (tickets, AI, etc.)
│       └── lib/       Shared helpers
├── docker-compose.yml Optional offline Postgres (primary DB is Neon)
└── .env.example       Required environment variables
```

## Running locally

```bash
nvm use                       # Node 22
npm install                   # installs both workspaces
cp .env.example server/.env   # fill in Neon URLs + JWT secret
npm run db:migrate --workspace server   # create tables
npm run db:seed --workspace server      # load sample dataset
npm run dev                   # API on :4000, client on :5173
```

The database is hosted on [Neon](https://neon.com) (serverless Postgres).
The app connects through Neon's pooled endpoint; Prisma migrations use the
direct endpoint (`DIRECT_URL`).

_More sections (architecture, AI integration, API docs) will be added as the
project develops._
