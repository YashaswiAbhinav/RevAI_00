# Environment Setup Guide

## 📝 Overview

This guide explains how to obtain all API keys and credentials needed for RevAI.

## 🔑 Required Environment Variables

Copy `.env.example` to `.env.local` and fill in these values:

---

## 1️⃣ Database Configuration

### PostgreSQL (Required Immediately)

**Option A: Supabase (Recommended - Free)**

1. Go to https://supabase.com/
2. Click "Start your project"
3. Sign in with GitHub
4. Click "New project"
5. Fill in:
   - Name: `revai-db`
   - Database Password: Choose a strong password
   - Region: Closest to you
6. Wait 2 minutes for provisioning
7. Click "Project Settings" → "Database"
8. Copy "Connection string" (URI format)
9. Paste into `.env.local`:
```bash
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

**Option B: Neon (Alternative - Free)**

1. Go to https://neon.tech/
2. Sign up
3. Create new project
4. Copy connection string
5. Paste as `DATABASE_URL`

**Option C: Local PostgreSQL (Docker)**
```bash
docker run --name revai-postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=revai \
  -p 5432:5432 \
  -d postgres:14

# Then set:
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/revai"
```

---

### Firebase (Required Immediately)

**Step 1: Create Firebase Project**

1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Name: `revai-demo`
4. Disable Google Analytics (not needed)
5. Click "Create project"

**Step 2: Enable Firestore**

1. In Firebase Console → Firestore Database
2. Click "Create database"
3. Start in **test mode** (for development)
4. Choose location: `us-central1`
5. Click "Enable"

**Step 3: Get Service Account Credentials**

1. Click ⚙️ (Settings) → "Project settings"
2. Go to "Service accounts" tab
3. Click "Generate new private key"
4. Save the JSON file (KEEP THIS SECURE!)
5. Open the file and copy values to `.env.local`:
```bash
FIREBASE_PROJECT_ID="revai-demo"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@revai-demo.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQE...\n-----END PRIVATE KEY-----\n"
```

**IMPORTANT**: The `FIREBASE_PRIVATE_KEY` must keep the `\n` characters!

---

## 2️⃣ Authentication

### NextAuth Secret (Required Immediately)

Generate a random 32-character string:
```bash
openssl rand -base64 32
```

Paste into `.env.local`:
```bash
NEXTAUTH_SECRET="your-random-32-character-string-here"
NEXTAUTH_URL="http://localhost:3000"
```

---

### Encryption Key (Required Immediately)

Generate a 32-character key for encrypting OAuth tokens:
```bash
openssl rand -hex 16
```

Paste into `.env.local`:
```bash
ENCRYPTION_KEY="your-32-character-hex-string-here"
```

---

## 3️⃣ YouTube API (Google Cloud)

**Step 1: Create Google Cloud Project**

1. Go to https://console.cloud.google.com/
2. Click "Select a project" → "New Project"
3. Name: `revai-youtube`
4. Click "Create"

**Step 2: Enable YouTube Data API v3**

1. In Google Cloud Console → "APIs & Services" → "Library"
2. Search: "YouTube Data API v3"
3. Click on it → Click "Enable"

**Step 3: Create OAuth Credentials**

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure consent screen:
   - User Type: **External**
   - App name: `RevAI`
   - User support email: Your email
   - Developer contact: Your email
   - Click "Save and Continue" → "Save and Continue" (skip scopes)
   - Add test users: Your Gmail address
   - Click "Save and Continue"
4. Back to "Create OAuth client ID":
   - Application type: **Web application**
   - Name: `RevAI YouTube OAuth`
   - Authorized redirect URIs:
     - `http://localhost:3000/api/connections/youtube/callback`
     - `http://localhost:3000/api/auth/callback/google`
   - Click "Create"
5. Copy **Client ID** and **Client Secret**

Paste into `.env.local`:
```bash
GOOGLE_CLIENT_ID="123456789-xxxxxxxxxxxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxx"
```

**Step 4: Add OAuth Scopes**

In Google Cloud Console → OAuth consent screen → Edit App:

1. Click "Add or Remove Scopes"
2. Add these scopes:
   - `https://www.googleapis.com/auth/youtube.force-ssl`
   - `https://www.googleapis.com/auth/youtube.readonly`
3. Click "Update" → "Save and Continue"

---

## 4️⃣ Reddit API

**Step 1: Create Reddit App**

1. Sign in to Reddit with the account you want to connect
2. Open `https://www.reddit.com/prefs/apps`
3. Click "create app" or "create another app"
4. Set:
   - Name: `RevAI Reddit`
   - App type: **web app**
   - Redirect URI: `http://localhost:3000/api/connections/reddit/callback`
5. Save the app

**Step 2: Copy Credentials**

From the Reddit app page:

- The string under the app name is the **client ID**
- The **secret** field is the client secret

Paste into `.env.local`:
```bash
REDDIT_CLIENT_ID="your-reddit-client-id"
REDDIT_CLIENT_SECRET="your-reddit-client-secret"
REDDIT_USER_AGENT="revai/1.0 by u/your_reddit_username"
```

**Step 3: OAuth Behavior**

