# RevAI Technical Deep Dive (End-to-End)

**RevAI** is an AI-assisted social engagement automation system built as a **Next.js 14 App Router** monorepo. It connects to social platforms (OAuth), lets users select which assets to monitor, fetches comments, generates contextual AI replies using **Google Gemini**, supports human approval, and posts replies back to platforms. Automation is orchestrated with **Apache Airflow**.

This document is intentionally comprehensive: it explains the **entire workflow**, the **data model**, the **API contracts**, the **Airflow DAGs**, security decisions, and the **alternatives considered**.

---

## 1) System goals and constraints

- **Goal**: Demonstrate a working pipeline end-to-end:
  - Connect platform → select content → fetch comments → generate AI reply → approve → post → report.
- **Constraint**: Must include **Airflow** orchestration (academic requirement / scalability narrative).
- **Constraint**: Must use an external model API (**Gemini**) instead of running local LLMs (time + reliability).
- **Reliability**: Maintain **two working platform paths** for demo safety (currently **YouTube + Reddit** are the preferred demo path).

---

## 2) High-level architecture

RevAI uses **two databases** and a **single web application**:

- **Next.js web app**
  - UI pages: `app/dashboard/**`, `app/auth/**`, `app/page.tsx`
  - API routes: `app/api/**/route.ts`
  - Auth: NextAuth (`lib/auth.ts`)

- **PostgreSQL (Prisma)**
  - Purpose: structured, relational, sensitive data
  - Stores: users, OAuth connections/tokens (encrypted), monitored content, user settings, rate limits

- **Firebase Firestore**
  - Purpose: high-volume, flexible comment/reply/report documents
  - Stores: comments, classifications, generated replies, posting metadata, reports

- **Apache Airflow (Docker)**
  - Fetch DAG: pull new comments
  - Process DAG: classify + generate replies
  - Post DAG: post queued replies and update status

### Why split Postgres + Firestore?

- **Postgres** is best for:
  - strong consistency (ACID)
  - relational constraints (uniqueness per platform, connection ownership)
  - storing sensitive/critical configuration (encrypted tokens, rate counters)
- **Firestore** is best for:
  - high volume event-like documents (comments)
  - flexible schema across different platform payloads
  - fast query iteration for “inbox” style UI

Alternatives and tradeoffs are detailed later.

---

## 3) Repository layout (important directories)

```
app/
  api/                 Next.js API routes (backend)
  dashboard/           Protected pages (UI)
  auth/                Login / register pages
components/            UI layout + shared components
lib/
  db/                  Postgres + Firestore clients
  integrations/        YouTube / Reddit / Instagram / Gemini clients
  security/            Encryption utilities
prisma/
  schema.prisma        Postgres schema
airflow/
  dags/                Airflow DAG definitions
  tasks/               Airflow helpers (db access, platform calls, gemini)
docs/                  Project documentation
docker-compose.yml     Local infra (Postgres + Airflow)
```

---

## 4) Authentication and identity (NextAuth)

All protected pages and protected API routes require a valid session.

- **UI** uses NextAuth client session on dashboard pages:
  - `useSession()` in `components/DashboardLayout.tsx` and most `app/dashboard/**` pages
- **API routes** use server session:
  - `getServerSession(authOptions)` where `authOptions` is exported from `lib/auth.ts`

### Identity shape

- The canonical user id is the **Prisma `User.id`** (string, cuid).
- Firestore documents store `userId` as that same string, enabling cross-db joins at the application layer.

---

## 5) Platform connections (OAuth + encrypted tokens)

Connections are stored in Postgres (Prisma) and use **at-rest encryption** for tokens.

### Connection lifecycle

1. **Start OAuth**
   - UI triggers: `/api/connections/{platform}/connect`
   - Response: an `authUrl` to redirect the browser to the provider

2. **Provider redirects back**
   - Callback endpoint: `/api/connections/{platform}/callback`
   - Exchanges `code` for tokens (access, sometimes refresh)

3. **Encrypt and store**
   - Tokens are encrypted (AES) before persisting.
   - Postgres stores:
     - `accessToken` (encrypted)
     - `refreshToken` (encrypted, when available)
     - `expiresAt` (when relevant)
     - metadata: username/channel

### Why encrypt in Postgres?

Even in a demo environment, access tokens are security-sensitive. Encrypting at rest reduces blast radius if the DB is leaked or backed up incorrectly.

### Reddit refresh token handling

Reddit access tokens expire quickly. Airflow helper `get_decrypted_token(...)` includes refresh logic:

- If `expiresAt` is near expiry, it uses `refreshToken` to request a new access token.
- It updates the stored encrypted access token and `expiresAt` in Postgres.

---

## 6) Selecting monitored content (asset watchlist)

After connecting a platform, the user chooses which assets to monitor (videos, posts, submissions).

### API flow

- UI requests available content:
  - `GET /api/content?connectionId=...`
- UI toggles monitoring:
  - `POST /api/content/monitor`

### Data model

Postgres `monitored_content` stores:

