# System Architecture

## 🏗️ High-Level Overview
```
┌─────────────┐
│   Client    │ (Browser)
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│     Next.js Application             │
│  ┌─────────┐      ┌──────────┐     │
│  │Frontend │      │ Backend  │     │
│  │  (UI)   │◄────►│   API    │     │
│  └─────────┘      └────┬─────┘     │
└────────────────────────┼────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    ┌─────────┐   ┌──────────┐   ┌──────────┐
    │PostgreSQL│   │ Firebase │   │  Redis   │
    │ (Prisma) │   │(Firestore│   │  (Jobs)  │
    └─────────┘   └──────────┘   └──────────┘
                         │
                         ▼
              ┌──────────────────┐
              │ Apache Airflow   │
              │  (Automation)    │
              └────────┬─────────┘
                       │
         ┌───────────┬───────────┬───────────┐
         ▼           ▼           ▼           ▼
    [YouTube]    [Reddit]   [Instagram]  [Gemini AI]
```

## 🔄 Data Flow

### User Registration & Platform Connection

1. User signs up → NextAuth.js → PostgreSQL (Prisma)
2. User clicks "Connect YouTube" or "Connect Reddit" → OAuth flow → Get tokens
3. Tokens encrypted (AES-256) → Stored in PostgreSQL
4. System fetches user's videos/posts/submissions → Display with checkboxes
5. User selects assets → Marked as "monitored" in PostgreSQL

### Automated Comment Processing (Airflow)

1. **Every 30 mins**: Airflow DAG fetches comments from monitored videos
2. Comments saved to **Firebase Firestore** with status: "pending"
3. **Every 1 hour**: Airflow DAG processes pending comments:
   - Classify with Gemini AI (question? complaint? spam?)
   - Generate reply with Gemini AI
   - Update Firestore: status → "ready_to_post"
4. **Every 15 mins**: Airflow DAG posts replies:
   - Check rate limits (max 30/hour per user)
   - Decrypt user's access token from PostgreSQL
   - Post reply to platform
   - Update Firestore: status → "posted"

### Report Generation

1. User clicks "Generate Report" → Frontend calls API
2. Backend queries **Firestore** (date range filter)
3. Aggregate data (counts, sentiment, trends)
4. Call Gemini API for insights
5. Save report to **Firestore**
6. Return to frontend for display

## 🗄️ Database Strategy

**PostgreSQL (via Prisma)** - Structured, relational data

- Users, passwords (hashed)
- Platform connections (encrypted tokens)
- Monitored content (videos/posts selected by user)
- User settings (reply tone, filters, etc.)
- Rate limiting counters

**Firebase Firestore** - Unstructured, high-volume data

- Comments (raw text, metadata)
- AI classifications
- Generated replies
- Posted replies (with platform IDs)
- Generated reports

**Why two databases?**

- **PostgreSQL**: ACID compliance for critical data (user accounts, tokens)
- **Firestore**: Real-time sync, flexible schema for dynamic data (comments vary by platform)
- **Performance**: Firestore handles millions of comments better with auto-scaling
- **Free tier**: Firebase has generous free tier (50K reads/day, 20K writes/day)

## 🔐 Security Architecture

### Token Encryption
```
OAuth Flow → Raw Token → AES-256 Encrypt → PostgreSQL
API Call ← Decrypt Token ← Fetch from PostgreSQL
```

### Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only authenticated users can read/write their own data
    match /comments/{commentId} {
      allow read, write: if request.auth != null 
        && request.auth.uid == resource.data.userId;
    }
    
    match /reports/{reportId} {
      allow read, write: if request.auth != null 
        && request.auth.uid == resource.data.userId;
    }
  }
}
```

### Environment Variables

- All secrets in `.env.local` (gitignored)
- Encryption key: 32-character random string
- Firebase service account key: JSON file (never commit)
- Never log tokens (even encrypted)

### Rate Limiting

- Track in PostgreSQL: `rate_limits` table
- Check before every API call
- Prevent spam detection by platforms

## 🚀 Deployment Architecture

**Development (Local)**

- Next.js: `localhost:3000`
- Airflow: `localhost:8080` (Docker)
- PostgreSQL: `localhost:5432` (Docker or local)
- Firebase: Cloud (always remote)

**Production (Future)**

- Next.js: Vercel
- Airflow: Railway/Render
- PostgreSQL: Supabase/Neon
- Firebase: Google Cloud (auto-hosted)

## 🧩 Module Responsibilities

| Module | Responsibility | Database |
|--------|----------------|----------|
| Auth | User signup/login | PostgreSQL |
| Connections | OAuth, token management | PostgreSQL |
| Content | Video/post selection | PostgreSQL |
| Comments | Fetch, process, store | Firestore |
| AI | Classification, replies | Firestore |
| Reports | Analytics, insights | Firestore |
| Rate Limits | API quota tracking | PostgreSQL |

## 🎯 Key Design Decisions

### Decision 1: Prisma ORM

**Why?** Auto-generates types, handles migrations, prevents SQL injection

**Alternative considered**: Raw SQL (rejected - too error-prone)

### Decision 2: Firebase Firestore (not MongoDB)

**Why?** 
- No separate hosting needed (Google manages it)
- Real-time sync capabilities (future feature)
- Generous free tier
- Firebase Admin SDK works well with Next.js

**Alternative considered**: MongoDB Atlas (rejected - requires separate account/setup)

### Decision 3: Separate Airflow DAGs

**Why?** Independent scheduling, better failure isolation

**Alternative considered**: Single mega-DAG (rejected - too complex)

### Decision 4: Gemini API (not local LLM)

**Why?** Time constraints (2 days), consistent quality

**Alternative considered**: Ollama + Llama (rejected - setup complexity)

### Decision 5: Monorepo (not microservices)

**Why?** Faster development, shared types, easier deployment

**Alternative considered**: Separate repos (rejected - overkill for demo)

---

**Last Updated**: 2025-03-16
**Updated By**: Initial architecture design with Firebase
