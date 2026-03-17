# Development Log

## 📊 Current Status: PHASE 6 IN PROGRESS

**Last Updated**: 2026-03-18
**Phase**: Phase 6: Airflow Automation (In Progress)
**Completion**: 90%

---

## ✅ Completed

### Phase 1: Foundation (✅ COMPLETE)
- [x] Create `package.json` with all dependencies (Next.js 14, Prisma, Firebase, Google APIs, etc.)
- [x] Create `prisma/schema.prisma` with User, Connection, MonitoredContent models
- [x] Create `.env.example` with all required environment variables
- [x] Setup Next.js app structure with App Router
- [x] Install Tailwind CSS + shadcn/ui components
- [x] Test database connections (PostgreSQL + Firestore)

### Phase 2: Authentication (✅ COMPLETE)
- [x] Setup NextAuth.js with credentials + Google OAuth
- [x] Create signup API route (`/api/auth/register`)
- [x] Create login page (`/auth/login`)
- [x] Create dashboard layout with navigation
- [x] Add session protection middleware
- [x] Create registration page (`/auth/register`) - **FIXED: Was missing, now created**

### Phase 3: Platform Connections (✅ COMPLETE)
- [x] YouTube OAuth flow
  - [x] `/api/connections/youtube/connect`
  - [x] `/api/connections/youtube/callback`
  - [x] Token encryption utility (AES-256)
- [x] Instagram OAuth flow
  - [x] `/api/connections/instagram/connect`
  - [x] `/api/connections/instagram/callback`
- [x] Connection status dashboard
- [x] Platform permission checking

### Phase 4: Content Selection (✅ COMPLETE)
- [x] Fetch user's YouTube videos via YouTube API
- [x] Fetch user's Instagram posts via Meta Graph API
- [x] Content selection UI with monitoring toggles
- [x] Save monitored content to PostgreSQL
- [x] `/api/content` endpoint for fetching available content
- [x] `/api/content/monitor` endpoint for toggling monitoring

### Phase 5: Core Features (✅ COMPLETE)
- [x] Gemini AI integration for comment classification
- [x] AI reply generation with business context
- [x] Comments management page with filtering
- [x] Manual approval workflow for AI replies
- [x] Reports & analytics dashboard
- [x] User settings page with AI customization
- [x] Real-time comment fetching from monitored content
- [x] Sentiment analysis and insights generation

### Infrastructure (✅ COMPLETE)
- [x] Docker Compose for Apache Airflow
- [x] PostgreSQL database setup
- [x] Firebase Firestore integration
- [x] Environment configuration
- [x] Security utilities (encryption, validation)
- [x] Error handling and logging

---

## 🚧 Phase 6: Airflow Automation (IN PROGRESS)

**Current Task**: Airflow DAGs created and loaded; now wiring real API calls (YouTube/Instagram/Gemini)

**Blocked By**: None

**Next Action**: Integrate platform API calls into DAG tasks and unpause DAGs in the Airflow UI

### Phase 6 TODO List:

#### 6.1: DAG Infrastructure Setup (✅ Done)
- [x] Create `dags/` directory in Airflow
- [x] Setup DAG configuration files
- [x] Configure Airflow connections to databases
- [x] Test DAG execution environment (Airflow UI confirms DAGs loaded)

#### 6.2: Comment Fetching DAG (`fetch_comments_dag.py`)
- [x] Scheduled task to fetch comments from monitored content (every 30 min)
- [ ] Platform-specific fetchers (YouTube, Instagram) — **needs real API implementation**
- [x] Store comments in Firestore with metadata
- [ ] Handle rate limits and API quotas — **to be wired into real API calls**
- [x] Error handling and retry logic (basic)
- [x] Logging and monitoring (logs output available in Airflow)

#### 6.3: Reply Processing DAG (`process_replies_dag.py`)
- [x] Analyze new comments with Gemini AI — **currently mocked; needs real Gemini integration**
- [x] Generate appropriate replies based on user settings
- [ ] Apply sentiment filtering and confidence thresholds (future enhancement)
- [x] Queue approved replies for posting (status updated to `ready_to_post`)
- [x] Handle business context and tone preferences (via user settings)

#### 6.4: Reply Posting DAG (`post_replies_dag.py`)
- [x] Post approved replies to respective platforms — **currently mocked; needs real API calls**
- [x] Rate limiting (max replies per hour per user) logic implemented
- [ ] Platform-specific posting logic (needs real YouTube/Instagram send logic)
- [x] Update reply status in database (Firestore)
- [x] Error handling for failed posts (status updates)

