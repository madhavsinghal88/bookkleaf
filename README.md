# BookLeaf Author Support & Communication Portal

A web app for BookLeaf Publishing's author support, with two interfaces:

- **Author Portal**: authors log in, see their books and royalties, raise support queries, and follow replies live.
- **Support Desk (admin)**: the ops team works an urgency-sorted queue where every ticket is **auto-classified and prioritised by AI**, and each ticket opens with an **AI-drafted reply grounded in the BookLeaf Knowledge Base** for the agent to review, edit and send.

**Live demo:** [https://bookkleaf-ttj1-delta.vercel.app/books](https://bookkleaf-ttj1-delta.vercel.app/books) · **Stack:** React + Vite · Express + TypeScript · PostgreSQL (Neon) + Prisma · OpenAI · Vercel

---

## How to use

Start the app with the steps under [Running locally](#running-locally), then open http://localhost:5173.

### Sign in

On the login page, every author from the sample file is listed under the form, with city and email. One click signs that person in. The password for every author is `author123`. You can also type an email and password and press **Submit**.

| Button | Opens |
|---|---|
| Priya Sharma through Diya Chatterjee | That author's books, in the same order as the sample file |
| Ananya Reddy | The fullest author account, with five titles |
| Sneha Kulkarni | An author who still has a book in production |
| Kavita Deshmukh | An author with a book in typesetting and a royalty below the payout threshold |
| Admin: Aisha Verma | The support desk |

### Before you sign in

The login page is also the public publishing site.

- **Packages** describes Standard Free and Bestseller Breakthrough. The paid package has no public price; the team quotes it.
- **Publish with us**, or the round button at the bottom right, opens the publishing advisor.
- **About** is the “Get in touch” form (name, email, country code, phone). Sending it stores a new sales chat and opens the advisor with that conversation.
- In either chat, **New** starts a blank conversation and **Saved** reopens an earlier one. A reply in a saved chat stays in that chat.

### As an author

- **My Books** shows copies sold and royalty earned, paid, and pending, then one card per book. A book still in production shows its stage. A live book shows price, sales, and payouts. Balances under ₹1,000 roll to the next quarter.
- **Ask a question** or **New Query** raises a ticket about a book. The team sees it on the support desk, already classified.
- **My Tickets** lists your queries. Open one to read replies. The page refreshes while it is open.
- The round **Help** button is the author assistant. It starts a new chat. **Saved** keeps earlier chats, named from the first question. Ask it about royalties, production, or where a book is listed. When the team needs to change something, use **New Query**.
- Your name in the header opens **Profile**, **English** / **हिन्दी**, and **Log out**. Profile edits your name, and for an author also phone and city. Email stays the sign-in address. The language choice is saved on the account and switches the portal, including My Books and the menus.

### As an admin

Sign in with **Admin: Aisha Verma**.

- **Ticket Queue** lists open work, most urgent first. Filter by status, priority, category, assignee, date, or subject.
- Open a ticket to see the classification, an AI draft, and a checklist. Edit the draft and send it, or write your own reply. Internal notes stay off the author’s view. You can change status, category, priority, and assignee. Overrides are kept if classification runs again.
- **Insights** shows queue counts and 30-day AI usage, cost, and how often an admin changed the AI’s category or priority.
- Admins can open **Profile** to change their name and language. They do not get the author Help button.

---

## Test credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@bookleaf.com` | `admin123` |
| Admin | `ops@bookleaf.com` | `admin123` |
| Author | any author email from the dataset, e.g. `priya.sharma@email.com` | `author123` |

Useful authors for edge cases:

| Author | Why |
|---|---|
| `ananya.reddy@email.com` | Five books. *Between Two Temples* has never been paid (₹2,546 pending). *Bangles of the Musi* is under the ₹1,000 payout threshold. *The Deccan Hour* is in proofreading |
| `sneha.kulkarni@email.com` | Has a book still in production (Cover Design) |
| `kavita.deshmukh@email.com` | Book in Typesetting, plus ₹850 pending (below the ₹1,000 payout threshold) |
| `meera.nair@email.com` | Fully paid up; has a resolved ticket |

The names under the login form sign those accounts in with one click. The database is seeded with the provided dataset (10 authors, 22 books) and four sample tickets. Ananya Reddy's account has five books.

---

## Running locally

Requirements: Node 20+ and a Postgres database (a free [Neon](https://neon.com) project, or `docker compose up -d db` for a local one).

```bash
npm install                              # installs both workspaces
cp .env.example server/.env              # then fill in the values (see below)
npm run db:migrate --workspace server    # create tables
npm run db:seed --workspace server       # load the sample dataset (resets data)
npm run dev                              # API on :4000, client on :5173
```

Open http://localhost:5173. Vite proxies `/api` to the Express server.

### Environment variables (`server/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres URL (Neon *pooled* endpoint) used by the app |
| `DIRECT_URL` | for migrations | Neon *direct* endpoint, used by Prisma Migrate |
| `JWT_SECRET` | yes | ≥32 random characters (`openssl rand -hex 32`) |
| `OPENAI_API_KEY` | no | Enables AI. Without it the app runs with rule-based classification and template drafts |
| `AI_CLASSIFY_MODEL` | no | Default `gpt-4o-mini` |
| `AI_CHAT_MODEL` | no | Default `gpt-4o-mini` |
| `AI_DRAFT_MODEL` | no | Default `gpt-4o-mini` |
| `CLIENT_ORIGIN` | no | CORS origin for local development, default `http://localhost:5173` |

All configuration is validated at startup ([server/src/config/env.ts](server/src/config/env.ts)), so a missing secret fails fast.

### Deployment

The app is deployed on Vercel at [bookkleaf-ttj1-delta.vercel.app](https://bookkleaf-ttj1-delta.vercel.app/books) as one project with two [services](https://vercel.com/docs/services) ([vercel.json](vercel.json)): `/api/*` routes to the Express service and everything else to the Vite client, all on one domain. The server build applies Prisma migrations to Neon. Set the variables above in the Vercel project settings; nothing secret is committed.

---

## Architecture

```
client/  React SPA ──fetch /api──►  server/  Express REST API ──Prisma──► Neon Postgres
                                       │
                                       └──► OpenAI (classification, drafts, chat)
```

```
server/src/
├── config/env.ts          Validated environment (fail fast)
├── middleware/            auth (JWT, requireRole), error handler
├── routes/                HTTP layer: parse/validate input, call services
├── services/              Business logic: tickets, books, auth, admin stats
│   └── ai/                AI integration: llm wrapper, classifier, drafter,
│                          knowledge base, account facts, rule fallbacks
├── lib/                   prisma client, errors, validation helper
└── generated/prisma/      Generated Prisma client (not committed)
client/src/
├── api/                   fetch wrapper + response types
├── auth/                  session context
├── hooks/usePolling.ts    near-real-time refresh
├── components/            layout, thread, badges
└── pages/author|admin/    one file per screen
```

### Key decisions

- **Layers.** Routes only parse input and shape output; services hold the rules (who can see what, status transitions, AI orchestration). The AI code sits behind two functions, `classifyTicket` and `draftReply`, and neither of them throws.
- **Data model** ([schema.prisma](server/prisma/schema.prisma)):
  - **Users and authors are separate tables.** `User` holds the login and role; `Author` holds the profile. Admins have no books, and all login handling lives in one place.
  - **Ticket messages have a kind.** `TicketMessage.kind` is either `REPLY` or `INTERNAL_NOTE`. Author endpoints filter internal notes out in the SQL query itself, so a note can't reach an author through a serialisation mistake.
  - **Classification records its source.** `categorySource` and `prioritySource` are `AI`, `RULES` or `ADMIN`. Admin overrides are never overwritten by re-classification, and the Insights page uses these fields to measure how often humans disagree with the AI.
  - **Every AI call is logged.** `AiCallLog` holds one row per call (tokens, cache hits, latency, error). This is the evidence behind the cost and failure numbers.
  - **Drafts are cached.** `AiDraft` stores one draft per ticket and is reused until the conversation changes.
- **Access control is enforced in the API.** Authors are scoped to their own `authorId` in every query, and another author's resource returns 404, not 403, so ticket and book IDs can't be probed. Admin routes are behind `requireRole("ADMIN")`. The client-side route guard is only a convenience.
- **Real time uses polling, not WebSockets or SSE.** Ticket views poll every 5 seconds while the tab is visible. Express sets ETags, so an unchanged poll returns `304` with no body. The API runs as Vercel serverless functions, which can't hold long-lived connections, and the brief allows polling. In tests, an admin's reply appeared on the author's screen in about 4 seconds.
- **The ticket is saved before any AI runs.** `POST /api/tickets` saves and returns `201` immediately. Classification runs afterwards through Vercel's `waitUntil`, so a slow or failed AI call never blocks an author. If an instance dies mid-call, any ticket still unclassified after 30 seconds is picked up the next time an admin loads the queue, with no scheduler needed.
- **Prisma + Postgres on Neon.** The schema is relational (authors → books → tickets → messages) and benefits from types and migrations. Neon is serverless Postgres with a connection pooler, which suits serverless functions.

---

## AI integration

### What the AI does

| Feature | When | Model | Output |
|---|---|---|---|
| Classification | Each new ticket, in the background | `gpt-4o-mini` | `{ category, priority, summary }` via structured outputs (Zod schema) |
| Reply draft | Admin opens a ticket that's waiting on BookLeaf | `gpt-4o-mini` | `{ reply, checklist }` via structured outputs |
| Author chat and sales chat | Each message | `gpt-4o-mini` | `{ reply }` via structured outputs |

**Why this model:** classification, chat, and drafts are all short tasks with a fixed shape. `gpt-4o-mini` follows the tone guide and quotes the figures the server already computed, at roughly a fraction of a cent per call. Drafts are still generated once per conversation state. Set `AI_DRAFT_MODEL=gpt-4o` if a ticket needs a stronger writer; no code change is required.

### Prompt design

([server/src/services/ai/](server/src/services/ai/))

- **The knowledge base is split by category** ([knowledge-base.ts](server/src/services/ai/knowledge-base.ts)).
  - The persona, tone guidelines and company overview form one base block that every draft shares.
  - Each category has its own policy section plus the matching sample query and response from the brief.
  - A royalty draft therefore never carries ISBN or printing policy.
- **Facts are computed in code, not by the model** ([facts.ts](server/src/services/ai/facts.ts)).
  - Before each call, the server builds a short account summary: the book's status, sales, paid and pending royalty, and last payout.
  - It also works out the next payout deadline from the quarterly + 45-day rule, whether the pending amount is below the ₹1,000 threshold, and whether a payout looks overdue.
  - The prompt tells the model to quote these facts and never invent numbers. That way "provide the specific next payout date" is answered with a real date (for example 14 Nov 2026 for July–September sales) instead of the model doing calendar arithmetic.
- **The tone rules from the brief are part of the system prompt.** They cover acknowledging the concern first, owning BookLeaf's mistakes, giving concrete timelines and ending with a next step. The prompt also sets a length target and the sign-off.
- **Checklist.** The draft comes with a short list for the agent, such as "Trigger Amazon re-sync" or "Verify bank details are linked", so the follow-up work isn't lost.
- **Prompt-injection hygiene.** Ticket text is wrapped in `<ticket>` tags, and both prompts state that it is untrusted data to classify or answer, never instructions to follow. Internal notes reach the drafter as context, with an instruction never to reveal them.
- **The priority rubric weighs facts over tone.** "Haven't received royalty for months" with money pending above the threshold scores higher than "Can I update my bio?". An angry message about something routine doesn't become Critical.

### Cost awareness

- **The full knowledge base is never sent.** Classification receives only the category definitions and the priority rubric. Drafts receive the shared base block plus one category section.
- **Prompt caching.** The static system text (persona, then the one relevant policy) is the prefix of every request. OpenAI caches that prefix automatically on repeat calls, so only the account facts and the ticket are new input.
- **Bounded history.** A draft includes at most the last 6 messages, each capped at 1,500 characters, and the description is capped at 4,000 characters. Token use stays flat even on long threads.
- **Each draft is generated once.** It's cached in `AiDraft` and reused until the author replies; internal notes don't invalidate it. The client only asks for a draft when the author is waiting on BookLeaf, so no draft is paid for right after the team has replied.
- **One inexpensive model.** `gpt-4o-mini` does classification, chat, and drafts. A stronger model is an environment variable away.
- **Measured, not guessed.** Every call's input, output and cache-read tokens and latency go to `AiCallLog`. The **Insights** page shows 30-day calls, failures, latency, tokens, estimated cost, and how often admins override the AI.

### Graceful degradation

| Failure | Behaviour |
|---|---|
| No API key configured | AI is reported as offline on Insights. Tickets are classified by keyword rules ([rules.ts](server/src/services/ai/rules.ts)), and drafts fall back to a category template with the correct policy timeline |
| Rate limit, 5xx, timeout | The SDK retries twice with backoff (25-second timeout). The call is then logged as failed and the same fallbacks apply. A circuit breaker skips AI calls for 60 seconds, so users don't each wait out retries during an outage |
| Unparseable output or refusal | Treated as a failure and the fallback is used |
| AI slow | Ticket creation is never blocked, because classification runs after the response. In the queue, unclassified tickets show "Classifying…" and sort to the top so nothing urgent is hidden |

The admin can always write a reply manually, and the UI shows which values came from the AI, the keyword rules or an admin (the `AI` / `Rules` / `Admin` tags).

---

## API reference

Base path: `/api`. Request and response bodies are JSON. Every endpoint except `POST /auth/login`, `GET /health`, and the public sales chat needs `Authorization: Bearer <token>`.

**Errors** always look like this:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed",
             "details": [{ "field": "subject", "message": "Subject must be at least 5 characters" }] } }
```

| Status | Code |
|---|---|
| 400 | `VALIDATION_ERROR`, `BAD_REQUEST`, `INVALID_JSON` |
| 401 | `UNAUTHORIZED`, `INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 500 | `INTERNAL_ERROR` (details are logged on the server, never sent to the client) |

### Auth
| Method | Path | Who | Description |
|---|---|---|---|
| POST | `/auth/login` | public | Body `{ email, password }` → `{ token, user }`. The token is a JWT valid for 8 hours |
| GET | `/auth/me` | any | Current user's profile, including language and, for an author, phone, city, and joined date |
| PATCH | `/auth/me` | any | Body `{ name, language: "en" \| "hi", phone?, city? }` → `{ token, user, profile }`. A new token is issued because the name is inside the JWT. Phone and city apply only to authors |

### Chat
| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/chat/sales?sessionId=&threadId=` | public | Saved sales chats for that browser session. Omit `threadId` to start a new chat and only list saved ones. `sessionId` is a UUID the browser keeps |
| POST | `/chat/sales` | public | Body `{ sessionId, message, threadId? }` → `{ threadId, messages }`. With no `threadId`, the message starts and stores a new chat |
| GET | `/chat/support?threadId=` | author | Same shape for the signed-in author. Omit `threadId` for a new chat plus the saved list |
| POST | `/chat/support` | author | Body `{ message, threadId? }` → `{ threadId, messages }` |

### Books
| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/books` | author / admin | Authors: own books. Admins: all books, `?authorId=` to filter. Returns `{ items }` |
| GET | `/books/:id` | author / admin | One book. An author asking for another author's book gets 404 |

### Tickets
| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/tickets` | author / admin | Authors: own tickets. Admins: the queue (see query parameters below). Returns `{ items, total, page, pageSize }` |
| POST | `/tickets` | author | Body `{ bookId \| null, subject (5–150), description (20–5000), attachmentName? }` → `201` with the ticket. Classification runs in the background |
| GET | `/tickets/:id` | author / admin | Ticket with messages. Authors never receive internal notes or triage fields. Supports ETag / `304` for polling |
| PATCH | `/tickets/:id` | admin | Any of `{ status, category, priority, assigneeId }`. `assigneeId: "me"` assigns to yourself, `null` unassigns. Category and priority set here are marked as admin overrides |
| POST | `/tickets/:id/messages` | author / admin | Body `{ body, kind?: "REPLY" \| "INTERNAL_NOTE", status?, fromAiDraft? }`. Notes are admin-only. An admin's first reply sets the first-response time and claims an unassigned ticket. An author's reply reopens a resolved ticket; closed tickets return 409 |
| GET | `/tickets/:id/draft` | admin | AI-drafted reply `{ content, checklist, source: "AI" \| "TEMPLATE", cached, model, ai }`, served from cache while the conversation is unchanged |
| POST | `/tickets/:id/draft` | admin | Force a fresh draft |
| POST | `/tickets/:id/classify` | admin | Re-run classification. Admin overrides are kept |

`GET /tickets` query parameters (admin):

| Parameter | Values |
|---|---|
| `status` | Comma-separated: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`. Default `OPEN,IN_PROGRESS` |
| `category` | One category, e.g. `ROYALTY_PAYMENTS` |
| `priority` | `CRITICAL`, `HIGH`, `MEDIUM` or `LOW` |
| `assignee` | `me` or `unassigned` |
| `authorId`, `bookId` | Filter by author or book |
| `from`, `to` | Dates; filters on when the ticket was created |
| `q` | Searches the subject |
| `sort` | `urgency` (default: priority, then oldest first), `oldest`, `newest`, `updated` |
| `page`, `pageSize` | Page number; page size up to 100 |

### Admin
| Method | Path | Description |
|---|---|---|
| GET | `/admin/team` | Admins that tickets can be assigned to |
| GET | `/admin/stats` | Queue counts, plus 30-day AI usage, estimated cost, override rates and AI status |

### Example
```bash
TOKEN=$(curl -s -X POST localhost:4000/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"ananya.reddy@email.com","password":"author123"}' | jq -r .token)

curl -s -X POST localhost:4000/api/tickets -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"bookId":"BK005","subject":"Royalty not received","description":"I have sold 67 copies but have never been paid."}'
```

---

## Known limitations and next steps

- **Attachments are UI-only.** Only the file name is stored. Next: upload to object storage (S3, R2, or Neon/Vercel storage) using presigned URLs.
- **The session token is stored in `localStorage`.** That's simple, but an httpOnly cookie with CSRF protection would be safer against XSS. There's also no password reset and no login rate limiting yet.
- **Polling, not push.** It's fine at this scale. At higher volume, a managed realtime channel (Neon Realtime, Pusher, Ably) or SSE on a long-running host would replace it.
- **The circuit breaker and in-flight guard are per instance.** A shared store such as Redis would coordinate them across serverless instances. A queue such as Vercel Queues would make background classification durable.
- **The AI has no evaluation suite yet.** The next step is a labelled set of real tickets to measure classification accuracy and draft quality, and to tune prompts against it. The admin override rate on Insights is the first production signal for this.
- **Knowledge-base retrieval is by category.** That fits a knowledge base this size. A larger one would need embedding-based retrieval of the relevant passages.
- **No automated test suite.** Behaviour was verified end to end against the API and in a real browser. Next: unit tests for `facts.ts`, `rules.ts` and the access-control rules, plus API integration tests.
