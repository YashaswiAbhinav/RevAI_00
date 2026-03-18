# RevAI — Local Setup Guide

> For teammates who just cloned the repo. You need **Docker** and **Node.js 18+** installed. That's it.

---

## What runs where

| Service | How it runs | URL |
|---|---|---|
| Next.js app | Node (your machine) | http://localhost:3000 |
| RevAI PostgreSQL | Docker | localhost:5432 |
| Airflow PostgreSQL | Docker | localhost:5433 |
| Airflow UI | Docker | http://localhost:8080 |

---

## Step 1 — Copy the environment file

```bash
cp .env.example .env.local
```

Now open `.env.local` and fill in the values below. Everything marked **REQUIRED** will break the app if missing. Everything marked **optional** can be left as-is to start.

---

## Step 2 — Fill in `.env.local`

### Database (REQUIRED)
The Docker Compose file creates a Postgres container with these exact credentials. Just paste this line as-is:

```
DATABASE_URL="postgresql://revai:revai123@localhost:5432/revai"
```

### NextAuth Secret (REQUIRED)
Generate one and paste it:

```bash
openssl rand -base64 32
```

```
NEXTAUTH_SECRET="<paste output here>"
NEXTAUTH_URL="http://localhost:3000"
```

### Encryption Key (REQUIRED)
Generate one and paste it:

```bash
openssl rand -hex 32
```

```
ENCRYPTION_KEY="<paste output here — must be 64 hex chars>"
```

### Firebase (REQUIRED)
The app uses Firestore to store comments. You need a Firebase project.

1. Go to https://console.firebase.google.com/
2. Create a project (or use an existing one)
3. Go to **Project Settings → Service Accounts → Generate new private key**
4. Open the downloaded JSON file and copy these three values:

```
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nABC123...\n-----END PRIVATE KEY-----\n"
```

> ⚠️ The private key must stay on one line with literal `\n` characters (not real newlines). Copy it exactly as it appears in the JSON file.

5. In Firebase Console, go to **Firestore Database → Create database** (start in test mode is fine for local dev)

### Google OAuth + YouTube API (REQUIRED for YouTube features)
1. Go to https://console.cloud.google.com/
2. Create a project (or reuse the Firebase one)
3. Enable **YouTube Data API v3** under APIs & Services
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add authorized redirect URI: `http://localhost:3000/api/connections/youtube/callback`
7. Also add: `http://localhost:3000/api/auth/callback/google`

```
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
```

### Gemini AI (REQUIRED for AI reply generation)
1. Go to https://aistudio.google.com/app/apikey
2. Create an API key

```
GEMINI_API_KEY="your-gemini-api-key"
```

### Instagram/Meta (optional — skip if not demoing Instagram)
```
META_APP_ID="your-meta-app-id"
META_APP_SECRET="your-meta-app-secret"
```

### Airflow Fernet Key (REQUIRED for Airflow to start)
Generate one:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

If you don't have Python locally, use this pre-generated one (fine for local dev only):

```
AIRFLOW__CORE__FERNET_KEY="81HqDtbqAywKSOumSha3BhWNOdQ26slT6K0YaZeZyPs="
```

### Airflow API (leave as-is)
```
AIRFLOW_API_URL="http://localhost:8080"
AIRFLOW_API_USER="admin"
AIRFLOW_API_PASS="admin"
```

---

## Step 3 — Create a `.env` file for Prisma

Prisma CLI does not read `.env.local` — it only reads `.env`. Create a separate `.env` file with just the database URL:

```
DATABASE_URL="postgresql://revai:revai123@localhost:5432/revai"
```

> This file is already in `.gitignore` so it won't be committed. Next.js uses `.env.local` at runtime (which takes priority), so there's no conflict.

---

## Step 4 — Start the database (Docker)

You only need the Postgres container to start the app. Run just this service:

```bash
docker compose up revai-postgres -d
```

Verify it's running:

```bash
docker compose ps
```

You should see `revai-postgres` with status `healthy`.

---

## Step 5 — Install Node dependencies

```bash
npm install
```

---

## Step 6 — Push the database schema

This generates the Prisma client and creates all the tables in the Docker Postgres container:

```bash
npm run db:push
```

Expected output ends with: `Your database is now in sync with your Prisma schema.`

---

## Step 7 — Start the Next.js app

```bash
npm run dev
```

Open http://localhost:3000 — you should see the RevAI landing page.

Register an account at http://localhost:3000/auth/register.

---

## Step 8 — Start Airflow (optional — only needed for automation)

Airflow handles the automated comment fetching and posting pipeline. You don't need it to use the dashboard manually.

```bash
docker compose up -d
```

This starts all services: both Postgres containers, Airflow init, webserver, and scheduler.

> ⚠️ First startup takes 3–5 minutes. Airflow init must complete before the webserver is accessible.

Wait for it, then open http://localhost:8080
- Username: `admin`
- Password: `admin`

To check if it's ready:

```bash
docker compose logs airflow-webserver --tail=20
```

Look for `Listening at: http://0.0.0.0:8080`.

### Unpause the DAGs
In the Airflow UI, find these three DAGs and toggle them ON (they start paused):
- `fetch_comments_dag` — fetches comments from YouTube/Instagram
- `process_replies_dag` — classifies comments and generates AI replies
- `post_replies_dag` — posts approved replies back to platforms

---

## Verify everything works

| Check | How |
|---|---|
| App loads | http://localhost:3000 |
| Can register/login | http://localhost:3000/auth/register |
| Database connected | No red errors on dashboard load |
| Airflow running | http://localhost:8080 |

---

## Common errors

**`Error: Environment variable not found: DATABASE_URL`** (during `npm run db:push`)
→ Prisma CLI doesn't read `.env.local`. Create a separate `.env` file with just `DATABASE_URL="postgresql://revai:revai123@localhost:5432/revai"`

**`Error: DATABASE_URL must be set`**
→ Make sure your file is named `.env.local` (not `.env.example` or `.env`)

**`PrismaClientInitializationError: Can't reach database`**
→ The Docker Postgres container isn't running. Run `docker compose up revai-postgres -d`

**`NEXTAUTH_SECRET is not set`**
→ You skipped generating the secret in Step 2

**`FirebaseError: Could not load the default credentials`**
→ Your `FIREBASE_PRIVATE_KEY` in `.env.local` has real newlines instead of `\n`. It must be a single line.

**`Error: ENCRYPTION_KEY must be exactly 32 characters or 64 hex characters`**
→ Re-run `openssl rand -hex 32` and paste the fresh output

**Airflow webserver never becomes healthy**
→ Run `docker compose logs airflow-init` to see if init failed. Most common cause: `AIRFLOW__CORE__FERNET_KEY` is missing from `.env.local`

**Port 5432 already in use**
→ You have a local Postgres running. Either stop it (`brew services stop postgresql`) or change the port in `docker-compose.yml` from `5432:5432` to `5434:5432` and update `DATABASE_URL` to use port `5434`

---

## Stopping everything

```bash
# Stop Docker services (keeps data)
docker compose down

# Stop and delete all data (fresh start)
docker compose down -v
```

The Next.js dev server stops with `Ctrl+C`.