#### 6.5: Maintenance DAGs
- [ ] Token refresh DAG (for expired OAuth tokens)
- [ ] Cleanup DAG (remove old processed comments)
- [ ] Health check DAG (monitor system status)
- [ ] Report generation DAG (automated analytics)

#### 6.6: Testing & Validation
- [ ] End-to-end pipeline testing (requires real API keys)
- [ ] Rate limit testing
- [ ] Error scenario testing
- [ ] Performance optimization

---

#### 6.5: Maintenance DAGs
- [ ] Token refresh DAG (for expired OAuth tokens)
- [ ] Cleanup DAG (remove old processed comments)
- [ ] Health check DAG (monitor system status)
- [ ] Report generation DAG (automated analytics)

#### 6.6: Testing & Validation
- [ ] End-to-end pipeline testing
- [ ] Rate limit testing
- [ ] Error scenario testing
- [ ] Performance optimization

### Phase 7: Reports (Day 2 Night)

- [ ] Report generation API
- [ ] Report viewing UI
- [ ] Export to PDF functionality

### Phase 8: Polish (Final Hours)

- [ ] Error handling
- [ ] Loading states
- [ ] Responsive design
- [ ] Demo preparation

---

## 🐛 Known Issues

- Google OAuth callback flow was failing earlier due to mismatched `NEXTAUTH_URL`, missing shared auth config, and env validation issues. Core fixes have been applied; final browser verification is still in progress.

---

## 💡 Ideas / Future Enhancements

- [ ] Email notifications for urgent comments
- [ ] Multi-language support
- [ ] Comment sentiment dashboard
- [ ] Competitor tracking
- [ ] A/B testing for reply styles
- [ ] WhatsApp integration

---

## 📝 Notes & Decisions

### 2026-03-18

- **Fix**: Monitored content not persisting visually on `dashboard/content` page.
- **Root Cause**: Two issues — (1) `isMonitored` flag on the content list was only set optimistically and not re-synced from DB after toggle; (2) Prisma enum `YOUTUBE` was being compared against lowercase platform strings, causing all items to appear unmonitored after reload.
- **Solution**: `fetchContent` now fetches `/api/content` and `/api/content/monitored` in parallel and uses the monitored list as source of truth for `isMonitored`. Toggle now calls `refreshMonitoredContent()` which syncs both lists from DB. `/api/content/monitored` now normalizes platform to lowercase.
- **Files Changed**:
  - `app/dashboard/content/page.tsx`
  - `app/api/content/monitored/route.ts`
- **Impact**: Monitored state is now always consistent with the database, survives page reloads, and reverts correctly on API failure.

### 2026-03-18

- **Feature**: Added DAG schedule interval controls to the Settings page.
- **Decision**: Used Airflow Variables (`Variable.get()`) as the bridge between the app and Airflow. DAGs read their interval from a named variable at parse time; the settings API writes to those variables via the Airflow REST API after saving to PostgreSQL.
- **Why not mock**: Airflow Variables are the standard Airflow-native way to pass runtime config to DAGs without redeploying. The REST API call is best-effort (non-blocking) so settings save succeeds even if Airflow is down.
- **Schema Changes**: Added `fetchIntervalMinutes`, `processIntervalMinutes`, `postIntervalMinutes` to `User` model in `prisma/schema.prisma`. Ran `npx prisma db push`.
- **Files Changed**:
  - `prisma/schema.prisma`
  - `app/api/settings/route.ts`
  - `app/dashboard/settings/page.tsx`
  - `airflow/dags/fetch_comments_dag.py`
  - `airflow/dags/process_replies_dag.py`
  - `airflow/dags/post_replies_dag.py`
  - `.env.example`
- **New env vars**: `AIRFLOW_API_URL` (default `http://localhost:8080`), `AIRFLOW_API_USER` (default `admin`), `AIRFLOW_API_PASS` (default `admin`).
- **Impact**: Users can now control how often each pipeline runs from the Settings UI. Changes persist to PostgreSQL and are synced to Airflow Variables. DAGs pick up the new schedule on next parse (~30s). Airflow Variables `revai_fetch_interval_minutes`, `revai_process_interval_minutes`, `revai_post_interval_minutes` are the live source of truth for DAG schedules.

