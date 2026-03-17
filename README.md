# RevAI: Intelligent Social Media Auto-Response System

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.7-green)](https://www.prisma.io/)
[![Airflow](https://img.shields.io/badge/Apache%20Airflow-2.8-orange)](https://airflow.apache.org/)
[![Gemini AI](https://img.shields.io/badge/Gemini%20AI-1.0-purple)](https://ai.google.dev/)

An intelligent social media automation platform that uses AI to monitor, analyze, and respond to comments on YouTube, Instagram, and Facebook. Built with Next.js 14, Apache Airflow.

## 🎯 What RevAI Does

RevAI automates customer engagement across social media platforms by:

- **Monitoring Comments**: Automatically fetches comments from your connected social media accounts
- **Smart Reply Generation**: Generates contextual, business-appropriate responses
- **Automated Posting**: Posts approved replies back to platforms with rate limiting
- **Analytics & Reports**: Provides insights on engagement trends and sentiment analysis

## ✨ Key Features

- 🔐 **Secure Authentication**: NextAuth.js with Google OAuth and credentials
- 📊 **Multi-Platform Support**: YouTube, Instagram, and Facebook integration
- ⚡ **Real-time Automation**: Apache Airflow orchestrates the entire comment processing pipeline
- 🛡️ **Enterprise Security**: AES-256 encryption for API tokens, secure database connections
- 📈 **Analytics Dashboard**: Comprehensive reports on engagement metrics and trends
- 🎛️ **Customizable Settings**: Configure AI tone, reply filters, and automation preferences
- 🔄 **Manual Approval Workflow**: Review and approve AI-generated responses before posting

## 🏗️ Architecture

```
┌─────────────┐
│   Client    │ (Browser - Next.js 14)
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
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
    [YouTube]    [Instagram]    [Gemini AI]
```

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Modern UI components
- **Lucide React** - Beautiful icons

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **Prisma ORM** - Database toolkit
- **NextAuth.js** - Authentication library

### Databases
- **PostgreSQL** - User data, connections, settings (via Prisma)
- **Firebase Firestore** - Comments, replies, analytics (high-volume data)

### AI & Automation
- **Google Gemini AI** - Comment analysis and reply generation
- **Apache Airflow** - Workflow orchestration (Docker)
- **Google APIs** - YouTube Data API, Meta Graph API

### Infrastructure
- **Docker Compose** - Container orchestration
- **AES-256 Encryption** - Token security
- **Environment Configuration** - Secure credential management

## 📋 Prerequisites

Before running RevAI, ensure you have:

- **Node.js 18+** (`node --version`)
- **npm or yarn** package manager
- **Docker & Docker Compose** (for Airflow)
- **Git** version control
- **Code editor** (VS Code recommended)
- **Google account** (for Firebase and YouTube API)

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd revai
```

### 2. Install Dependencies

```bash
npm install
```

This installs all required packages including Next.js, Prisma, Firebase SDK, Google APIs, and more.

### 3. Environment Configuration

```bash
# Copy the environment template
cp .env.example .env.local

# Edit .env.local with your API keys (see section below)
```

### 4. Database Setup

#### Option A: Supabase (Recommended - Free)

1. Go to [supabase.com](https://supabase.com/)
2. Create a new project
3. Copy the connection string
4. Add to `.env.local` as `DATABASE_URL`

#### Option B: Local PostgreSQL (Docker)

```bash
docker run --name revai-postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=revai \
  -p 5432:5432 \
  -d postgres:14
```

Then set in `.env.local`:
```bash
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/revai"
```

### 5. Push Database Schema

```bash
# Generate Prisma client and push schema
npm run db:push
```

### 6. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 🔑 API Keys & Environment Setup

### Required Immediately

1. **PostgreSQL Database URL**
   - Get from Supabase, Neon, or local Docker setup

2. **NextAuth Secret**
   ```bash
   openssl rand -base64 32
   ```

3. **Encryption Key** (32 characters)
   ```bash
   openssl rand -hex 32
   ```

4. **Firebase Credentials**
   - Create project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Firestore Database
   - Generate service account key
   - Copy `project_id`, `client_email`, `private_key` to `.env.local`

### Required for Full Functionality

5. **YouTube API**
   - Google Cloud Console → APIs & Services
   - Enable YouTube Data API v3
   - Create OAuth 2.0 credentials
   - Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

6. **Instagram/Meta API**
   - [Meta for Developers](https://developers.facebook.com/)
   - Create app with Instagram Basic Display
   - Add `META_APP_ID` and `META_APP_SECRET`

7. **Gemini AI API**
   - [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Generate API key
   - Add `GEMINI_API_KEY`

See `docs/06-ENVIRONMENT-SETUP.md` for detailed setup instructions.

## 🏃‍♂️ Running the Application

### Development Mode

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

### Database Management

```bash
# View database in browser
npm run db:studio

# Create and run migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate
```

## 🚁 Apache Airflow Setup

Airflow handles the automated comment processing pipeline. It runs in Docker and includes three main DAGs:

1. **Fetch Comments** (every 30 minutes)
2. **Process Replies** (every hour)
3. **Post Replies** (every 15 minutes)

### Start Airflow

```bash
# From project root
docker-compose up airflow

# Or start all services
docker-compose up
```

### Access Airflow UI

- **URL**: [http://localhost:8080](http://localhost:8080)
- **Username**: `airflow`
- **Password**: `airflow`

### Airflow DAGs

- `fetch_comments_dag.py` - Fetches comments from monitored content
- `process_replies_dag.py` - AI analysis and reply generation
- `post_replies_dag.py` - Posts approved replies to platforms

See `docs/05-AIRFLOW-GUIDE.md` for detailed Airflow documentation.

## 📁 Project Structure

```
revai/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── auth/                 # Authentication endpoints
│   │   ├── connections/          # Platform OAuth flows
│   │   ├── content/              # Content management
│   │   ├── comments/             # Comment operations
│   │   └── reports/              # Analytics & reports
│   ├── dashboard/                # Protected dashboard pages
│   ├── auth/                     # Login/register pages
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page
├── components/                   # React components
│   ├── DashboardLayout.tsx       # Main dashboard layout
│   └── SessionProvider.tsx       # Auth session provider
├── lib/                          # Utility libraries
│   ├── db/                       # Database clients
│   │   ├── postgres.ts           # PostgreSQL connection
│   │   └── firestore.ts          # Firebase connection
│   ├── integrations/             # External API integrations
│   │   ├── youtube.ts            # YouTube API client
│   │   ├── instagram.ts          # Instagram API client
│   │   └── gemini.ts             # Gemini AI client
│   └── security/                 # Security utilities
│       └── encryption.ts         # AES-256 encryption
├── prisma/                       # Database schema
│   └── schema.prisma             # Prisma schema definition
├── airflow/                      # Airflow automation
│   ├── dags/                     # DAG definitions
│   │   ├── fetch_comments_dag.py
│   │   ├── process_replies_dag.py
│   │   └── post_replies_dag.py
│   └── tasks/                    # Task implementations
│       ├── __init__.py
│       └── helpers.py
├── docs/                         # Documentation
├── docker-compose.yml            # Docker services
├── package.json                  # Node.js dependencies
├── tailwind.config.js            # Tailwind configuration
├── next.config.js                # Next.js configuration
└── .env.example                  # Environment template
```

## 🤝 Contributing

### Branch Policy ⚠️ IMPORTANT

**NEVER commit directly to the `main` branch!**

1. **Create a feature branch** for all changes:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/bug-description
   ```

2. **Push your branch** and create a Pull Request:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Wait for review** before merging to main.

### Development Workflow

1. **Fork** the repository
2. **Create a feature branch** from `main`
3. **Make your changes** following the coding standards
4. **Test thoroughly** - run `npm run type-check` and `npm run lint`
5. **Commit with clear messages**:
   ```bash
   git commit -m "feat: add user authentication flow"
   ```
6. **Push and create Pull Request**

### Coding Standards

- Use **TypeScript** for all new code
- Follow **ESLint** rules (run `npm run lint`)
- Use **Prettier** for code formatting
- Write meaningful commit messages
- Add tests for new features
- Update documentation for API changes

## 🤖 Agentic Coding Guidelines

This project uses AI agents for collaborative development. If you're an AI agent working on this project:

### Getting Started

1. **Read the docs first** (in this order):
   - `docs/00-README.md` - Project overview
   - `docs/01-ARCHITECTURE.md` - System design
   - `docs/07-DEVELOPMENT-LOG.md` - Current status

2. **Understand the codebase**:
   - `prisma/schema.prisma` - Database structure
   - `lib/integrations/` - Platform API clients
   - `airflow/dags/` - Automation workflows

### Development Approach

- **Use the existing patterns** - Follow the established architecture
- **Check current status** - Read `docs/07-DEVELOPMENT-LOG.md` before starting
- **Update documentation** - Keep docs current as you work
- **Test thoroughly** - Validate all changes work end-to-end
- **Follow security practices** - Never expose API keys or sensitive data

### Communication

- **Update the development log** (`docs/07-DEVELOPMENT-LOG.md`) with your progress
- **Document decisions** in the relevant doc files
- **Ask clarifying questions** if requirements are unclear
- **Create branches** for your work (never commit to main)

### Key Files for Agents

**Must understand**:
- `docs/09-AGENT-HANDOFF.md` - Agent onboarding guide
- `docs/04-API-REFERENCE.md` - API endpoint documentation
- `docs/08-TROUBLESHOUTING.md` - Common issues and solutions

**Reference docs**:
- `docs/02-SETUP-GUIDE.md` - Environment setup
- `docs/03-DATABASE-SCHEMA.md` - Database design
- `docs/05-AIRFLOW-GUIDE.md` - Automation setup
- `docs/06-ENVIRONMENT-SETUP.md` - API key configuration

## 📊 Current Status

**Phase**: Phase 6 - Airflow Automation (In Progress)
**Completion**: ~85%

✅ **Completed**:
- Next.js 14 application with authentication
- Platform OAuth integrations (YouTube, Instagram)
- Content monitoring setup
- AI-powered comment analysis and reply generation
- Dashboard with manual approval workflow
- Analytics and reporting
- Docker Compose infrastructure

🔄 **In Progress**:
- Airflow DAG integration with real API calls
- End-to-end automation testing

See `docs/07-DEVELOPMENT-LOG.md` for detailed progress tracking.

## 🐛 Troubleshooting

Common issues and solutions:

- **Database connection fails**: Check `DATABASE_URL` in `.env.local`
- **Airflow not starting**: Ensure Docker is running, check `docker-compose.yml`
- **API keys not working**: Verify keys in Firebase Console/Google Cloud
- **OAuth redirects failing**: Check callback URLs in API console

See `docs/08-TROUBLESHOUTING.md` for comprehensive troubleshooting guide.

## 📚 Documentation

Complete documentation is available in the `docs/` directory:

- `00-README.md` - Project overview (this file)
- `01-ARCHITECTURE.md` - System design and data flow
- `02-SETUP-GUIDE.md` - Installation and setup instructions
- `03-DATABASE-SCHEMA.md` - Database design and models
- `04-API-REFERENCE.md` - API endpoint documentation
- `05-AIRFLOW-GUIDE.md` - Airflow automation setup
- `06-ENVIRONMENT-SETUP.md` - API keys and credentials
- `07-DEVELOPMENT-LOG.md` - Current development status
- `08-TROUBLESHOUTING.md` - Common issues and solutions
- `09-AGENT-HANDOFF.md` - AI agent onboarding guide
- `10-AGENT-LOG-MAINTENANCE.md` - Agent development tracking

## 🎓 Academic Project Context

**Course**: B.Tech Computer Science, VII Semester
**Institution**: Cochin University of Science and Technology
**Guide**: Dr. Pramod Pavithran
**Team**: Marcio, Mohamed, Pratibha, Sanvi, Yashaswi
**Timeline**: 2 days implementation + demo
**Key Requirement**: Apache Airflow integration for scalability justification

## 📄 License

This project is developed as part of an academic coursework assignment.

## 🙏 Acknowledgments

- **Apache Airflow** for workflow orchestration
- **Next.js** for the excellent React framework
- **Prisma** for database tooling
- **Firebase** for scalable NoSQL database
- **shadcn/ui** for beautiful UI components

---

**Built with ❤️ for automated social media engagement**

*Last updated: March 2026*
