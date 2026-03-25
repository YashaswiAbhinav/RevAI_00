# API Reference

## 🔐 Authentication

All protected endpoints require authentication via NextAuth.js session.

**Headers**:
```
Cookie: next-auth.session-token=xxxxx
```

---

## 📚 API Endpoints

### Authentication

#### POST /api/auth/register

**Description**: Register a new user

**Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Response**:
```json
{
  "success": true,
  "userId": "clxxxxxx"
}
```

**Errors**:
- `400`: Email already exists
- `400`: Invalid email format
- `400`: Password too weak

---

#### POST /api/auth/login

**Description**: Login (handled by NextAuth.js)

**Endpoint**: `/api/auth/signin`

Use NextAuth's built-in providers.

---

### Platform Connections

#### GET /api/connections/youtube/connect

**Description**: Initiate YouTube OAuth flow

**Response**: Redirects to Google OAuth consent screen

**Query Params**: None

---

#### GET /api/connections/youtube/callback

**Description**: OAuth callback (handles token exchange)

**Query Params**:
```
code: "4/0AXXXXxxxxxx"
state: "random-state-string"
```

**Response**: Redirects to `/dashboard/connections?success=true`

**Database Actions**:
1. Exchange code for access token
2. Encrypt token with AES-256
3. Store in PostgreSQL `connections` table
4. Fetch YouTube channel info
5. Update connection record

---

#### GET /api/connections/reddit/connect

**Description**: Initiate Reddit OAuth flow

**Response**: Redirects to Reddit OAuth consent screen

**Query Params**: None

---

#### GET /api/connections/reddit/callback

**Description**: Reddit OAuth callback (handles token exchange)

**Query Params**:
```
code: "generated-by-reddit"
state: "user-id"
```

**Response**: Redirects to `/dashboard/connections?success=reddit_connected`

**Database Actions**:
1. Exchange code for access + refresh token
2. Encrypt tokens with AES-256
3. Store in PostgreSQL `connections` table
4. Fetch Reddit account identity
5. Save username as the connection channel/account identifier

---

#### DELETE /api/connections/[platform]/disconnect

**Description**: Disconnect a platform

**Params**:
- `platform`: "youtube" | "reddit" | "instagram" | "facebook"

**Response**:
```json
{
  "success": true,
  "message": "YouTube disconnected"
}
```

**Database Actions**:
1. Delete from PostgreSQL `connections` table
2. Cascade deletes `monitored_content`

---

#### GET /api/connections/status

**Description**: Get all connected platforms for current user

**Response**:
```json
{
  "connections": [
    {
      "platform": "youtube",
      "connectedAt": "2025-03-16T10:00:00Z",
      "platformUsername": "JohnDoeChannel",
      "isActive": true
    }
  ]
}
```

---

### Content Management

#### GET /api/content/fetch

**Description**: Fetch user's videos/posts/submissions from connected platform

**Query Params**:
```
platform: "youtube" | "reddit" | "instagram" | "facebook"
maxResults: 20 (optional, default: 50)
```

**Response**:
```json
{
  "content": [
    {
      "platformContentId": "dQw4w9WgXcQ",
      "title": "How to Bake Cookies",
      "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
      "thumbnailUrl": "https://i.ytimg.com/vi/xxx/default.jpg",
      "publishedAt": "2025-03-10T10:00:00Z",
      "isMonitored": false
    }
  ]
}
```

**Process**:
1. Get user's connection from PostgreSQL
2. Decrypt access token
3. Call platform API (YouTube, Reddit, or Instagram)
4. Return content list

---

#### POST /api/content/monitor

**Description**: Start/stop monitoring specific content

**Body**:
```json
{
  "platform": "youtube",
  "contentIds": ["dQw4w9WgXcQ", "abc123"],
  "action": "start" | "stop"
}
```

**Response**:
```json
{
  "success": true,
  "monitored": 2
}
```

**Database Actions**:
1. Insert into PostgreSQL `monitored_content` table
2. Set `isMonitored = true`

---

#### GET /api/content/monitored

**Description**: Get list of currently monitored content

**Query Params**:
```
platform: "youtube" (optional, returns all if not specified)
```

**Response**:
```json
{
  "content": [
    {
      "id": "clxxxxxx",
      "platform": "youtube",
      "platformContentId": "dQw4w9WgXcQ",
      "title": "How to Bake Cookies",
      "isMonitored": true,
      "addedAt": "2025-03-16T10:00:00Z"
    }
  ]
}
```

---

### Comments

#### GET /api/comments/list

**Description**: Get comments from Firestore

**Query Params**:
```
status: "pending" | "replied" | "filtered" (optional)
platform: "youtube" (optional)
limit: 50 (optional, default: 100)
```

