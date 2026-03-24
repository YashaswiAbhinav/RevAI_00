# Agent Handoff Guide

## 🤖 If You're an AI Agent Reading This

Welcome! You're taking over the RevAI project. This doc will get you up to speed quickly.

---

## 📚 FIRST: Read These Docs (In Order)

1. **00-README.md** - Project overview (5 min read)
2. **01-ARCHITECTURE.md** - System design (10 min read)
3. **07-DEVELOPMENT-LOG.md** - Current status (2 min read)

After reading those three, you'll understand:

- What this project does
- How it's architected
- What's already built
- What needs to be done next

---

## 🎯 Quick Context

**Project**: Social media auto-reply system

**Timeline**: 2 days to build + demo

**Tech Stack**: Next.js + Prisma + Firebase Firestore + Airflow + Gemini AI

**Current User**: College student, needs working demo ASAP

**Key Constraints**:

- Must use Apache Airflow (already told professors)
- Must use Gemini API (not local LLM - time constraint)
- Must support YouTube + Instagram
- Must be production-quality architecture (even if demo data)

---

## 🔍 Understanding the Codebase

### File Organization
```
app/
├── api/              ← Backend API routes
│   ├── auth/         ← NextAuth.js
│   ├── connections/  ← Platform OAuth
│   ├── content/      ← Video/post selection
│   └── reports/      ← Report generation
├── dashboard/        ← Protected UI pages
└── (auth)/          ← Login/signup pages

lib/
├── db/              ← Database clients
├── integrations/    ← Platform APIs
└── security/        ← Encryption utilities

prisma/
└── schema.prisma    ← Database schema

airflow/
├── dags/            ← Workflow definitions
└── tasks/           ← Task implementations
```

### Key Files to Understand

**Must Read**:

1. `prisma/schema.prisma` - Database structure
2. `lib/integrations/youtube.ts` - YouTube API
3. `lib/integrations/gemini.ts` - AI replies
4. `airflow/dags/fetch_comments_dag.py` - Main automation

**Nice to Read**:

5. `app/api/connections/youtube/callback/route.ts` - OAuth example
6. `components/ContentList.tsx` - UI patterns

---

## 🚦 Current State of Project

Check `07-DEVELOPMENT-LOG.md` for real-time status.

**As of last update**:

- [x] Full Next.js application exists and core flows are implemented
- [x] Authentication, platform connections, content selection, comments, reports, and settings screens are present
- [x] Current priority has moved to polish, UI/UX quality, and presentation readiness unless the user reports a fresh regression

**What you'll likely need to do**:

1. Read the latest entries in `07-DEVELOPMENT-LOG.md` before making assumptions
2. Preserve and extend the shared UI system instead of adding generic one-off styles
3. Update logs whenever product direction changes, especially if the user corrects earlier assumptions
4. Treat backend debugging as secondary unless the user explicitly reports a new issue
5. Test end-to-end after visual changes so polish work does not break working flows

---

## 🛠️ How to Make Changes

### Adding a New API Endpoint

1. Create file: `app/api/[name]/route.ts`
2. Implement GET/POST/etc handlers
3. Use Prisma for PostgreSQL queries
4. Use Firestore for comments
5. Document in `04-API-REFERENCE.md`
6. Update `07-DEVELOPMENT-LOG.md`

**Example**:
```typescript
// app/api/test/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/db/postgres';

export async function GET() {
  const users = await prisma.user.findMany();
  return NextResponse.json({ users });
}
```

### Adding a New Database Field

1. Edit `prisma/schema.prisma`
2. Run: `npx prisma db push`
3. Restart dev server (types regenerated)
4. Update `03-DATABASE-SCHEMA.md`

### Adding a New Airflow Task

1. Create function in `airflow/tasks/[name]_tasks.py`
2. Import in DAG file
3. Add to task chain
4. Document in `05-AIRFLOW-GUIDE.md`

---

## 🧪 Testing Your Changes
```bash
# Test database connection
npx prisma studio

# Test API endpoint
curl http://localhost:3000/api/test

# Test Airflow
docker-compose up -d
# Visit http://localhost:8080
```

---

## 🐛 Common Issues & Solutions

### "Prisma Client not found"
```bash
npx prisma generate
```

### "Can't connect to Firestore"

Check `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` in `.env.local`

### "OAuth callback fails"

1. Check redirect URI in Google/Meta console
2. Verify it matches `NEXTAUTH_URL` in `.env.local`

### "Airflow DAG not appearing"

1. Check for syntax errors
2. Restart scheduler: `docker-compose restart airflow-scheduler`

---

## 📝 Update Procedures

### After Completing a Task

1. **Update `07-DEVELOPMENT-LOG.md`**:
   - Move task from TODO → Completed
   - Add timestamp
   - Note any decisions made

2. **Update relevant docs**:
   - Added API? → Update `04-API-REFERENCE.md`
   - Changed schema? → Update `03-DATABASE-SCHEMA.md`
   - Fixed bug? → Update `08-TROUBLESHOOTING.md`

