# ✅ Firebase Deployment Setup Complete!

All Firebase deployment files have been created and configured.

## 📁 Files Created

### Configuration Files
- ✅ `firebase.json` - Firebase Hosting configuration
- ✅ `.firebaserc` - Firebase project configuration (update with your project ID)
- ✅ `firebase-hosting.json` - Cloud Run integration config
- ✅ `Dockerfile` - Docker configuration for Cloud Run
- ✅ `.dockerignore` - Docker ignore patterns
- ✅ `cloudbuild.yaml` - Google Cloud Build configuration
- ✅ `next.config.js` - Updated with standalone output

### Documentation
- ✅ `DEPLOYMENT.md` - Complete deployment guide
- ✅ `QUICK_DEPLOY.md` - Quick start guide
- ✅ `README_DEPLOYMENT.md` - Quick reference
- ✅ `.env.example` - Environment variables template

### Scripts & Automation
- ✅ `scripts/deploy.sh` - Automated deployment script
- ✅ `.github/workflows/firebase-deploy.yml` - CI/CD workflow

## 🚀 Next Steps

### 1. Install Required Tools

```bash
npm install -g firebase-tools
# Install Google Cloud SDK from: https://cloud.google.com/sdk/docs/install
```

### 2. Login to Services

```bash
firebase login
gcloud auth login
```

### 3. Initialize Firebase

```bash
firebase init
# Select: Hosting
# Choose or create project
```

### 4. Update Project ID

Edit `.firebaserc`:
```json
{
  "projects": {
    "default": "your-actual-firebase-project-id"
  }
}
```

### 5. Set Up Database

**Recommended: Supabase (Free tier)**
1. Sign up: https://supabase.com
2. Create project
3. Copy PostgreSQL connection string

### 6. Configure Environment

Create `.env.production`:
```env
DATABASE_URL="postgresql://user:pass@host:5432/db"
NEXTAUTH_URL="https://your-project.web.app"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
OPENAI_API_KEY="your-key-if-using-ai"
```

### 7. Deploy!

**Option A: Use Deployment Script**
```bash
# On Linux/Mac:
./scripts/deploy.sh

# On Windows (Git Bash):
bash scripts/deploy.sh
```

**Option B: Manual Deployment**
```bash
# 1. Build
npm ci
npx prisma generate
npm run build

# 2. Build & Push Docker
docker build -t gcr.io/YOUR_PROJECT_ID/ecclesia-app .
docker push gcr.io/YOUR_PROJECT_ID/ecclesia-app

# 3. Deploy Cloud Run
gcloud run deploy ecclesia-app \
  --image gcr.io/YOUR_PROJECT_ID/ecclesia-app \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --set-env-vars DATABASE_URL="your-db-url",NEXTAUTH_SECRET="secret",NEXTAUTH_URL="https://your-project.web.app"

# 4. Deploy Hosting
firebase deploy --only hosting
```

## 📋 Deployment Architecture

```
┌─────────────────┐
│  Firebase       │
│  Hosting        │ ──── Serves static assets
└────────┬────────┘
         │
         │ Rewrites API calls
         ▼
┌─────────────────┐
│  Cloud Run      │ ──── Runs Next.js server
│  (Next.js App)  │      Handles API routes
└────────┬────────┘
         │
         │ Connects to
         ▼
┌─────────────────┐
│  PostgreSQL     │ ──── Database (Supabase/Cloud SQL)
│  Database       │
└─────────────────┘
```

## 🔐 Required Secrets (for CI/CD)

If using GitHub Actions, add these repository secrets:

1. `FIREBASE_PROJECT_ID` - Your Firebase project ID
2. `GCP_PROJECT_ID` - Your Google Cloud project ID
3. `GCP_SA_KEY` - Google Cloud Service Account JSON key
4. `FIREBASE_SERVICE_ACCOUNT` - Firebase Service Account JSON
5. `DATABASE_URL` - PostgreSQL connection string
6. `NEXTAUTH_SECRET` - NextAuth secret (generate with `openssl rand -base64 32`)
7. `NEXTAUTH_URL` - Your app URL (e.g., `https://your-project.web.app`)
8. `OPENAI_API_KEY` - (Optional) OpenAI API key

## ✅ Post-Deployment Checklist

- [ ] Run database migrations: `npx prisma migrate deploy`
- [ ] Verify app loads at Firebase Hosting URL
- [ ] Test authentication flow
- [ ] Check Cloud Run logs for errors
- [ ] Verify API routes work
- [ ] Test database connections
- [ ] Set up custom domain (optional)
- [ ] Configure monitoring and alerts

## 🐛 Troubleshooting

### Build Issues
- Ensure Node.js 18+ is installed
- Run `npm ci` for clean install
- Generate Prisma client: `npx prisma generate`

### Deployment Issues
- Check Firebase project ID is correct
- Verify Google Cloud project is linked
- Ensure billing is enabled on GCP project
- Check Cloud Run API is enabled

### Runtime Issues
- Review Cloud Run logs: `gcloud run services logs read ecclesia-app`
- Verify environment variables are set
- Check database connection string
- Ensure DATABASE_URL includes SSL if required

## 📚 Documentation

- **Full Guide**: `DEPLOYMENT.md`
- **Quick Start**: `QUICK_DEPLOY.md`
- **Quick Reference**: `README_DEPLOYMENT.md`

## 💡 Tips

1. **Start with Supabase** - Free tier PostgreSQL, easy setup
2. **Use Cloud Run** - Preserves all Next.js features
3. **Monitor Costs** - Set up billing alerts
4. **Enable Logging** - Check Cloud Run logs regularly
5. **Test Locally** - Use Docker to test production build

## 🎉 You're Ready!

All configuration files are in place. Follow the steps above to deploy your app to Firebase!

For detailed instructions, see `DEPLOYMENT.md` or `QUICK_DEPLOY.md`.

