#!/bin/bash
set -e

echo "🚀 Setting up Vercel deployment..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

# Login to Vercel
echo "🔐 Logging into Vercel..."
vercel login

# Link project (if not already linked)
if [ ! -f ".vercel/project.json" ]; then
    echo "🔗 Linking project to Vercel..."
    vercel link
fi

echo "✅ Vercel setup complete!"
echo ""
echo "Next steps:"
echo "1. Download service account from Firebase Console"
echo "2. Convert service account JSON to environment variable"
echo "3. Set environment variables in Vercel dashboard"
echo "4. Run: vercel --prod"

