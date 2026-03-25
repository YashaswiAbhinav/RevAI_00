# RevAI: Intelligent Social Media Auto-Response System

## 🎯 What This Project Does

RevAI automates customer engagement on YouTube, Reddit, and Instagram by:

1. Monitoring comments on user's content
2. Using AI to generate contextual replies
3. Automatically posting responses
4. Generating market trend reports

## 🏗️ Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes + Prisma ORM
- **Databases**: 
  - PostgreSQL (user data, connections, settings)
  - Firebase Firestore (comments, replies, reports)
- **AI**: Google Gemini API
- **Automation**: Apache Airflow (Docker)
- **Auth**: NextAuth.js

## 📁 Project Structure
```
revai/
├── app/                 # Next.js pages & API routes
├── prisma/              # Database schema & migrations
├── lib/                 # Utilities, integrations, DB clients
├── components/          # React components
├── airflow/             # Airflow DAGs & tasks
└── docs/                # Documentation (YOU ARE HERE)
```

## 🚀 Quick Start

1. Read `02-SETUP-GUIDE.md` for detailed setup
2. Check `06-ENVIRONMENT-SETUP.md` for API keys needed
3. Run: `npm install && npx prisma db push && npm run dev`

## 📖 Documentation Guide

**New to project?** Start with `01-ARCHITECTURE.md`

**Setting up locally?** Follow `02-SETUP-GUIDE.md`

**API keys needed?** See `06-ENVIRONMENT-SETUP.md`

**Airflow not working?** Check `05-AIRFLOW-GUIDE.md`

**Database questions?** Read `03-DATABASE-SCHEMA.md`

**Stuck on something?** Try `08-TROUBLESHOOTING.md`

**Taking over from another agent?** Read `09-AGENT-HANDOFF.md`

## 🎓 College Project Context

- **Course**: B.Tech Computer Science, VII Semester
- **Institution**: Cochin University of Science and Technology
- **Guide**: Dr. Pramod Pavithran
- **Team**: Marcio, Mohamed, Pratibha, Sanvi, Yashaswi
- **Timeline**: 2 days implementation + demo
- **Key Feature**: Apache Airflow for scalability (justify in presentation)

## 📊 Current Status

See `07-DEVELOPMENT-LOG.md` for real-time progress tracking.

## 🤖 For AI Agents

If you're an AI agent taking over this project:

1. Read `09-AGENT-HANDOFF.md` first
2. Check `07-DEVELOPMENT-LOG.md` for current state
3. Understand architecture from `01-ARCHITECTURE.md`
4. Reference `04-API-REFERENCE.md` when modifying APIs

---

**Last Updated**: 2026-03-24
**Current Phase**: UI/UX Polish plus Reddit integration on top of a working core product
