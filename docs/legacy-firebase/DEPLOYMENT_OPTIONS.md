# Deployment Options Without Billing Account

Since your billing cards have reached their project limit, here are alternative deployment options:

## Option 1: Vercel (Recommended - FREE)

**Pros:**
- ✅ Free tier available (no billing required)
- ✅ Perfect for Next.js apps
- ✅ API routes work out of the box
- ✅ Automatic deployments from Git
- ✅ Built-in environment variables
- ✅ Free SSL certificates

**Setup Steps:**

1. **Sign up at [Vercel](https://vercel.com)** (free account)

2. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

3. **Login:**
   ```bash
   vercel login
   ```

4. **Deploy:**
   ```bash
   vercel --prod
   ```

5. **Set Environment Variables:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add all variables from `.env.production`

**Firestore Setup:**
- Download service account JSON from Firebase Console
- Convert to environment variable or use Vercel's file storage
- Update `lib/firestore.ts` to use environment variable for service account

## Option 2: Railway (FREE Tier Available)

**Pros:**
- ✅ Free tier ($5 credit/month)
- ✅ Supports Docker/Next.js
- ✅ Easy environment variable setup
- ✅ Automatic deployments

**Setup:**
1. Sign up at [Railway.app](https://railway.app)
2. Connect GitHub repository
3. Railway auto-detects Next.js and deploys
4. Add environment variables in Railway dashboard

## Option 3: Render (FREE Tier Available)

**Pros:**
- ✅ Free tier available
- ✅ Supports Next.js
- ✅ Automatic SSL
- ✅ Easy setup

**Setup:**
1. Sign up at [Render.com](https://render.com)
2. Create new Web Service
3. Connect GitHub repository
4. Render auto-detects and deploys Next.js

## Option 4: Firebase Hosting Only (Limited)

**Note:** This won't work for API routes, but you can deploy the frontend.

**Limitations:**
- ❌ API routes won't work
- ❌ Server-side features disabled
- ✅ Frontend will work
- ✅ No billing required

## Option 5: Use Different Billing Account

If you have access to another billing account:

1. **Create new billing account** in Google Cloud Console
2. **Link to Firebase project:**
   - Go to Firebase Console → Project Settings → Usage and billing
   - Click "Change billing account"
   - Select or create new billing account

## Recommended: Vercel

For a Next.js app with Firestore, **Vercel is the best option** because:
- No billing required
- Native Next.js support
- API routes work perfectly
- Easy Firestore integration
- Free SSL and CDN

Would you like me to help you set up Vercel deployment?