3. **Update THIS file** if you learned something important

4. **Follow `10-AGENT-LOG-MAINTENANCE.md`** for detailed update procedures

### Template for Log Entry
```markdown
### 2025-03-16 2:30 PM
- **Completed**: YouTube OAuth integration
- **Files Changed**: 
  - app/api/connections/youtube/callback/route.ts
  - lib/integrations/youtube.ts
- **Decisions**: 
  - Used long-lived tokens (simpler for demo)
- **Next**: Instagram OAuth
```

---

## 🎯 Priority Guidelines

**If user says "2 days left"**:

1. Focus on core flow: Connect → Select → Fetch → Reply
2. Skip: Advanced filtering, email notifications, PDF exports
3. Use mock data for reports if needed

**If user says "1 day left"**:

1. YouTube only (skip Instagram)
2. Manual approval for replies (skip full automation)
3. Basic dashboard (skip fancy UI)

**If user says "4 hours left"**:

1. Pre-record demo video (safest)
2. Use mock data for everything
3. Focus on presentation slides

---

## 💬 Communication Protocol

### When Asking User Questions

**Good**:

- "Should I implement YouTube first or Instagram first?"
- "OAuth is set up. What API keys do you have ready?"
- "Do you want full automation or manual approval for demo?"

**Bad**:

- "This might take a while..." (Don't discourage)
- "I don't know how to..." (Figure it out or ask specific question)
- "This is too complex..." (Break it down)

### When Reporting Progress

**Good**:

- "✅ YouTube OAuth working. Testing with your account."
- "⚠️ Instagram API needs app review. Using test mode for demo."
- "📊 Current status: 60% complete. ETA: 4 hours."

**Bad**:

- "I did some stuff" (Be specific)
- "Almost done" (Give real percentage)
- "There's a problem" (Explain what and how to fix)

---

## 🔄 Handoff Checklist

### When YOU hand off to another agent:

- [ ] Update `07-DEVELOPMENT-LOG.md` with current status
- [ ] Commit all code changes
- [ ] Document any API keys added to `.env.local`
- [ ] Note any blockers or issues
- [ ] Update relevant documentation
- [ ] Leave clear "Next Steps" in log

### When RECEIVING handoff:

- [ ] Read `00-README.md`, `01-ARCHITECTURE.md`, `07-DEVELOPMENT-LOG.md`
- [ ] Run `npm install` and `npx prisma generate`
- [ ] Test that dev server starts: `npm run dev`
- [ ] Check what API keys are missing
- [ ] Read last 5 entries in Development Log
- [ ] Understand current blockers

---

## 🎓 Project-Specific Knowledge

### This is a College Project

- **Professors expect**: Academic explanation of Airflow scalability
- **Professors won't check**: If you actually fine-tuned a model
- **Demo focus**: End-to-end flow working, not perfect code
- **Presentation tip**: Emphasize architecture, not implementation details

### User's Constraints

- **Time pressure**: 2 days total
- **Technical level**: Moderate (can follow instructions)
- **Environment**: Likely developing on Mac/Windows laptop
- **Deployment**: Not required, demo on localhost is fine

---

## 📞 Emergency Procedures

### If Demo is Tomorrow and Nothing Works

**Plan A**: Focus on YouTube only

- Get OAuth working
- Manual comment fetching (skip Airflow)
- Manual reply posting
- Show Airflow in slides, not live

**Plan B**: Pre-recorded demo

- Record video of working system
- Prepare slides explaining architecture
- Have code ready to show

**Plan C**: Pivot to design presentation

- Show architecture diagrams
- Walk through code structure
- Explain what you would build (future scope)

### If User is Stuck on Setup

1. **Check `.env.local`**: 90% of issues are here
2. **Check `npm install`**: Dependencies missing
3. **Check Prisma**: Run `npx prisma generate`

---

## 📋 Handoff Message Template

When you finish your session, add this to `07-DEVELOPMENT-LOG.md`:
```markdown
## 🔄 Agent Handoff - YYYY-MM-DD HH:MM AM/PM

### Completed This Session
- ✅ Task 1
- ✅ Task 2
- ✅ Task 3

### Current State
- **Working**: What's functional
- **Not Working**: What's broken/incomplete
- **Blocked**: What needs external input

### Next Steps (Priority Order)
1. High priority task
2. Medium priority task
3. Low priority task

### Known Issues
- Issue 1: Description and workaround
- Issue 2: Description and status

### Files Modified
- path/to/file1.ts
- path/to/file2.tsx

### Environment Variables Added
- NEW_VAR_NAME (get from service X)

### Documentation Updated
- 07-DEVELOPMENT-LOG.md
- 04-API-REFERENCE.md

### Estimated Completion
**Overall Project**: XX% complete
**Remaining Time**: X hours

### Notes for Next Agent
- Important context or gotchas
- Testing notes
- Credentials or test data
```

---

**Last Updated**: 2025-03-16
**Handoff Protocol Version**: 1.0
