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
├── docker-compose.yml Local Postgres
└── .env.example       Required environment variables
```

## Running locally

```bash
nvm use                       # Node 22
npm install                   # installs both workspaces
npm run db:up                 # start local Postgres (Docker)
cp .env.example server/.env   # then fill in values
npm run dev                   # API on :4000, client on :5173
```

_More sections (architecture, AI integration, API docs) will be added as the
project develops._
