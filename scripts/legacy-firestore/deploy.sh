#!/bin/bash

# Firebase Deployment Script
# Usage: ./scripts/deploy.sh

set -e

echo "🚀 Starting Firebase Deployment..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Install with: npm install -g firebase-tools"
    exit 1
fi

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud SDK not found. Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get project ID from .firebaserc
PROJECT_ID=$(grep -o '"default": "[^"]*"' .firebaserc | cut -d'"' -f4)

if [ "$PROJECT_ID" = "your-firebase-project-id" ]; then
    echo "❌ Please update .firebaserc with your Firebase project ID"
    exit 1
fi

echo "📦 Project ID: $PROJECT_ID"

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "⚠️  Warning: .env.production not found. Creating from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env.production
        echo "📝 Please update .env.production with your production values"
        exit 1
    fi
fi

# Build the application
echo "🔨 Building application..."
npm ci
npx prisma generate
npm run build

# Build Docker image
echo "🐳 Building Docker image..."
docker build -t gcr.io/$PROJECT_ID/ecclesia-app:latest .

# Push to Container Registry
echo "📤 Pushing to Container Registry..."
docker push gcr.io/$PROJECT_ID/ecclesia-app:latest

# Deploy to Cloud Run
echo "☁️  Deploying to Cloud Run..."
gcloud run deploy ecclesia-app \
  --image gcr.io/$PROJECT_ID/ecclesia-app:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --min-instances 0 \
  --timeout 300 \
  --set-env-vars NODE_ENV=production

# Get Cloud Run URL
SERVICE_URL=$(gcloud run services describe ecclesia-app --region us-central1 --format 'value(status.url)')
echo "✅ Cloud Run deployed at: $SERVICE_URL"

# Deploy Firebase Hosting
echo "🔥 Deploying Firebase Hosting..."
firebase deploy --only hosting

echo "✅ Deployment complete!"
echo "🌐 App URL: https://$PROJECT_ID.web.app"
echo "☁️  Cloud Run: $SERVICE_URL"

