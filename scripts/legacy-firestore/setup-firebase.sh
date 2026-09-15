#!/bin/bash
set -e

echo "🔧 Setting up Firebase for deployment..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "📦 Installing Firebase CLI..."
    npm install -g firebase-tools
fi

# Login to Firebase
echo "🔐 Logging into Firebase..."
firebase login

# Initialize Firebase (if not already done)
if [ ! -f ".firebaserc" ] || grep -q "your-firebase-project-id" .firebaserc; then
    echo "⚙️ Initializing Firebase project..."
    firebase init firestore
    firebase init hosting
fi

# Check if service account file exists
if [ ! -f "firebase-service-account.json" ]; then
    echo "⚠️  Service account file not found!"
    echo "📥 Please download it from:"
    echo "   Firebase Console → Project Settings → Service Accounts → Generate new private key"
    echo "   Save it as: firebase-service-account.json"
    exit 1
fi

echo "✅ Firebase setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .firebaserc with your project ID"
echo "2. Create .env.production with your environment variables"
echo "3. Run: ./scripts/deploy-firebase.sh"