---

## 📝 Notes & Decisions

### 2025-03-16 10:00 AM

- **Decision**: Use Prisma ORM instead of raw SQL
- **Reason**: Auto-generates types, handles migrations, safer
- **Impact**: Slightly more abstraction but much faster development

### 2025-03-16 10:15 AM

- **Decision**: Use Gemini API instead of local LLM
- **Reason**: Time constraints (2 days), consistent quality
- **Impact**: Will justify to professors as "API integration" skill

### 2025-03-16 10:30 AM

- **Decision**: Monorepo structure (Next.js frontend + backend)
- **Reason**: Faster development, shared types, easier deployment
- **Impact**: Single codebase to manage

### 2025-03-16 10:45 AM

- **Decision**: Firebase Firestore instead of MongoDB
- **Reason**: No separate hosting needed, generous free tier, easier setup
- **Impact**: Using Firebase Admin SDK, need service account credentials

### 2026-03-17 02:55 PM

- **Issue Encountered**: Google sign-in redirected to `localhost:3001` and failed in Safari.
- **Solution**: Updated `.env` and `.env.local` so `NEXTAUTH_URL` matches the app origin at `http://localhost:3000`.
- **Impact**: OAuth callback now returns to the active dev server instead of a dead port.

### 2026-03-17 03:10 PM

- **Decision**: Moved shared NextAuth config into `lib/auth.ts` and stopped importing auth options from the App Router route file.
- **Reason**: Route files should not export extra symbols, and multiple server components/API routes needed one shared auth source.
- **Impact**: Google auth flow now uses a centralized config; missing `@/lib/auth` imports are resolved and session typing is clearer.

### 2026-03-17 03:20 PM

- **Decision**: Kept NextAuth on JWT sessions for Google sign-in instead of using `PrismaAdapter`.
- **Reason**: Current Prisma schema does not include NextAuth adapter tables, and Google OAuth only needs session/user linkage for this demo flow.
- **Impact**: Google sign-in can create or reuse local users by email without a schema migration.

### 2026-03-17 03:32 PM

- **Issue Encountered**: App crashed on `/api/connections` with `ENCRYPTION_KEY must be exactly 32 characters long`.
- **Solution**: Updated `lib/security/encryption.ts` to accept either a 32-character string or a 64-character hex key.
- **Impact**: Existing 64-character hex key in local env files is now treated as valid and no longer blocks protected pages/routes.

### 2026-03-17 03:42 PM

- **Issue Encountered**: YouTube OAuth was blocked by Google with `redirect_uri` policy error.
- **Root Cause**: Google Cloud OAuth client was missing the exact redirect URI generated by the app: `http://localhost:3000/api/connections/youtube/callback`.
- **Impact**: No code change required for this step; Google Cloud Console must be updated to match the app's callback URL exactly.

### 2026-03-17 03:52 PM

- **Improvement**: Replaced generic `connection_failed` YouTube callback handling with more specific error redirects and UI messages on the Connections page.
- **Reason**: OAuth callback failures were reaching the app but not exposing the underlying reason to the user.
- **Impact**: Follow-up debugging can now distinguish between token exchange failures, missing YouTube channels, permission issues, and generic callback errors.

### 2026-03-17 04:05 PM

- **Audit**: Compared Phase 6 docs against the actual codebase to identify remaining mocked integrations.
- **Findings**: Real mocks still exist in `airflow/dags/fetch_comments_dag.py`, `airflow/dags/process_replies_dag.py`, `airflow/dags/post_replies_dag.py`, `app/api/reports/route.ts`, and `app/api/comments/generate-reply/route.ts`.
- **Next Priority**: Implement the end-to-end YouTube path first: real comment fetch, real Gemini classification/reply generation, and real reply posting. Keep Instagram and reports as secondary work unless demo scope requires them immediately.

### 2026-03-17 04:18 PM

- **Fix**: Reworked content selection APIs to match the current Prisma schema instead of the older `connectionId/contentId/status` model.
- **Files Changed**:
  - `app/api/content/route.ts`
  - `app/api/content/monitor/route.ts`
  - `app/dashboard/content/page.tsx`
- **Impact**: Connected platform accounts can now fetch available content and persist monitoring state using `userId + platform + platformContentId`, which unblocks the real "Connect -> Select content" flow for YouTube.

### 2026-03-17 04:32 PM

