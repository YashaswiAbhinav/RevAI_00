# Agent Log Maintenance Guide

## 🎯 Purpose

This document explains how AI agents (and human developers) should maintain living documentation as the project evolves.

**Core Principle**: Documentation should reflect reality, not aspirations.

---

## 📝 Files That Need Regular Updates

### 1. **07-DEVELOPMENT-LOG.md** (Update MOST Frequently)

**When to update**: After completing ANY task

**What to update**:

- Move completed tasks from TODO → Completed
- Add timestamp for completion
- Document any decisions made
- Note blockers or issues encountered
- Update current status percentage

**Example Entry**:
````markdown
## ✅ Completed

### Phase 1: Foundation (Day 1 Morning)

- [x] Create `package.json` with all dependencies ✅ 2025-03-16 2:30 PM
- [x] Create `prisma/schema.prisma` ✅ 2025-03-16 3:15 PM
- [x] Create `.env.example` ✅ 2025-03-16 3:20 PM
- [x] Setup Next.js app structure ✅ 2025-03-16 4:00 PM

---

## 📝 Notes & Decisions

### 2025-03-16 3:15 PM
- **Decision**: Added `enum Platform` to Prisma schema
- **Reason**: Type safety for platform field (YOUTUBE | INSTAGRAM | FACEBOOK)
- **Impact**: Auto-completion in IDE, prevents typos
- **Alternative considered**: String field (rejected - error-prone)

### 2025-03-16 4:00 PM
- **Issue Encountered**: Firebase Admin SDK required `\n` in private key
- **Solution**: Updated `.env.example` with clear instructions
- **Time Lost**: 15 minutes debugging
- **Documentation Updated**: 06-ENVIRONMENT-SETUP.md
````

---

### 2. **04-API-REFERENCE.md** (Update When Adding/Changing APIs)

**When to update**: After creating or modifying any API route

**What to update**:

- Add new endpoint documentation
- Update request/response examples
- Document new error codes
- Add usage examples

**Template for New Endpoint**:
````markdown
#### POST /api/your-new-endpoint

**Description**: Brief description of what this endpoint does

**Body**:
```json
{
  "field1": "value",
  "field2": 123
}
```

**Response**:
```json
{
  "success": true,
  "data": { ... }
}
```

**Errors**:
- `400`: Validation error
- `401`: Unauthorized

**Process**:
1. Step-by-step explanation
2. Of what happens
3. When this endpoint is called

**Example**:
```typescript
const response = await fetch('/api/your-new-endpoint', {
  method: 'POST',
  body: JSON.stringify({ field1: 'test' })
});
```

---

**Last Updated**: 2025-03-16 by AgentName
**Added By**: Your Name
````

---

### 3. **03-DATABASE-SCHEMA.md** (Update When Changing Database)

**When to update**: After running `npx prisma db push` or adding Firestore collections

**What to update**:

- Document new Prisma models
- Document new Firestore collections
- Update relationship diagrams
- Note migration commands used

**Example Entry**:
````markdown
---

## 🔄 Schema Changes Log

### 2025-03-16 3:45 PM - Added RateLimit Model

**Change**: Added `RateLimit` model to track API usage

**Prisma Migration**:
```bash
npx prisma db push
```

**Reason**: Prevent hitting YouTube API quota limits

**Fields Added**:
- `repliesToday`: Counter for daily limit
- `repliesThisHour`: Counter for hourly limit
- `dailyResetAt`: Timestamp for daily reset

**Impact**: All reply posting tasks now check this table first

---
````

---

### 4. **08-TROUBLESHOOTING.md** (Update When Solving New Issues)

**When to update**: After fixing a bug or solving a problem

**What to add**:

- The error message
- The solution that worked
- Why it happened
- How to prevent it

**Template**:
````markdown
### "Your Error Message Here"

**Error**:
````
Exact error message from logs