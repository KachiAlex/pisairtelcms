# Firebase Deployment Guide - Firestore Edition

This guide will help you deploy the Ecclesia Church App to Firebase with Firestore.

## Prerequisites Checklist

Before deploying, ensure you have:

- [ ] Firebase account created
- [ ] Firebase project created in Firebase Console
- [ ] Firebase CLI installed (`npm install -g firebase-tools`)
- [ ] Google Cloud account (same as Firebase account)
- [ ] Node.js 18+ installed
- [ ] Git repository (optional, for CI/CD)

## Step 1: Firebase Project Setup

### 1.1 Login to Firebase CLI

```bash
firebase login
```

This will open a browser window for authentication.

### 1.2 Initialize Firebase Project

```bash
firebase init
```

Select:
- ✅ **Firestore**: Database rules and indexes
- ✅ **Hosting**: Web hosting
- ✅ **Functions**: (Optional, for future serverless functions)

### 1.3 Get Your Firebase Project ID

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (or create a new one)
3. Click on Project Settings (gear icon)
4. Copy the **Project ID**

### 1.4 Update `.firebaserc`

Replace `your-firebase-project-id` with your actual project ID:

```json
{
  "projects": {
    "default": "YOUR_PROJECT_ID_HERE"
  }
}
```

## Step 2: Firestore Database Setup

### 2.1 Enable Firestore

1. Go to Firebase Console → Firestore Database
2. Click "Create database"
3. Choose:
   - **Production mode** (for security rules)
   - **Region**: Choose closest to your users (e.g., `us-central1`)
4. Click "Enable"

### 2.2 Create Firestore Service Account

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. **Save this file securely** - you'll need it for deployment

### 2.3 Set Firestore Security Rules

Create/update `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Churches - authenticated users can read, admins can write
    match /churches/{churchId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['ADMIN', 'SUPER_ADMIN', 'PASTOR'];
    }
    
    // Public read, authenticated write for most collections
    match /{collection}/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

Deploy rules:
```bash
firebase deploy --only firestore:rules
```

### 2.4 Create Firestore Indexes

Create `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "churchId", "order": "ASCENDING" },
        { "fieldPath": "role", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "posts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "churchId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "churchId", "order": "ASCENDING" },
        { "fieldPath": "startDate", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Deploy indexes:
```bash
firebase deploy --only firestore:indexes
```

## Step 3: Environment Variables Setup

### 3.1 Create `.env.production` file

Create `.env.production` in the root directory:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
FIREBASE_ADMIN_PROJECT_ID=YOUR_PROJECT_ID

# NextAuth Configuration
NEXTAUTH_URL=https://YOUR_PROJECT_ID.web.app
NEXTAUTH_SECRET=generate-a-random-secret-key-here-min-32-chars

# Firebase Admin SDK (Service Account)
# Path to service account JSON file (for local development)
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# For production, use environment variable instead:
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# OpenAI (if using AI features)
OPENAI_API_KEY=your-openai-api-key-here

# Node Environment
NODE_ENV=production

# Optional: Other API keys
GOOGLE_DRIVE_CLIENT_ID=your-google-drive-client-id
GOOGLE_DRIVE_CLIENT_SECRET=your-google-drive-client-secret
```

### 3.2 Generate NextAuth Secret

```bash
openssl rand -base64 32
```

Or use an online generator: https://generate-secret.vercel.app/32

### 3.3 Save Service Account File

1. Copy the downloaded service account JSON file
2. Save it as `firebase-service-account.json` in the project root
3. **Add to `.gitignore`** (already should be there)

## Step 4: Update Configuration Files

### 4.1 Update `firebase.json`

The file should look like this:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "public": "out",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### 4.2 Update `next.config.js`

Ensure it has:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // For Cloud Run deployment
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    serverActions: true,
  },
}

module.exports = nextConfig
```

### 4.3 Update `Dockerfile`

Since we're using Firestore, remove Prisma references:

```dockerfile
# Use the official Node.js runtime as base image
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

## Step 5: Deployment Options

### Option A: Firebase Hosting + Cloud Run (Recommended)

This preserves all Next.js features including API routes.

#### 5.1 Install Google Cloud SDK

```bash
# Windows (PowerShell)
(New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:Temp\GoogleCloudSDKInstaller.exe")
& $env:Temp\GoogleCloudSDKInstaller.exe

# Mac/Linux
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

#### 5.2 Authenticate with Google Cloud

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

#### 5.3 Enable Required APIs

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

#### 5.4 Build and Deploy with Cloud Build

Create `cloudbuild.yaml`:

```yaml
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/ecclesia-app', '.']
  
  # Push the container image to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/ecclesia-app']
  
  # Deploy container image to Cloud Run
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'ecclesia-app'
      - '--image'
      - 'gcr.io/$PROJECT_ID/ecclesia-app'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--port'
      - '3000'
      - '--memory'
      - '1Gi'
      - '--set-env-vars'
      - 'NODE_ENV=production,NEXT_PUBLIC_FIREBASE_PROJECT_ID=$PROJECT_ID'
      - '--set-secrets'
      - 'NEXTAUTH_SECRET=nextauth-secret:latest,OPENAI_API_KEY=openai-key:latest'

images:
  - 'gcr.io/$PROJECT_ID/ecclesia-app'
```

#### 5.5 Set Up Secrets in Secret Manager

```bash
# Create secrets
echo -n "your-nextauth-secret" | gcloud secrets create nextauth-secret --data-file=-
echo -n "your-openai-api-key" | gcloud secrets create openai-key --data-file=-

# Grant Cloud Run access
gcloud secrets add-iam-policy-binding nextauth-secret \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding openai-key \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

#### 5.6 Submit Build

```bash
gcloud builds submit --config cloudbuild.yaml
```

#### 5.7 Configure Firebase Hosting to Use Cloud Run

Create `firebase-hosting.json`:

```json
{
  "hosting": {
    "public": "out",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "run": {
          "serviceId": "ecclesia-app",
          "region": "us-central1"
        }
      }
    ]
  }
}
```

#### 5.8 Deploy Hosting

```bash
firebase deploy --only hosting
```

### Option B: Simplified Deployment (Firebase Hosting Only)

If you want a simpler setup without Cloud Run (but you'll lose API routes):

1. Update `next.config.js`:
```javascript
output: 'export', // Static export
```

2. Build:
```bash
npm run build
```

3. Deploy:
```bash
firebase deploy --only hosting
```

**Note**: This won't work with API routes, authentication, or database features.

## Step 6: Post-Deployment

### 6.1 Verify Deployment

1. Check Firebase Console → Hosting
2. Visit your app URL: `https://YOUR_PROJECT_ID.web.app`
3. Test authentication
4. Test API routes

