# Database Schema Documentation

## 📊 Schema Overview

This project uses **two databases**:

1. **PostgreSQL** (via Prisma ORM) - Structured, relational data
2. **Firebase Firestore** - Unstructured, high-volume data

**File Locations**:
- PostgreSQL schema: `prisma/schema.prisma`
- Firestore structure: Documented below (no schema file)

## 🗄️ PostgreSQL Models (via Prisma)

### User Model

**Purpose**: Store user accounts

**Key Fields**:

- `id`: Unique identifier (cuid)
- `email`: Login credential (unique)
- `passwordHash`: bcrypt hashed password (NEVER plain text)

**Relations**: One user → many connections, many monitored content

### Connection Model

**Purpose**: Store OAuth tokens for connected platforms

**Security**: `accessToken` and `refreshToken` are AES-256 encrypted before storage

**Key Fields**:

- `accessToken`: Encrypted OAuth token (used for API calls)
- `platform`: Which service (YOUTUBE, INSTAGRAM, FACEBOOK)
- `@@unique([userId, platform])`: User can connect each platform only once

### MonitoredContent Model

**Purpose**: Track which videos/posts user wants to monitor

**Key Fields**:

- `platformContentId`: The actual video/post ID from the platform
- `isMonitored`: User can toggle monitoring on/off
- `@@unique([userId, platform, platformContentId])`: No duplicates

### ReplySettings Model

**Purpose**: User preferences for AI reply behavior

**Key Fields**:

- `businessContext`: User's business description for AI context
- `minConfidenceScore`: Only auto-reply if AI is >70% confident
- `replyToTypes`: Array of comment types to reply to

### RateLimit Model

**Purpose**: Prevent hitting platform API rate limits

**Key Fields**:

- `repliesToday`: Counter reset every 24 hours
- `repliesThisHour`: Counter reset every hour
- Used by Airflow before posting replies

## 🔥 Firebase Firestore Collections

Firestore is schemaless, but here's the structure we use:

### Comments Collection

**Collection Path**: `/comments/{commentId}`

**Document Structure**:
```javascript
{
  // IDs (references to PostgreSQL)
  userId: "clxxxxxx",
  connectionId: "clxxxxxx",
  contentId: "clxxxxxx",
  
  // Platform data
  platform: "youtube",
  platformCommentId: "UgxKREWmLvk...",
  
  // Comment content
  text: "Love this video! Where can I buy?",
  author: {
    name: "John Doe",
    profileUrl: "https://youtube.com/channel/...",
    avatarUrl: "https://yt3.ggpht.com/..."
  },
  publishedAt: Timestamp,
  
  // Processing status
  status: "pending",
  // Possible statuses: "pending", "filtered", "approved", "replied", "failed"
  
  // AI classification (added after processing)
  classification: {
    type: "question",
    confidence: 87,
    hasSensitiveKeywords: false,
    keywords: []
  },
  
  // Generated reply (added after AI processing)
  generatedReply: {
    text: "Thanks for your interest! You can...",
    generatedAt: Timestamp,
    model: "gemini-pro"
  },
  
  // Posting status (added after reply posted)
  posted: {
    isPosted: true,
    postedAt: Timestamp,
    platformReplyId: "UgxKREWmLvk..."
  },
  
  // Metadata
  fetchedAt: Timestamp,
  processedAt: Timestamp
}
```

**Firestore Indexes** (create in Firebase Console):
```
Collection: comments
Fields indexed:
- userId (Ascending) + status (Ascending)
- platformCommentId (Ascending) - Single field
- publishedAt (Descending) - Single field
```

### Reports Collection

**Collection Path**: `/reports/{reportId}`

**Document Structure**:
```javascript
{
  userId: "clxxxxxx",
  
  period: {
    startDate: Timestamp,
    endDate: Timestamp
  },
  
  metrics: {
    totalComments: 347,
    repliedCount: 234,
    filteredCount: 89,
    pendingCount: 24,
    
    sentiment: {
      positive: 210,
      neutral: 98,
      negative: 39
    },
    
    byPlatform: {
      youtube: { comments: 200, replied: 150 },
      instagram: { comments: 147, replied: 84 }
    }
  },
  
  insights: {
    topConcerns: ["Shipping delays", "Product quality"],
    topQuestions: ["Do you ship to Canada?", "Is this vegan?"],
    competitorMentions: ["BrandX", "CompanyY"],
    recommendations: ["Create FAQ video", "Add size chart"]
  },
  
  generatedAt: Timestamp,
  generatedBy: "system"
  // or "user-request" if user clicked "Generate Report"
}
```

## 🔄 Schema Migrations

### PostgreSQL (Prisma)

**Initial Setup**:
```bash
npx prisma db push
```

**After Schema Changes**:
```bash
# 1. Update prisma/schema.prisma
# 2. Run:
npx prisma db push

# OR for production (creates migration history):
npx prisma migrate dev --name add_new_field
```

**Reset Database (DANGER)**:
```bash
npx prisma migrate reset
# This will DELETE ALL DATA
```

### Firebase Firestore

**No migrations needed!** Firestore is schemaless.

**Adding new fields**: Just start writing documents with new fields

**Removing fields**: Old documents keep old fields (no harm)

**Changing structure**: Write migration script if needed

## 📖 Understanding Relationships

**PostgreSQL** (relational):
```
User (1) ──> (Many) Connection
  │
  └──> (Many) MonitoredContent
  │
  └──> (1) ReplySettings
  │
  └──> (Many) RateLimit

Connection (1) ──> (Many) MonitoredContent
```

**Firestore** (document-based):
```
Comments Collection
├── Document 1 (userId: "clxxx")
├── Document 2 (userId: "clxxx")
└── Document 3 (userId: "clyyy")

Reports Collection
├── Document 1 (userId: "clxxx")
└── Document 2 (userId: "clyyy")
```

**Cross-database references**:

- Firestore documents store PostgreSQL `userId` as string
- Backend queries PostgreSQL for user data, then Firestore for comments
- No foreign key constraints (managed by application logic)

## 🔐 Security

**PostgreSQL**:

- Cascade deletes: Delete User → All connections/content deleted
- Token encryption: All OAuth tokens encrypted at rest

**Firestore**:

- Security Rules: Only authenticated users can access their own data
- No sensitive data stored (tokens stay in PostgreSQL)

## 🧹 Data Cleanup Strategy

**PostgreSQL**: Keep forever (user accounts, connections)

**Firestore**: 

- Comments: Archive after 90 days (move to `comments_archive` collection)
- Reports: Keep last 12 months, delete older

**Cleanup Script** (run monthly):
```javascript
// scripts/cleanup-firestore.js
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - 90);

const oldComments = await db
  .collection('comments')
  .where('fetchedAt', '<', cutoffDate)
  .get();

// Move to archive or delete
```

---

**Last Updated**: 2025-03-16
**Schema Version**: 1.0 (PostgreSQL + Firestore)