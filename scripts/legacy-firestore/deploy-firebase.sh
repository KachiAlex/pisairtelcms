#!/bin/bash
set -e

echo "🚀 Starting Firebase Deployment..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Install it with: npm install -g firebase-tools"
    exit 1
fi

# Check if gcloud CLI is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud SDK not found. Install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get project ID from .firebaserc
PROJECT_ID=$(node -p "require('./.firebaserc').projects.default")

if [ "$PROJECT_ID" == "your-firebase-project-id" ]; then
    echo "❌ Please update .firebaserc with your Firebase project ID"
    exit 1
fi

echo "📦 Project ID: $PROJECT_ID"

# Deploy Firestore rules and indexes
echo "🔥 Deploying Firestore rules and indexes..."
firebase deploy --only firestore:rules,firestore:indexes

# Build and deploy to Cloud Run
echo "🏗️ Building and deploying to Cloud Run..."
gcloud builds submit --config cloudbuild.yaml --project $PROJECT_ID

# Deploy Firebase Hosting
echo "🌐 Deploying Firebase Hosting..."
firebase deploy --only hosting

echo "✅ Deployment complete!"
echo "🌍 Your app is live at: https://$PROJECT_ID.web.app"
echo "📊 View logs: gcloud run services logs read ecclesia-app --region us-central1"

