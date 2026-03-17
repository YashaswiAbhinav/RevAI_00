# Troubleshooting Guide

## 🔍 Common Issues & Solutions

---

## 1️⃣ Database Issues

### "Prisma Client Not Found"

**Error**:
```
Cannot find module '@prisma/client'
```

**Solution**:
```bash
npx prisma generate
npm run dev
```

**Why**: Prisma client must be regenerated after schema changes.

---

### "Can't Connect to PostgreSQL"

**Error**:
```
Can't reach database server at `localhost:5432`
```

**Solutions**:

1. **Check if PostgreSQL is running**:
```bash
# For Docker
docker ps | grep postgres

# If not running
docker start revai-postgres
```

2. **Verify `DATABASE_URL` in `.env.local`**:
```bash
# Should look like:
DATABASE_URL="postgresql://user:password@host:5432/database"
```

3. **Test connection**:
```bash
npx prisma db push
```

---

### "Firebase Permission Denied"

**Error**:
```
Error: 7 PERMISSION_DENIED: Missing or insufficient permissions
```

**Solutions**:

1. **Check Firestore Security Rules**:

Go to Firebase Console → Firestore → Rules

For development, use:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // Open for testing
    }
  }
}
```

2. **Verify service account credentials**:

Check `.env.local`:
```bash
FIREBASE_PROJECT_ID="correct-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@project.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Important**: `FIREBASE_PRIVATE_KEY` must have `\n` characters!

3. **Test Firebase connection**:
```bash
npx tsx scripts/test-firebase.ts
```

---

### "Firebase Private Key Invalid"

**Error**:
```
Error parsing private key: error:1E08010C:DECODER routines::unsupported
```

**Solution**:

The private key must keep newline characters. In `.env.local`:

**Wrong**:
```bash
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY----- MIIEvQIBADA... -----END PRIVATE KEY-----"
```

**Correct**:
```bash
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADA...\n-----END PRIVATE KEY-----\n"
```

Notice the `\n` characters!

---

## 2️⃣ Authentication Issues

### "OAuth Callback Error"

**Error**:
```
Callback URL mismatch
```

**Solutions**:

1. **Check Google Cloud Console**:
   - Go to Credentials → OAuth 2.0 Client IDs
   - Verify redirect URI includes:
```
     http://localhost:3000/api/connections/youtube/callback
```

2. **Check `.env.local`**:
```bash
   NEXTAUTH_URL="http://localhost:3000"
```
   Must match your dev server URL (no trailing slash!)

3. **Register the exact YouTube connection callback URI**:
   - Go to Google Cloud Console → APIs & Services → Credentials
   - Open your OAuth 2.0 Client ID
   - Under **Authorized redirect URIs**, add:
```text
http://localhost:3000/api/connections/youtube/callback
```
   - If you also use Google sign-in via NextAuth, keep this one too:
```text
http://localhost:3000/api/auth/callback/google
```
   Google requires an exact match for the `redirect_uri`.

---

### "Session Not Persisting"

**Problem**: User logs in, but gets logged out on page refresh

**Solutions**:

1. **Check cookies are enabled** in browser

2. **Verify `NEXTAUTH_SECRET` is set**:
```bash
   NEXTAUTH_SECRET="some-random-string-at-least-32-chars"
```

3. **Clear browser cookies**:
   - Chrome: DevTools → Application → Cookies → Clear

4. **Restart dev server**:
```bash
   # Stop with Ctrl+C
   npm run dev
```

---

### "Google Sign-In Returns To /auth/login?error=Callback"

**Problem**: Google account selection succeeds, but the app returns to:
```text
/auth/login?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Fdashboard&error=Callback
```

**Common Causes and Fixes**:

1. **`NEXTAUTH_URL` does not match the running app**
```bash
NEXTAUTH_URL="http://localhost:3000"
```
If the app runs on port `3000`, do not leave `NEXTAUTH_URL` at `3001`.

2. **Auth options are imported from the route file instead of a shared module**
Use a shared auth config such as `lib/auth.ts`, then import `authOptions` from there in layouts and API routes.

3. **Google sign-in is using `PrismaAdapter` without the required NextAuth tables**
If the Prisma schema does not include `Account`, `Session`, and `VerificationToken`, either:
- add those models and migrate the database, or
- use JWT sessions and create/reuse users manually during the Google sign-in callback.

