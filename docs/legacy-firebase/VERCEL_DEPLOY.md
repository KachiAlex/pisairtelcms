# Deploy to Vercel (No Billing Required)

## Quick Setup

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Prepare Environment Variables

Create a `.env.production` file (or we'll set them in Vercel dashboard):

```env
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ecclesia-2025
FIREBASE_ADMIN_PROJECT_ID=ecclesia-2025
FIREBASE_PROJECT_ID=ecclesia-2025
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=your-secret-here
OPENAI_API_KEY=your-openai-key
NODE_ENV=production
```

### Step 4: Download Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/project/ecclesia-2025/settings/serviceaccounts/adminsdk)
2. Click "Generate new private key"
3. Save the JSON file
4. **Convert to environment variable** (see Step 5)

### Step 5: Convert Service Account to Environment Variable

You have two options:

**Option A: Use as JSON string in environment variable**
```bash
# Convert JSON file to single line (remove newlines)
# Then set as FIREBASE_SERVICE_ACCOUNT in Vercel
```

**Option B: Update firestore.ts to read from file (for Vercel)**

We'll need to update the Firestore initialization to work with Vercel's file system.

### Step 6: Deploy

```bash
# First deployment (will ask questions)
vercel

# Production deployment
vercel --prod
```

### Step 7: Set Environment Variables in Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to Settings → Environment Variables
4. Add all variables from `.env.production`
5. For `FIREBASE_SERVICE_ACCOUNT`, paste the entire JSON as a single-line string

## After Deployment

Your app will be available at:
- **Preview URLs**: `https://ecclesia-*.vercel.app`
- **Production URL**: `https://ecclesia-2025.vercel.app` (or custom domain)

## Advantages of Vercel

- ✅ **Free tier** - No billing required
- ✅ **Perfect Next.js support** - Built by Vercel
- ✅ **API routes work** - Full server-side support
- ✅ **Automatic deployments** - From Git
- ✅ **Free SSL** - Automatic HTTPS
- ✅ **Global CDN** - Fast worldwide
- ✅ **Environment variables** - Easy management
- ✅ **Preview deployments** - For every PR

## Next Steps

1. Install Vercel CLI: `npm install -g vercel`
2. Login: `vercel login`
3. Download service account from Firebase
4. Let me know when ready, and I'll help you deploy!

