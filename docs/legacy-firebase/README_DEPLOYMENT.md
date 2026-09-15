# Firebase Deployment - Quick Start

## 🚀 Quick Deploy (5 minutes)

### 1. Install Tools

```bash
npm install -g firebase-tools
# Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install
```

### 2. Login

```bash
firebase login
gcloud auth login
```

### 3. Initialize Project

```bash
firebase init
# Select: Hosting
# Choose existing project or create new
```

### 4. Update Configuration

Edit `.firebaserc`:
```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

### 5. Set Up Database

**Recommended: Supabase (Free)**
1. Go to https://supabase.com
2. Create project
3. Copy connection string

### 6. Create Environment File

Create `.env.production`:
```env
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="https://your-project.web.app"
NEXTAUTH_SECRET="generate-secret"
```

### 7. Deploy

**Option A: Using Script (Easiest)**
```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

**Option B: Manual Steps**
```bash
# Build
npm ci && npm run build

# Build & Push Docker
docker build -t gcr.io/YOUR_PROJECT/ecclesia-app .
docker push gcr.io/YOUR_PROJECT/ecclesia-app

# Deploy Cloud Run
gcloud run deploy ecclesia-app \
  --image gcr.io/YOUR_PROJECT/ecclesia-app \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000

# Deploy Hosting
firebase deploy --only hosting
```

## 📚 Full Documentation

- **Detailed Guide**: See `DEPLOYMENT.md`
- **Quick Reference**: See `QUICK_DEPLOY.md`

## 🔧 Required Secrets (for CI/CD)

If using GitHub Actions, add these secrets:

- `FIREBASE_PROJECT_ID` - Your Firebase project ID
- `GCP_PROJECT_ID` - Your GCP project ID  
- `GCP_SA_KEY` - Google Cloud Service Account JSON
- `FIREBASE_SERVICE_ACCOUNT` - Firebase Service Account JSON
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - NextAuth secret key
- `NEXTAUTH_URL` - Your app URL
- `OPENAI_API_KEY` - (Optional) OpenAI API key

## ✅ Post-Deployment Checklist

- [ ] Run database migrations: `npx prisma migrate deploy`
- [ ] Verify app is accessible
- [ ] Test authentication
- [ ] Check Cloud Run logs
- [ ] Set up custom domain (optional)
- [ ] Configure monitoring

## 🆘 Troubleshooting

**Build fails?**
- Check Node.js version (18+)
- Run `npm ci` for clean install
- Verify Prisma client: `npx prisma generate`

**API routes not working?**
- Ensure Cloud Run is deployed
- Check environment variables
- Review Cloud Run logs

**Database errors?**
- Verify DATABASE_URL
- Check firewall rules
- Ensure SSL is enabled

## 💰 Cost Estimate

- **Firebase Hosting**: Free tier available
- **Cloud Run**: ~$0.10-0.50/month (low traffic)
- **Database**: Free tier (Supabase/Neon) or ~$25/month (Cloud SQL)

## 📞 Support

For detailed deployment help, see:
- `DEPLOYMENT.md` - Complete guide
- `QUICK_DEPLOY.md` - Step-by-step instructions