- **Fix**: Replaced the hardcoded Gemini model target `gemini-pro` with a supported fallback chain in both the Next.js app and Airflow helpers.
- **Files Changed**:
  - `lib/integrations/gemini.ts`
  - `airflow/tasks/helpers.py`
- **Reason**: The installed Gemini SDK/API version no longer supports `models/gemini-pro` for `generateContent`, which caused `404 Not Found` during manual reply generation and automated processing.
- **Impact**: Gemini calls now try `GEMINI_MODEL` first when provided, then fall back to `gemini-2.5-flash` and `gemini-2.0-flash`, which restores compatibility with current Google AI Studio keys.

### 2026-03-17 04:24 PM

- **Issue Reconfirmed**: YouTube OAuth is still intermittently blocked by Google with `redirect_uri_mismatch`.
- **Reason**: This happens before the app callback executes, so the remaining fix is in Google Cloud Console configuration, not application code.
- **Next Check**: Verify the exact OAuth client ID in use (`744027749722-559ttf0i1hkfa1cbhnq97idun98lvcff.apps.googleusercontent.com`) has `http://localhost:3000/api/connections/youtube/callback` registered under Authorized redirect URIs in the same Google Cloud project.

### 2026-03-17 04:50 PM

- **Issue Identified**: YouTube OAuth callback is now reaching the app, but the connection fails because `YouTube Data API v3` is disabled for the Google Cloud project behind the OAuth client.
- **Solution**: Added a specific callback error mapping and UI message for `accessNotConfigured` / API-disabled responses.
- **Impact**: The app can now distinguish Google Console setup issues from application callback failures, making the next user action explicit: enable YouTube Data API v3 and retry after propagation.

### 2026-03-17 04:42 PM

- **Refactor**: Replaced Airflow fetch/process/post mock branches with real helper calls for YouTube, Instagram, and Gemini.
- **Files Changed**:
  - `airflow/tasks/helpers.py`
  - `airflow/dags/fetch_comments_dag.py`
  - `airflow/dags/process_replies_dag.py`
  - `airflow/dags/post_replies_dag.py`
  - `airflow/requirements.txt`
  - `docker-compose.yml`
- **Impact**: Airflow now uses the current Prisma schema, decrypts tokens with the same CryptoJS-compatible format as the app, loads env vars from `.env.local`, and is prepared to make real platform/AI API calls instead of placeholder results.
- **Remaining Runtime Requirement**: Restart Airflow containers so the new Python dependencies and DAG code are loaded, then validate with monitored YouTube content and a real `GEMINI_API_KEY`.

### 2026-03-17 04:54 PM

- **Runtime Bug Fixed**: Airflow detected monitored YouTube content but fetched `0` comments because Python token decryption was treating `ENCRYPTION_KEY` as raw hex bytes instead of the passphrase string used by CryptoJS in the app.
- **Solution**: Updated Airflow token decryption to mirror the app's passphrase behavior exactly.
- **Impact**: Airflow should now be able to decrypt stored OAuth tokens and make real YouTube API calls during `fetch_comments_dag`.

### 2026-03-17 05:05 PM

- **Frontend/Data Fix**: Replaced the old platform-live comments dashboard path with Firestore-backed comment reads, and wired manual comment actions (`generate`, `approve`, `reject`) to the same Firestore documents.
- **Files Changed**:
  - `app/api/comments/route.ts`
  - `app/api/comments/generate-reply/route.ts`
  - `app/api/comments/approve/route.ts`
  - `app/api/comments/reject/route.ts`
  - `app/dashboard/comments/page.tsx`
  - `app/api/content/monitored/route.ts`
  - `app/dashboard/content/page.tsx`
- **Impact**: Comments fetched by Airflow should now be visible in the UI, manual AI actions use Firestore instead of mocks, and monitored content is always visible below the platform selector on the content page.

---

## 🔄 How to Update This Log

When you (or another agent) make progress:

1. Move items from TODO to "In Progress"
2. When done, move to "Completed" with timestamp
3. Add new issues to "Known Issues"
4. Document decisions in "Notes & Decisions"

**Template for new entry**:
```markdown
### YYYY-MM-DD HH:MM AM/PM
- **Decision/Progress**: What was done
- **Reason**: Why this approach
- **Impact**: What it affects
```

---

**Log Started**: 2025-03-16
**Maintained By**: AI Agents + Developer
