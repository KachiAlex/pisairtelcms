# Firebase Deployment Guide

This guide will help you deploy the Ecclesia Church App to Firebase.

## Prerequisites

1. **Firebase Account**: Sign up at [firebase.google.com](https://firebase.google.com)
2. **Google Cloud Account**: Required for Cloud Run
3. **Firebase CLI**: Install globally
   ```bash
   npm install -g firebase-tools
   ```
4. **Google Cloud SDK**: Install [gcloud CLI](https://cloud.google.com/sdk/docs/install)

## Initial Setup

### 1. Login to Firebase

```bash
firebase login
```

### 2. Initialize Firebase Project

```bash
firebase init
```

Select:
- ✅ Hosting
- ✅ Functions (optional, for future use)

### 3. Update Firebase Project ID

Edit `.firebaserc` and replace `your-firebase-project-id` with your actual Firebase project ID.

## Database Setup

**Important**: This app uses PostgreSQL with Prisma.

### ✅ Recommended: Google Cloud SQL PostgreSQL

**Why Cloud SQL?**
- ✅ No connection/auth issues (unlike Supabase)
- ✅ Same database type - zero code changes
- ✅ Native Firebase/GCP integration
- ✅ Better reliability and performance
- ✅ Proper connection pooling

**Quick Setup:**
1. Create Cloud SQL PostgreSQL instance (see `CLOUD_SQL_SETUP.md`)
2. Configure connection string with SSL
3. Update `DATABASE_URL` in environment variables

**Alternative Options:**
- [Railway](https://railway.app) - Good alternative, free tier
- [Neon](https://neon.tech) - Serverless PostgreSQL, free tier
- [Supabase](https://supabase.com) - Free tier, but may have connection issues

## Environment Variables

Create a `.env.production` file with:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"

# NextAuth
NEXTAUTH_URL="https://your-app.firebaseapp.com"
NEXTAUTH_SECRET="your-secret-key-here"

# OpenAI (if using AI features)
OPENAI_API_KEY="your-openai-api-key"

# Other environment variables
NODE_ENV="production"
```

## Deployment Options

### Option A: Firebase Hosting + Cloud Run (Recommended)

This preserves all Next.js features including API routes.

#### 1. Build Docker Image

```bash
docker build -t gcr.io/YOUR_PROJECT_ID/ecclesia-app .
```

#### 2. Push to Container Registry

```bash
docker push gcr.io/YOUR_PROJECT_ID/ecclesia-app
```

#### 3. Deploy to Cloud Run

```bash
gcloud run deploy ecclesia-app \
  --image gcr.io/YOUR_PROJECT_ID/ecclesia-app \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --set-env-vars NODE_ENV=production
```

#### 4. Update Firebase Hosting

Edit `firebase-hosting.json` and update the `serviceId` to match your Cloud Run service name.

#### 5. Deploy Hosting

```bash
firebase deploy --only hosting
```

### Option B: Static Export (Simpler, but loses API routes)

If you don't need server-side features, you can use static export:

#### 1. Update next.config.js

```javascript
output: 'export',
```

#### 2. Build

```bash
npm run build
```

#### 3. Deploy

```bash
firebase deploy --only hosting
```

**Note**: This option won't work with API routes, authentication, or database features.

### Option C: Using Cloud Build (Automated)

#### 1. Enable Cloud Build API

```bash
gcloud services enable cloudbuild.googleapis.com
```

#### 2. Submit Build

```bash
gcloud builds submit --config cloudbuild.yaml
```

This will automatically:
- Build the Docker image
- Push to Container Registry
- Deploy to Cloud Run

## Post-Deployment

### 1. Run Database Migrations

```bash
npx prisma migrate deploy
```

Or if using a separate database service, run migrations there.

### 2. Seed Database (Optional)

```bash
npm run db:seed
```

### 3. Set Environment Variables in Cloud Run

```bash
gcloud run services update ecclesia-app \
  --region us-central1 \
  --set-env-vars DATABASE_URL="your-database-url",NEXTAUTH_SECRET="your-secret"
```

### 4. Configure Custom Domain (Optional)

1. Go to Firebase Console → Hosting
2. Click "Add custom domain"
3. Follow the verification steps

## Continuous Deployment

### GitHub Actions (Recommended)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Firebase

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          projectId: your-project-id
```

## Troubleshooting

### Build Fails

- Check Node.js version (should be 18+)
- Ensure all dependencies are installed
- Check Prisma client generation

### API Routes Not Working

- Ensure you're using Cloud Run, not static export
- Check Cloud Run service is running
- Verify environment variables are set

### Database Connection Issues

- Verify DATABASE_URL is correct
- Check database firewall allows Cloud Run IPs
- Ensure SSL is enabled if required

### Authentication Issues

- Verify NEXTAUTH_URL matches your domain
- Check NEXTAUTH_SECRET is set
- Ensure callback URLs are configured

## Cost Estimation

- **Firebase Hosting**: Free tier (10GB storage, 360MB/day transfer)
- **Cloud Run**: Pay per use (~$0.00002400 per vCPU-second)
- **Cloud SQL**: Starts at ~$25/month for smallest instance
- **Cloud Build**: 120 build-minutes/day free

## Support

For issues:
1. Check Firebase Console logs
2. Check Cloud Run logs: `gcloud run services logs read ecclesia-app`
3. Review deployment documentation

## Next Steps

1. Set up monitoring and alerts
2. Configure backup strategy for database
3. Set up CI/CD pipeline
4. Configure custom domain
5. Set up SSL certificates (automatic with Firebase)

