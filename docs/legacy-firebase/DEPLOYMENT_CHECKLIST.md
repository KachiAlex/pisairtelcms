# Firebase Deployment Checklist

Use this checklist to ensure everything is set up correctly before deploying.

## Pre-Deployment

- [ ] Firebase account created and logged in
- [ ] Firebase project created in Firebase Console
- [ ] Firebase CLI installed (`npm install -g firebase-tools`)
- [ ] Logged into Firebase CLI (`firebase login`)
- [ ] Google Cloud account linked to Firebase project
- [ ] Google Cloud SDK installed and authenticated

## Firebase Project Setup

- [ ] Project ID copied from Firebase Console
- [ ] `.firebaserc` updated with correct project ID
- [ ] Firestore database created and enabled
- [ ] Firestore region selected (e.g., `us-central1`)
- [ ] Service account JSON file downloaded
- [ ] Service account file saved as `firebase-service-account.json`
- [ ] Service account file added to `.gitignore`

## Configuration Files

- [ ] `firebase.json` configured correctly
- [ ] `firestore.rules` created/updated
- [ ] `firestore.indexes.json` created/updated
- [ ] `next.config.js` has `output: 'standalone'`
- [ ] `Dockerfile` updated (Prisma references removed)
- [ ] `cloudbuild.yaml` created/updated
- [ ] `.env.production` created with all required variables

## Environment Variables

- [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID` set
- [ ] `FIREBASE_ADMIN_PROJECT_ID` set
- [ ] `NEXTAUTH_URL` set to production URL
- [ ] `NEXTAUTH_SECRET` generated (32+ characters)
- [ ] `OPENAI_API_KEY` set (if using AI features)
- [ ] `FIREBASE_SERVICE_ACCOUNT_PATH` set (for local)
- [ ] `NODE_ENV=production` set

## Google Cloud Setup

- [ ] Cloud Build API enabled
- [ ] Cloud Run API enabled
- [ ] Container Registry API enabled
- [ ] Project ID configured in gcloud (`gcloud config set project`)
- [ ] Secrets created in Secret Manager (if using)
- [ ] IAM permissions granted for secrets

## Firestore Setup

- [ ] Security rules deployed (`firebase deploy --only firestore:rules`)
- [ ] Indexes deployed (`firebase deploy --only firestore:indexes`)
- [ ] Test data structure verified
- [ ] Collection names match `lib/firestore-collections.ts`

## Build & Deploy

- [ ] Dependencies installed (`npm ci`)
- [ ] Build succeeds locally (`npm run build`)
- [ ] Docker build succeeds (`docker build -t test .`)
- [ ] Cloud Build succeeds (`gcloud builds submit --config cloudbuild.yaml`)
- [ ] Cloud Run service deployed and running
- [ ] Firebase Hosting deployed (`firebase deploy --only hosting`)

## Post-Deployment Verification

- [ ] App loads at Firebase Hosting URL
- [ ] Authentication works (sign up/login)
- [ ] API routes respond correctly
- [ ] Firestore reads/writes work
- [ ] Images load correctly
- [ ] No console errors in browser
- [ ] Cloud Run logs show no errors

## Security

- [ ] Service account JSON not committed to Git
- [ ] Environment variables not in code
- [ ] Firestore rules restrict access appropriately
- [ ] NextAuth secret is strong and unique
- [ ] API keys stored securely

## Monitoring

- [ ] Cloud Run logs accessible
- [ ] Firebase Console shows activity
- [ ] Error tracking set up (optional)
- [ ] Performance monitoring enabled (optional)

## Documentation

- [ ] Deployment process documented
- [ ] Environment variables documented
- [ ] Troubleshooting guide available
- [ ] Team members have access to Firebase Console

## Rollback Plan

- [ ] Previous version can be restored
- [ ] Database backup strategy in place
- [ ] Rollback procedure documented

---

## Quick Test Commands

```bash
# Test Firebase connection
firebase projects:list

# Test Firestore
firebase firestore:indexes

# Test build locally
npm run build

# Test Docker build
docker build -t test .

# Check Cloud Run status
gcloud run services list

# View logs
gcloud run services logs read ecclesia-app --region us-central1
```

---

**Ready to deploy?** Run:
```bash
./deploy.sh
```

Or manually:
```bash
gcloud builds submit --config cloudbuild.yaml
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