- `userId`
- `platform` (enum)
- `platformContentId` (videoId / reddit submission id / instagram media id)
- `isMonitored` boolean
- `title` (cached for UI)

Airflow reads monitored content from Postgres (not from Firestore).

---

## 7) Comment ingestion (Fetch pipeline)

Comments are written to Firestore so that the UI can show an inbox-like view and the automation pipeline can attach AI metadata.

### Firestore document identity strategy

Airflow uses a stable doc id:

- `doc_id = "{platform}_{platformCommentId}"`

This provides idempotency: the same comment will map to the same document.

### Status field

Each comment doc includes a `status` string used by both UI and DAGs:

- `pending` → needs classification
- `classified` → ready for reply generation
- `ready_to_post` → reply generated and queued
- `replied` → posted successfully
- `failed` → processing/posting failed
- `rejected` → human rejected

### Important correctness rule

Fetch runs must **not** overwrite terminal states (e.g. `replied`) when refetching. Otherwise, a posted comment could revert to `pending`.

The fetch helper is designed to:

- set `status` on new docs
- **backfill `status` if missing** (so processing queries match)
- never overwrite existing valid statuses

---

## 8) AI processing (Process pipeline)

### Where AI runs

There are two ways AI reply generation can happen:

1. **Airflow** scheduled processing
2. **Manual UI-triggered processing** via API routes

They both produce the same Firestore fields:

- `classification`: `{ type, confidence, hasSensitiveKeywords, keywords, sentiment }`
- `generatedReply`: `{ text, generatedAt, model, ... }` (shape may vary)
- `status`: moves forward to `ready_to_post` when a reply is generated

### Airflow: process DAG responsibilities

The process DAG has two steps:

1. **Classify**
   - reads `comments` where `status == 'pending'`
   - calls Gemini
   - writes `classification`
   - updates status → `classified`

2. **Generate reply**
   - reads `comments` where `status == 'classified'`
   - loads user settings from Postgres (tone + business context)
   - calls Gemini
   - writes `generatedReply`
   - updates status → `ready_to_post`

If Gemini fails, the DAG marks the comment `failed` with an error reason so the UI can surface it.

### Gemini model selection

Gemini calls use a fallback model chain:

1. `GEMINI_MODEL` (optional override)
2. `gemini-2.5-flash`
3. `gemini-2.0-flash`

This protects against “model not found” drift.

---

## 9) Posting replies (Post pipeline)

Posting is an explicit stage:

- reads Firestore `comments` with `status == 'ready_to_post'` filtered by platform
- decrypts the user’s platform token from Postgres
- calls the provider API to post a reply
- updates Firestore to `replied` plus `posted` metadata

### Rate limiting

Posting checks per-user counters (stored in Postgres `rate_limits`) before attempting to post.

Why Postgres for rate limiting?

- counters are transactional
- easy to update atomically using SQL
- avoids inconsistent multi-worker increments

---

## 10) Reports and analytics

Reports are derived from Firestore comment documents:

- count by status
- sentiment distribution (from `classification.sentiment`)
- per-platform volume
- daily activity rollups

Gemini can be used again to generate insight summaries and recommendations based on aggregates (depending on your current implementation configuration).

---

## 11) Airflow: DAG-by-DAG technical details

Airflow runs in Docker. DAG schedules are controlled by **Airflow Variables** so the UI can change intervals without redeploying.

### 11.1 Fetch DAG (`fetch_comments_dag`)

- **Purpose**: ingest comments from monitored assets into Firestore.
- **Schedule**: uses Airflow Variable `revai_fetch_interval_minutes` (default 30).
- **Steps**:
  1. `get_monitored_content`
     - SQL query: joins `monitored_content` with `connections` by `(userId, platform)`
     - filters `isMonitored = true`
  2. `fetch_youtube_comments` / `fetch_reddit_comments` / `fetch_instagram_comments`
     - decrypt tokens
     - call platform APIs
     - write comment docs to Firestore (idempotent doc ids)
  3. `fetch_summary` for logging counts

### 11.2 Process DAG (`process_replies_dag`)

- **Purpose**: classify + generate replies.
- **Schedule**: Airflow Variable `revai_process_interval_minutes` (default 60).
- **Steps**:
  1. `classify_comments`
     - Firestore query: `comments.where('status', '==', 'pending').limit(100)`
     - Gemini classification prompt outputs JSON
     - update `classification`, status → `classified`
  2. `generate_replies`
     - Firestore query: `comments.where('status', '==', 'classified').limit(100)`
     - loads user settings from Postgres `users`
     - Gemini reply prompt outputs plaintext
     - update `generatedReply`, status → `ready_to_post`
  3. summary log

### 11.3 Post DAG (`post_replies_dag`)

- **Purpose**: post `ready_to_post` replies and finalize.
- **Schedule**: Airflow Variable `revai_post_interval_minutes` (default 15).
- **Steps**:
  1. platform-specific posting tasks run in parallel
  2. update Firestore `posted` metadata + status → `replied`
  3. increment rate limit counters in Postgres

---

## 12) Database connectivity details