- RevAI requests `identity`, `read`, `submit`, and `history`
- The app uses permanent duration so a refresh token is issued
- Access tokens are refreshed automatically when they are near expiry

---

## 5️⃣ Instagram/Facebook API (Meta)

This integration remains available, but it is not required for the current demo path if Meta developer setup is blocking progress.

**Step 1: Create Meta Developer Account**

1. Go to https://developers.facebook.com/
2. Click "Get Started"
3. Complete registration

**Step 2: Create App**

1. Click "My Apps" → "Create App"
2. Use case: **Business**
3. App name: `RevAI Social`
4. App contact email: Your email
5. Click "Create App"

**Step 3: Add Instagram Products**

1. In App Dashboard → "Add Products"
2. Find "Instagram" → Click "Set Up"
3. Find "Facebook Login" → Click "Set Up"

**Step 4: Get App Credentials**

1. Settings → Basic
2. Copy **App ID** and **App Secret**

Paste into `.env.local`:
```bash
META_APP_ID="your-app-id"
META_APP_SECRET="your-app-secret"
```

**Step 5: Configure OAuth Redirect URIs**

1. Facebook Login → Settings
2. Valid OAuth Redirect URIs:
   - `http://localhost:3000/api/connections/instagram/callback`
   - `http://localhost:3000/api/connections/facebook/callback`
3. Click "Save Changes"

**Step 6: Setup Instagram Test Account**

For development, you need an Instagram **Business** or **Creator** account:

1. Open Instagram app on phone
2. Go to Profile → Settings → Account
3. Switch to "Professional Account"
4. Choose "Creator"
5. Connect to a Facebook Page:
   - Create a Facebook Page if you don't have one
   - Link Instagram account to this page

---

## 6️⃣ Gemini AI API

**Step 1: Get API Key**

1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Select your Google Cloud project (or create new)
4. Copy the API key

Paste into `.env.local`:
```bash
GEMINI_API_KEY="AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX"
```

**Pricing**: Free tier includes:
- 60 requests per minute
- 1,500 requests per day
- More than enough for demo!

---

## 6️⃣ Airflow Configuration

**Generate Fernet Key**:
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Paste into `.env.local`:
```bash
AIRFLOW__CORE__FERNET_KEY="your-fernet-key-here"
AIRFLOW_UID=50000
```

---

## 7️⃣ Optional Environment Variables

### Redis (For Airflow CeleryExecutor)

If using Redis for Airflow job queue:
```bash
REDIS_URL="redis://localhost:6379"
```

### Application Settings
```bash
NODE_ENV="development"
PORT=3000

# Rate limiting
MAX_REPLIES_PER_HOUR=30
MAX_REPLIES_PER_DAY=200

# Feature flags
ENABLE_AUTO_REPLY=true
ENABLE_WEBHOOKS=false
```

---

## ✅ Verification Checklist

After setting up all variables:

- [ ] PostgreSQL connection works: `npx prisma db push`
- [ ] Firebase connection works: `npx tsx scripts/test-firebase.ts`
- [ ] Next.js starts: `npm run dev`
- [ ] YouTube OAuth redirects correctly
- [ ] Gemini API responds: Test with curl

---

## 📋 Complete `.env.local` Template
```bash
# ============================================
# DATABASE CONFIGURATION
# ============================================

DATABASE_URL="postgresql://..."

# Firebase (Firestore)
FIREBASE_PROJECT_ID="revai-demo"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@revai-demo.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ============================================
# AUTHENTICATION
# ============================================

NEXTAUTH_SECRET="your-random-32-character-string"
NEXTAUTH_URL="http://localhost:3000"

# Encryption
ENCRYPTION_KEY="your-32-character-hex-string"

# ============================================
# YOUTUBE API (Google Cloud)
# ============================================

GOOGLE_CLIENT_ID="123456789-xxxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxx"

# ============================================
# META (Facebook + Instagram) API
# ============================================

META_APP_ID="your-app-id"
META_APP_SECRET="your-app-secret"
META_WEBHOOK_VERIFY_TOKEN="random-token-you-choose"

# ============================================
# GEMINI AI
# ============================================

GEMINI_API_KEY="AIzaSyXXXXXXXXXXXXXXXXXXX"

# ============================================
# AIRFLOW CONFIGURATION
# ============================================

AIRFLOW__CORE__FERNET_KEY="your-fernet-key"
AIRFLOW_UID=50000
AIRFLOW__CORE__EXECUTOR=LocalExecutor
AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=postgresql://airflow:airflow@postgres:5432/airflow

# ============================================
# APPLICATION SETTINGS
# ============================================

NODE_ENV=development
PORT=3000

MAX_REPLIES_PER_HOUR=30
MAX_REPLIES_PER_DAY=200

ENABLE_AUTO_REPLY=true
ENABLE_WEBHOOKS=false
```

---

## 🔒 Security Reminders

1. **NEVER commit `.env.local`** - It's in `.gitignore`
2. **Use environment secrets** in production (Vercel, Railway)
3. **Rotate keys** if accidentally exposed
4. **Keep Firebase service account JSON secure** - Treat like a password

---

**Last Updated**: 2025-03-16
**Setup Difficulty**: Moderate (30-60 minutes)