4. **Old cookies or stale dev server state**
Clear cookies for `localhost:3000`, then restart the dev server:
```bash
npm run dev
```

---

### "YouTube Connect Redirects To /dashboard/connections?error=connection_failed"

**Problem**: Google OAuth finishes, but the app redirects back to the connections page with:
```text
/dashboard/connections?error=connection_failed
```

**Likely causes**:

1. **The Google account has no usable YouTube channel**
   The callback may succeed, but `channels.list({ mine: true })` can still return no channel.

2. **Token exchange succeeded, but the follow-up YouTube API request failed**
   This can happen because of missing permissions, revoked consent, or Google account/channel setup issues.

3. **The app was hiding the real callback error**
   A generic catch block can mask the underlying failure unless the callback maps errors to specific codes.

**What to do**:

- Retry the flow after the callback error mapping update.
- Check the banner on the Connections page for a more specific error such as:
  - `no_youtube_channel`
  - `token_exchange_failed`
  - `insufficient_permissions`
- If needed, inspect the server log for `YouTube callback error:` output.

---

## 3️⃣ API Issues

### "ENCRYPTION_KEY must be exactly 32 characters long"

**Error**:
```text
Error: ENCRYPTION_KEY must be exactly 32 characters long
```

**Why it happens**:

Some setups use a 64-character hex string for a 32-byte AES key. That is valid, but strict length checks that only allow 32 characters will reject it.

**Solution**:

Accept either:
- a 32-character raw string, or
- a 64-character hex string

Example valid key:
```bash
ENCRYPTION_KEY="4c020e38b37054ed5e3e6e44a3f9e90f994cbd86f06137460c02a55a977ca4cb"
```

After updating validation logic, restart the dev server:
```bash
npm run dev
```

---

### "YouTube API Quota Exceeded"

**Error**:
```
quotaExceeded: The request cannot be completed because you have exceeded your quota
```

**Solutions**:

1. **Check quota usage**:
   - Go to Google Cloud Console
   - APIs & Services → Dashboard
   - Click "YouTube Data API v3"
   - View quota usage

2. **Default quota**: 10,000 units/day
   - Posting 1 reply = 50 units
   - Max ~200 replies/day

3. **Request quota increase**:
   - Same page → "Quotas" tab
   - Click "APPLY FOR QUOTA INCREASE"

4. **Wait until midnight PST** (quota resets daily)

---

### "Instagram API Not Working"

**Error**:
```
OAuthException: (#100) Tried accessing nonexisting field
```

**Common Causes**:

1. **Account not Business/Creator**:
   - Instagram must be Business or Creator account
   - Must be connected to Facebook Page

2. **App not in Live Mode**:
   - For demo, use Test Mode
   - Add your Instagram account as test user

3. **Missing permissions**:
   - Check scopes: `instagram_basic`, `instagram_manage_comments`

---

### "Gemini API Error"

**Error**:
```
API key not valid
```

**Solutions**:

1. **Verify API key**:
```bash
   # Test with curl
   curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_KEY" \
     -H 'Content-Type: application/json' \
     -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

2. **Check `.env.local`**:
```bash
   GEMINI_API_KEY="AIzaSy..."
```

3. **Enable billing** (if exceeded free tier):
   - Go to AI Studio → Billing
   - Free tier: 60 requests/min, 1500 requests/day

---

## 4️⃣ Airflow Issues

### "Airflow Webserver Not Starting"

**Error**:
```
webserver exited with code 1
```

**Solutions**:

1. **Check Docker is running**:
```bash
   docker ps
```

2. **Check port 8080 is free**:
```bash
   lsof -i :8080
   # If something is using it:
   kill -9 <PID>
```

3. **Restart Airflow**:
```bash
   docker-compose down
   docker-compose up -d
```

4. **Check logs**:
```bash
   docker-compose logs airflow-webserver
```

---

### "DAG Not Showing in Airflow UI"

**Problem**: Created DAG file but not appearing in UI

**Solutions**:

1. **Check for Python syntax errors**:
```bash
   python airflow/dags/your_dag.py
```

2. **Verify file is in correct location**:
```bash
   ls airflow/dags/
   # Should see your_dag.py
```

3. **Restart Airflow scheduler**:
```bash
   docker-compose restart airflow-scheduler