### 6.2 Set Up Custom Domain (Optional)

1. Go to Firebase Console → Hosting
2. Click "Add custom domain"
3. Follow verification steps
4. Update DNS records as instructed

### 6.3 Monitor Logs

```bash
# Cloud Run logs
gcloud run services logs read ecclesia-app --region us-central1

# Firebase logs
firebase functions:log
```

## Step 7: Environment Variables in Cloud Run

If you need to update environment variables after deployment:

```bash
gcloud run services update ecclesia-app \
  --region us-central1 \
  --update-env-vars NEXTAUTH_URL=https://your-domain.com
```

## Troubleshooting

### Build Fails
- Check Node.js version (should be 18+)
- Ensure all dependencies are installed
- Check for missing environment variables

### Firestore Connection Issues
- Verify service account JSON is correct
- Check `GOOGLE_APPLICATION_CREDENTIALS` is set
- Ensure Firestore is enabled in Firebase Console

### API Routes Not Working
- Ensure you're using Cloud Run, not static export
- Check Cloud Run service is running
- Verify environment variables are set

### Authentication Issues
- Verify `NEXTAUTH_URL` matches your domain
- Check `NEXTAUTH_SECRET` is set
- Ensure callback URLs are configured

## Cost Estimation

- **Firebase Hosting**: Free tier (10GB storage, 360MB/day transfer)
- **Firestore**: Free tier (1GB storage, 50K reads/day, 20K writes/day)
- **Cloud Run**: Pay per use (~$0.00002400 per vCPU-second)
- **Cloud Build**: 120 build-minutes/day free

## Next Steps

1. Set up monitoring and alerts
2. Configure Firestore backup strategy
3. Set up CI/CD pipeline
4. Configure custom domain
5. Set up SSL certificates (automatic with Firebase)

## Quick Deploy Script

Save this as `deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Build and deploy to Cloud Run
echo "📦 Building and deploying to Cloud Run..."
gcloud builds submit --config cloudbuild.yaml

# Deploy Firestore rules and indexes
echo "🔥 Deploying Firestore rules..."
firebase deploy --only firestore:rules,firestore:indexes

# Deploy Firebase Hosting
echo "🌐 Deploying Firebase Hosting..."
firebase deploy --only hosting

echo "✅ Deployment complete!"
echo "🌍 Your app is live at: https://YOUR_PROJECT_ID.web.app"
```

Make it executable:
```bash
chmod +x deploy.sh
```

Run:
```bash
./deploy.sh
```