### Next.js → Postgres (Prisma)

- Prisma client lives in `lib/db/postgres`
- Server components and API routes call Prisma directly.

### Next.js → Firestore (Firebase Admin SDK)

- Admin SDK is initialized once in `lib/db/firestore.ts`
- API routes query `firestore.collection('comments')...`

### Airflow → Postgres (psycopg2)

Airflow helpers connect using:

- `DATABASE_URL` if present, with a host rewrite when the URL points to `localhost` (inside Docker `localhost` isn’t the host machine).
- Otherwise: `POSTGRES_HOST`, `POSTGRES_PORT`, etc.

### Airflow → Firestore (Firebase Admin SDK, Python)

Airflow builds service-account credentials from env vars:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (with `\\n` replaced to real newlines)

---

## 13) Environment & operations

### Running locally

- Next.js: `npm run dev` → http://localhost:3000
- Airflow: `docker-compose up -d` → http://localhost:8080 (admin/admin)
- Postgres:
  - RevAI DB: container `revai-postgres` mapped to `5432`
  - Airflow metadata DB: `airflow-postgres` mapped to `5433`

### Airflow env wiring

`docker-compose.yml` uses `env_file: .env.local` for Airflow services, so the same env vars used by Next.js can be used by Airflow too.

---

## 14) Why we did it this way (decisions + alternatives)

### Decision: Next.js monorepo (UI + API routes)

- **Chosen because**: fastest integration, shared types, fewer deployable moving parts.
- **Alternative**: separate backend service (Express/Fastify) + separate frontend
  - **Not chosen**: overkill for the scope; adds auth/session complexity, CORS, deployment effort.

### Decision: Gemini API instead of local LLM

- **Chosen because**: predictable latency, no GPU setup, good demo reliability.
- **Alternative**: Ollama / llama.cpp local inference
  - **Not chosen**: hardware variability, larger setup time, unpredictable quality, demo risk.

### Decision: Airflow orchestration

- **Chosen because**: explicit requirement + clear pipeline story (DAGs, retries, scheduling).
- **Alternative**: cron jobs / serverless schedulers
  - **Not chosen**: weaker academic narrative, less visibility into retries/logs, less “workflow orchestration” credibility.

### Decision: Postgres + Firestore split

- **Chosen because**:
  - Postgres for relational/sensitive configuration (users, encrypted tokens)
  - Firestore for comment/reply event stream and analytics
- **Alternative**: Postgres only
  - **Not chosen**: schema rigidity and scale story weaker; would require many tables/indexes and migrations for comment payload variants.
- **Alternative**: Firestore only
  - **Not chosen**: token storage + relational integrity are harder; rate limit counters and uniqueness constraints become application-only.

### Decision: encrypted tokens at rest

- **Chosen because**: reduces risk if DB is accessed/backup leaks.
- **Alternative**: store raw tokens
  - **Not chosen**: unnecessary exposure.

---

## 15) Common failure modes (what to check)

- **Comments are visible but AI reply never appears**
  - check Airflow `process_replies_dag` logs
  - confirm `GEMINI_API_KEY` is present inside the Airflow container (env wiring)
  - confirm comments have a real `status` field (`pending` / `classified`) and are not missing it

- **Airflow fetch works but process finds 0 pending**
  - if Firestore docs lack `status`, UI may still show “pending” via fallback, but Airflow queries won’t match.
  - ensure fetch writes `status` (and backfills missing status).

- **OAuth works but platform API calls fail**
  - redirect URI mismatch (provider console)
  - YouTube API not enabled in the same Google Cloud project
  - missing scopes

---

## 16) Where to modify what (practical map)

- **Change UI look/feel**: `app/globals.css`, `components/DashboardLayout.tsx`, `app/dashboard/**`
- **Change comment workflow**: `app/api/comments/**`, `airflow/dags/process_replies_dag.py`, `airflow/tasks/helpers.py`
- **Change fetch logic**: `airflow/dags/fetch_comments_dag.py`, `airflow/tasks/helpers.py`
- **Change posting logic**: `airflow/dags/post_replies_dag.py`, `airflow/tasks/helpers.py`
- **Change platform integrations**: `lib/integrations/**` and Airflow helpers
- **Change schema**: `prisma/schema.prisma` + `npx prisma db push`

---

## 17) Appendix: key data shapes

### Firestore `comments` document (conceptual)

```json
{
  "userId": "cuid",
  "platform": "youtube|reddit|instagram",
  "platformCommentId": "provider id",
  "contentId": "videoId / submissionId / mediaId",
  "text": "comment text",
  "author": { "name": "..." },
  "status": "pending|classified|ready_to_post|replied|failed|rejected",
  "classification": { "type": "...", "confidence": 87, "sentiment": "positive" },
  "generatedReply": { "text": "...", "model": "gemini-2.5-flash", "generatedAt": "..." },
  "posted": { "isPosted": true, "platformReplyId": "...", "postedAt": "..." },
  "fetchedAt": "...",
  "updatedAt": "..."
}
```

---

**Last updated**: 2026-03-25

