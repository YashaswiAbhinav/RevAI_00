# Setup Guide

## 📋 Prerequisites

Before starting, ensure you have:

- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm or yarn installed
- [ ] Docker installed (for Airflow)
- [ ] Git installed
- [ ] Code editor (VS Code recommended)
- [ ] Google account (for Firebase)

## 🚀 Setup Steps

### Step 1: Clone & Install
```bash
# Clone repository
git clone <repo-url>
cd revai

# Install dependencies
npm install
```

This will install:

- Next.js, React, TypeScript
- Prisma ORM
- NextAuth.js
- Firebase Admin SDK
- Google APIs client
- Gemini AI SDK
- Tailwind CSS + shadcn/ui

### Step 2: Setup Environment Variables
```bash
# Copy template
cp .env.example .env.local

# Open .env.local and fill in values
# (See 06-ENVIRONMENT-SETUP.md for how to get each key)
```

**Required immediately:**

- `DATABASE_URL` (PostgreSQL connection string)
- `NEXTAUTH_SECRET` (random string)
- `ENCRYPTION_KEY` (32-character random string)
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

**Required for full functionality:**

- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` (YouTube OAuth)
- `META_APP_ID` & `META_APP_SECRET` (Instagram/Facebook OAuth)
- `GEMINI_API_KEY` (AI replies)

### Step 3: Setup PostgreSQL

#### Option A: Local PostgreSQL (Docker)
```bash
docker run --name revai-postgres \
  -e POSTGRES_PASSWORD=revai@123 \
  -e POSTGRES_DB=revai \
  -p 5432:5432 \
  -d postgres:14

# Update .env.local
# DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/revai"
```

#### Option B: Cloud PostgreSQL (Recommended)

1. Go to https://supabase.com/ or https://neon.tech/
2. Create free account
3. Create new project
4. Copy connection string
5. Paste into `.env.local` as `DATABASE_URL`

### Step 4: Setup Firebase

#### Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Enter project name: `revai-demo` (or anything you like)
4. Disable Google Analytics (not needed for demo)
5. Click "Create project"

#### Enable Firestore Database

1. In Firebase Console, click "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select location: `us-central` (or closest to you)
5. Click "Enable"

#### Get Firebase Credentials

1. In Firebase Console, click ⚙️ (Settings) → "Project settings"
2. Go to "Service accounts" tab
3. Click "Generate new private key"
4. Download JSON file
5. Open the JSON file and copy these values to `.env.local`:
```bash
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nXXXXX\n-----END PRIVATE KEY-----\n"
```

**Important**: The `FIREBASE_PRIVATE_KEY` must keep the `\n` characters!

#### Set Firestore Security Rules (Optional for demo)

1. In Firebase Console → Firestore Database → Rules
2. Paste this (allows authenticated users only):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click "Publish"

### Step 5: Initialize Database Schema
```bash
# Generate Prisma client
npx prisma generate

# Push schema to PostgreSQL (creates tables)
npx prisma db push

# (Optional) Open Prisma Studio to view data
npx prisma studio
```

### Step 6: Run Development Server
```bash
npm run dev
```

Open http://localhost:3000

You should see the landing page!

### Step 7: Setup Airflow (Optional for initial testing)
```bash
# Start Airflow services
docker-compose up -d

# Wait 30 seconds for initialization

# Access Airflow UI
# URL: http://localhost:8080
# Username: admin
# Password: admin
```

## ✅ Verify Setup

### PostgreSQL Connection
```bash
npx prisma studio
```

Should open Prisma Studio without errors.

### Firebase Connection

Create a test file: `scripts/test-firebase.ts`
```typescript
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

initializeApp({
  credential: cert(serviceAccount as any),
});

const db = getFirestore();

async function testFirestore() {
  try {
    const docRef = await db.collection('test').add({
      message: 'Hello from RevAI!',
      timestamp: new Date(),
    });
    console.log('✅ Firestore connected! Doc ID:', docRef.id);
  } catch (error) {
    console.error('❌ Firestore error:', error);
  }
}

testFirestore();
```

Run: `npx tsx scripts/test-firebase.ts`

Should print: `✅ Firestore connected! Doc ID: xxxxx`

### Next.js Server
```bash
npm run dev
```

Should start on port 3000 without errors.

## 🐛 Troubleshooting

**"Module not found" errors**
```bash
rm -rf node_modules package-lock.json
npm install
```

**"Can't connect to PostgreSQL"**

- Check `DATABASE_URL` in `.env.local`
- Ensure PostgreSQL is running
- Try: `npx prisma db push` again

**"Prisma Client not found"**
```bash
npx prisma generate
```

**"Firebase permission denied"**

- Check Firestore Security Rules (should allow authenticated requests)
- Verify service account credentials in `.env.local`
- Make sure `FIREBASE_PRIVATE_KEY` has `\n` characters preserved

**"Port 3000 already in use"**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

## 📚 Next Steps

After successful setup:

1. Read `03-DATABASE-SCHEMA.md` to understand data models
2. Read `04-API-REFERENCE.md` to see available endpoints
3. Start building! Check `07-DEVELOPMENT-LOG.md` for progress

---

**Last Updated**: 2025-03-16