```

4. **Wait 30 seconds** (DAG refresh interval)

5. **Check Airflow logs**:
```bash
   docker-compose logs airflow-scheduler | grep ERROR
```

---

### "Task Failing in Airflow"

**Error**: Task marked as failed in Airflow UI

**Solutions**:

1. **View task logs**:
   - Airflow UI → Click DAG → Click failed task → "Log" button

2. **Test task locally**:
```bash
   docker-compose exec airflow-scheduler bash
   airflow tasks test your_dag your_task 2025-03-16
```

3. **Check environment variables** are passed to Airflow:
```yaml
   # docker-compose.yml
   airflow-scheduler:
     volumes:
       - ./.env.local:/opt/airflow/.env
```

4. **Verify database connections** work from Airflow:
```bash
   docker-compose exec airflow-scheduler python3 -c "
   import os
   print(os.getenv('DATABASE_URL'))
   "
```

---

## 5️⃣ Development Server Issues

### "Port 3000 Already in Use"

**Error**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions**:

1. **Kill process on port 3000**:
```bash
   # Mac/Linux
   lsof -ti:3000 | xargs kill -9

   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
```

2. **Use different port**:
```bash
   PORT=3001 npm run dev
```

---

### "Module Not Found"

**Error**:
```
Module not found: Can't resolve '@/lib/...'
```

**Solutions**:

1. **Install dependencies**:
```bash
   npm install
```

2. **Check tsconfig.json** has path aliases:
```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./*"]
       }
     }
   }
```

3. **Restart dev server**:
```bash
   # Ctrl+C to stop
   npm run dev
```

---

## 6️⃣ Frontend Issues

### "Hydration Error"

**Error**:
```
Text content does not match server-rendered HTML
```

**Solutions**:

1. **Check for client-only code** in server components:
```typescript
   // Wrong
   export default function Page() {
     const data = localStorage.getItem('key'); // Error!
   }

   // Correct
   'use client'
   export default function Page() {
     const [data, setData] = useState(null);
     useEffect(() => {
       setData(localStorage.getItem('key'));
     }, []);
   }
```

2. **Clear Next.js cache**:
```bash
   rm -rf .next
   npm run dev
```

---

### "API Route Returns 404"

**Problem**: `/api/something` returns 404

**Solutions**:

1. **Verify file structure**:
```
   app/api/something/route.ts  ✅ Correct
   app/api/something.ts        ❌ Wrong
```

2. **Check export**:
```typescript
   // Must export GET, POST, etc.
   export async function GET(req: Request) {
     return Response.json({ ok: true });
   }
```

3. **Restart dev server**

---

## 7️⃣ General Tips

### "Something Broke and I Don't Know Why"

**Nuclear Option** (fresh start):
```bash
# 1. Delete everything generated
rm -rf node_modules
rm -rf .next
rm package-lock.json

# 2. Reinstall
npm install

# 3. Regenerate Prisma
npx prisma generate
npx prisma db push

# 4. Restart
npm run dev
```

---

### Enable Debug Logging

**For Next.js**:
```bash
NODE_OPTIONS='--inspect' npm run dev
```

**For Prisma**:
```bash
DEBUG=* npx prisma db push
```

**For Airflow**:
```bash
# docker-compose.yml
environment:
  - AIRFLOW__LOGGING__LOGGING_LEVEL=DEBUG
```

---

### Check System Requirements
```bash
# Node.js version (need 18+)
node --version

# npm version
npm --version

# Docker version
docker --version

# Check memory (Airflow needs 4GB+)
docker info | grep "Total Memory"
```

---

## 🆘 Still Stuck?

1. **Check logs**:
   - Next.js: Terminal where `npm run dev` is running
   - Airflow: `docker-compose logs -f`
   - Prisma: `npx prisma studio` (test DB connection)

2. **Read error messages carefully**:
   - First line usually has the actual error
   - Stack trace shows where it happened

3. **Google the exact error**:
   - Copy/paste error message
   - Add "Next.js 14" or "Prisma" to search

4. **Check documentation**:
   - Next.js: https://nextjs.org/docs
   - Prisma: https://www.prisma.io/docs
   - Airflow: https://airflow.apache.org/docs

---

**Last Updated**: 2025-03-16
**Common Solutions Hit Rate**: 90%+
