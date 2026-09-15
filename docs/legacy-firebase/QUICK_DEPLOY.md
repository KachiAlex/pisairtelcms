# Quick Deployment Guide - ecclesia-2025

## ✅ Already Done

- [x] Firebase Project ID configured: `ecclesia-2025`
- [x] `.firebaserc` updated
- [x] Firestore rules and indexes created
- [x] Dockerfile updated for Firestore
- [x] Cloud Build configuration ready

## 🚀 Next Steps

### Step 1: Install Required Tools

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Install Google Cloud SDK (if not already installed)
# Windows: Download from https://cloud.google.com/sdk/docs/install
# Mac: brew install google-cloud-sdk
# Linux: Follow instructions at https://cloud.google.com/sdk/docs/install
```

### Step 2: Login and Initialize

```bash
# Login to Firebase
firebase login

# Set your project
firebase use ecclesia-2025

# Initialize Firestore (if not done)
firebase init firestore
# Select: Use existing rules (firestore.rules)
# Select: Use existing indexes (firestore.indexes.json)
```

### Step 3: Download Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/project/ecclesia-2025)
2. Click ⚙️ **Project Settings** → **Service Accounts** tab
3. Click **"Generate new private key"**
4. Click **"Generate key"** in the popup
5. Save the downloaded JSON file as `firebase-service-account.json` in your project root

### Step 4: Enable Firestore

1. Go to [Firebase Console](https://console.firebase.google.com/project/ecclesia-2025)
2. Click **Firestore Database** in the left menu
3. Click **"Create database"**
4. Select **Production mode**
5. Choose region (e.g., `us-central1`)
6. Click **"Enable"**

### Step 5: Generate NextAuth Secret

```bash
# Generate a secure secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the output - you'll need it for Step 6.

### Step 6: Create Environment File

Copy `.env.production.example` to `.env.production` and update:

```bash
# Copy the example file
cp .env.production.example .env.production
```

Then edit `.env.production` and:
- Replace `REPLACE_WITH_GENERATED_SECRET_MIN_32_CHARS` with the secret from Step 5
- Add your OpenAI API key (if using AI features)

### Step 7: Set Up Google Cloud

```bash
# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project ecclesia-2025

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### Step 8: Create Secrets in Secret Manager

```bash
# Create NextAuth secret
echo -n "YOUR_NEXTAUTH_SECRET_HERE" | gcloud secrets create nextauth-secret --data-file=-

# Create OpenAI key secret (if using)
echo -n "YOUR_OPENAI_API_KEY" | gcloud secrets create openai-key --data-file=-

# Grant Cloud Run access to secrets
PROJECT_NUMBER=$(gcloud projects describe ecclesia-2025 --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding nextauth-secret \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding openai-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Step 9: Deploy Firestore Rules and Indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### Step 10: Build and Deploy

```bash
# Deploy to Cloud Run
gcloud builds submit --config cloudbuild.yaml

# Deploy Firebase Hosting
firebase deploy --only hosting
```

Or use the automated script:

```bash
# Make script executable (Linux/Mac)
chmod +x scripts/deploy-firebase.sh

# Run deployment
./scripts/deploy-firebase.sh
```

## 🎉 After Deployment

Your app will be available at:
- **Firebase Hosting**: https://ecclesia-2025.web.app
- **Cloud Run**: https://ecclesia-app-[hash]-uc.a.run.app

## 📊 Monitor Deployment

```bash
# View Cloud Run logs
gcloud run services logs read ecclesia-app --region us-central1 --project ecclesia-2025

# View build logs
gcloud builds list --project ecclesia-2025

# Check service status
gcloud run services describe ecclesia-app --region us-central1 --project ecclesia-2025
```

## 🔧 Troubleshooting

### Build Fails
- Check that all dependencies are installed: `npm ci`
- Verify Dockerfile is correct
- Check Cloud Build logs for specific errors

### Firestore Connection Issues
- Verify Firestore is enabled in Firebase Console
- Check service account JSON file exists and is valid
- Ensure environment variables are set correctly

### Authentication Issues
- Verify `NEXTAUTH_URL` matches your domain
- Check `NEXTAUTH_SECRET` is set correctly
- Ensure secrets are accessible in Cloud Run

## 📝 Quick Commands Reference

```bash
# Deploy everything
firebase deploy --only firestore:rules,firestore:indexes,hosting
gcloud builds submit --config cloudbuild.yaml

# Update environment variables
gcloud run services update ecclesia-app \
  --region us-central1 \
  --update-env-vars NEXTAUTH_URL=https://ecclesia-2025.web.app

# View logs
gcloud run services logs read ecclesia-app --region us-central1 --follow
```