**Response**:
```json
{
  "comments": [
    {
      "id": "comment_doc_id",
      "text": "Love this video!",
      "author": {
        "name": "Jane Doe",
        "avatarUrl": "https://..."
      },
      "platform": "youtube",
      "status": "pending",
      "publishedAt": "2025-03-16T09:00:00Z",
      "classification": {
        "type": "praise",
        "confidence": 92
      },
      "generatedReply": {
        "text": "Thank you so much!"
      }
    }
  ],
  "total": 347
}
```

**Firestore Query**:
```javascript
db.collection('comments')
  .where('userId', '==', currentUserId)
  .where('status', '==', statusFilter)
  .orderBy('publishedAt', 'desc')
  .limit(limit)
```

---

#### POST /api/comments/approve

**Description**: Approve a generated reply and post it

**Body**:
```json
{
  "commentId": "firestore_doc_id",
  "editedReply": "Optional edited text" (optional)
}
```

**Response**:
```json
{
  "success": true,
  "platformReplyId": "UgxKREWmLvk..."
}
```

**Process**:
1. Get comment from Firestore
2. Get user's connection from PostgreSQL (decrypt token)
3. Post reply to platform API
4. Update Firestore: `status = "replied"`, `posted.isPosted = true`

---

#### POST /api/comments/manual-fetch

**Description**: Manually trigger comment fetching (outside Airflow schedule)

**Body**:
```json
{
  "platform": "youtube",
  "contentId": "clxxxxxx" (optional, fetches all if not specified)
}
```

**Response**:
```json
{
  "success": true,
  "commentsFetched": 23
}
```

**Process**:
1. Get monitored content from PostgreSQL
2. Fetch comments from platform API
3. Save to Firestore with status "pending"

---

### Reports

#### POST /api/reports/generate

**Description**: Generate analytics report for date range

**Body**:
```json
{
  "startDate": "2025-03-01",
  "endDate": "2025-03-31"
}
```

**Response**:
```json
{
  "reportId": "firestore_doc_id",
  "metrics": {
    "totalComments": 347,
    "repliedCount": 234,
    "sentiment": {
      "positive": 210,
      "neutral": 98,
      "negative": 39
    }
  },
  "insights": {
    "topConcerns": ["Shipping delays"],
    "topQuestions": ["Do you ship to Canada?"]
  }
}
```

**Process** (takes 30-60 seconds):
1. Query Firestore for comments in date range
2. Aggregate data (counts, sentiment distribution)
3. Call Gemini API with aggregated data for insights
4. Save report to Firestore `reports` collection
5. Return report

---

#### GET /api/reports/list

**Description**: Get user's generated reports

**Query Params**:
```
limit: 10 (optional, default: 20)
```

**Response**:
```json
{
  "reports": [
    {
      "id": "firestore_doc_id",
      "period": {
        "startDate": "2025-03-01",
        "endDate": "2025-03-31"
      },
      "metrics": { ... },
      "generatedAt": "2025-04-01T09:00:00Z"
    }
  ]
}
```

---

#### GET /api/reports/[id]

**Description**: Get specific report details

**Params**:
- `id`: Firestore document ID

**Response**:
```json
{
  "report": {
    "id": "xxx",
    "period": { ... },
    "metrics": { ... },
    "insights": { ... }
  }
}
```

---

### User Settings

#### GET /api/settings

**Description**: Get user's reply settings

**Response**:
```json
{
  "autoReplyEnabled": true,
  "requireApproval": false,
  "replyTone": "friendly",
  "businessContext": "I sell handmade jewelry",
  "minConfidenceScore": 70,
  "replyToTypes": ["question", "complaint", "purchase"]
}
```

---

#### PUT /api/settings

**Description**: Update reply settings

**Body**:
```json
{
  "autoReplyEnabled": true,
  "requireApproval": true,
  "replyTone": "professional",
  "businessContext": "Updated business description",
  "minConfidenceScore": 80,
  "replyToTypes": ["question", "purchase"]
}
```

**Response**:
```json
{
  "success": true
}
```

**Database Actions**:
1. Update PostgreSQL `reply_settings` table

---

## 🔒 Authentication Middleware

All API routes (except `/api/auth/*`) use this pattern:
```typescript
import { getServerSession } from 'next-auth';

export async function GET(req: Request) {
  const session = await getServerSession();
  
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const userId = session.user.id;
  
  // ... rest of logic
}
```

---

## 🚨 Error Responses

**Standard Error Format**:
```json
{
  "error": "Error message here",
  "code": "ERROR_CODE",
  "details": { ... } (optional)
}
```

**Common Error Codes**:

- `401`: Unauthorized (no session)
- `403`: Forbidden (not your resource)
- `404`: Not found
- `400`: Bad request (validation error)
- `500`: Internal server error
- `429`: Rate limit exceeded

---

**Last Updated**: 2025-03-16
**API Version**: 1.0
