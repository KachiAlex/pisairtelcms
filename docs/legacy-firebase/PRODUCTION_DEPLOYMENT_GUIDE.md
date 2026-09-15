# 🚀 Production Deployment Guide - Ecclesia

## Overview

This guide will help you deploy Ecclesia to production using Vercel (recommended) or other platforms.

## ✅ Pre-Deployment Checklist

Before deploying, ensure you have completed:

### 1. Required Services Setup
- [ ] **Firebase Project** - Set up and configured
- [ ] **Email Service** - Resend/SendGrid/AWS SES configured
- [ ] **Flutterwave Account** - For payment processing
- [ ] **AI Provider** - DeepSeek or OpenAI (optional)

### 2. Environment Variables
- [ ] All environment variables ready (see below)
- [ ] Firebase service account JSON
- [ ] API keys for all services
- [ ] Production URLs configured

### 3. Code Quality
- [ ] All linter errors fixed
- [ ] Build succeeds locally (`npm run build`)
- [ ] Test critical features locally

---

## 🎯 Deployment Options

### Option 1: Vercel (Recommended - Easiest)

Vercel is the recommended platform for Next.js apps. It provides:
- ✅ Zero-config deployment
- ✅ Automatic HTTPS
- ✅ Edge functions
- ✅ Git integration
- ✅ Preview deployments

#### Steps:

1. **Install Vercel CLI** (optional)
   ```bash
   npm i -g vercel
   ```

2. **Push to GitHub** (if not already)
   ```bash
   git init
   git add .
   git commit -m "Ready for deployment"
   git remote add origin https://github.com/yourusername/ecclesia.git
   git push -u origin main
   ```

3. **Deploy via Vercel Dashboard**
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Connect your GitHub repository
   - Select the repository
   - Configure project:
     - **Framework Preset**: Next.js
     - **Build Command**: `npm run build`
     - **Output Directory**: `.next`
     - **Install Command**: `npm install`

4. **Add Environment Variables** (see section below)

5. **Deploy!**
   - Click "Deploy"
   - Wait for deployment (usually 2-5 minutes)
   - Your app will be live at `https://your-project.vercel.app`

#### Or Deploy via CLI:
```bash
vercel
# Follow the prompts
# Then add environment variables via Vercel dashboard
vercel --prod
```

---

### Option 2: Netlify

1. **Install Netlify CLI**
   ```bash
   npm i -g netlify-cli
   ```

2. **Build the Project**
   ```bash
   npm run build
   ```

3. **Deploy**
   ```bash
   netlify deploy --prod
   ```

4. **Configure**
   - Build command: `npm run build`
   - Publish directory: `.next`
   - Add environment variables via Netlify dashboard

---

### Option 3: Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway auto-detects Next.js
5. Add environment variables
6. Deploy!

---

### Option 4: DigitalOcean App Platform

1. Go to [cloud.digitalocean.com](https://cloud.digitalocean.com)
2. Create a new App
3. Connect your GitHub repository
4. Configure:
   - **Build Command**: `npm run build`
   - **Run Command**: `npm start`
5. Add environment variables
6. Deploy!

---

## 🔐 Environment Variables for Production

Copy these variables to your deployment platform:

### Required Variables

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-production-project-id
FIREBASE_ADMIN_PROJECT_ID=your-production-project-id
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-production-project-id
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project-id",...}

# NextAuth (CRITICAL - Generate a strong secret)
NEXTAUTH_URL=https://your-production-domain.com
NEXTAUTH_SECRET=generate-a-strong-secret-32-chars-minimum

# Email Service (Choose one)
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Payment Gateway (Flutterwave)
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-xxxxxxxxxxxxx
FLUTTERWAVE_SECRET_KEY=FLWSECK-xxxxxxxxxxxxx
FLUTTERWAVE_SECRET_HASH=your-webhook-secret-hash
```

### Optional Variables

```env
# AI Provider (Optional)
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxx
DEEPSEEK_MODEL=deepseek-chat

# Or OpenAI
# OPENAI_API_KEY=sk-xxxxxxxxxxxxx
# OPENAI_MODEL=gpt-4
```

### Generate NEXTAUTH_SECRET

```bash
# On Linux/Mac:
openssl rand -base64 32

# On Windows (PowerShell):
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }) -as [byte[]])

# Or use online generator:
# https://generate-secret.vercel.app/32
```

---

## 🔧 Vercel Configuration

Your `vercel.json` is already configured. Here's what it does:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    // Environment variables are set via dashboard
  }
}
```

---

## 📋 Post-Deployment Tasks

### 1. Configure Custom Domain (Optional)

**Vercel:**
1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update `NEXTAUTH_URL` to your custom domain

**Update Environment Variables:**
```env
NEXTAUTH_URL=https://yourdomain.com
```

### 2. Configure Flutterwave Webhook

1. Go to Flutterwave dashboard → Settings → Webhooks
2. Update webhook URL: `https://yourdomain.com/api/webhooks/flutterwave`
3. Verify secret hash matches environment variable

### 3. Test Payment Flow

1. Use test keys first
2. Make a test donation
3. Verify webhook receives events
4. Check email receipts are sent
5. Switch to live keys when ready

### 4. Email Service Domain Verification

**Resend:**
1. Go to Resend dashboard → Domains
2. Add your domain
3. Add DNS records as instructed
4. Verify domain
5. Update `RESEND_FROM_EMAIL` to use verified domain

### 5. Create Superadmin Account

After deployment, create your first superadmin:

```bash
# If using Vercel CLI
vercel env pull
node scripts/create-superadmin.js

# Or manually via API:
# POST https://yourdomain.com/api/superadmin/create
# Body: { email, password, name }
```

### 6. Set Up Monitoring (Optional but Recommended)

**Vercel Analytics:**
- Enable in Project Settings → Analytics

**Sentry (Error Tracking):**
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

### 7. Enable CORS for API (if needed)

Update `next.config.js` if you need to allow external API access:

```javascript
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
      ],
    },
  ]
}
```

---

## 🧪 Testing Production Deployment

### 1. Smoke Tests

After deployment, test these critical flows:

- [ ] **Authentication**
  - Register new church
  - Login with credentials
  - Logout
  - Forgot password flow

- [ ] **Dashboard**
  - Dashboard loads correctly
  - Church switcher works
  - Branch switcher works
  - Navigation works

- [ ] **Donations**
  - Open donation modal
  - Fill form
  - Redirect to Flutterwave
  - Complete payment with test card
  - Verify redirect back
  - Check email receipt

- [ ] **Content Management**
  - Create sermon
  - Upload file (test storage)
  - Create event
  - Create group

### 2. Performance Checks

- [ ] Lighthouse score > 90
- [ ] Time to First Byte < 600ms
- [ ] First Contentful Paint < 1.8s
- [ ] Largest Contentful Paint < 2.5s

### 3. Security Checks

- [ ] HTTPS enabled
- [ ] Environment variables not exposed
- [ ] API routes require authentication
- [ ] CORS configured correctly
- [ ] CSP headers set (optional)

---

## 🐛 Troubleshooting

### Build Fails

**Error: Module not found**
```bash
# Clear cache and reinstall
rm -rf .next node_modules
npm install
npm run build
```

**Error: Type errors**
```bash
# Check TypeScript errors
npm run lint
```

### Environment Variables Not Working

1. **Check variable names** - Must match exactly
2. **Restart deployment** - Changes require redeploy
3. **Check for quotes** - JSON values might need escaping
4. **Verify via Vercel dashboard** - Settings → Environment Variables

### Firebase Connection Issues

**Error: Failed to initialize Firebase**
- Verify `FIREBASE_SERVICE_ACCOUNT` is properly formatted JSON
- Check Firebase project ID matches
- Ensure service account has correct permissions

### Payment Webhook Not Working

1. **Verify webhook URL** - Must be publicly accessible
2. **Check secret hash** - Must match Flutterwave dashboard
3. **Check logs** - Vercel Functions logs show webhook calls
4. **Test webhook** - Use Flutterwave dashboard test feature

### Email Not Sending

1. **Check API key** - Verify it's correct
2. **Verify sender email** - Must be verified in email service
3. **Check spam folder** - Emails might be marked as spam
4. **Review logs** - Check server logs for errors

---

## 📊 Monitoring & Maintenance

### Vercel Dashboard

Monitor your deployment:
- **Deployments** - View all deployments and rollback if needed
- **Functions** - Monitor API route performance
- **Analytics** - Track page views and performance
- **Logs** - Real-time logs for debugging

### Health Checks

Set up a monitoring service:
- [UptimeRobot](https://uptimerobot.com) - Free uptime monitoring
- [Pingdom](https://www.pingdom.com) - Advanced monitoring
- [Better Stack](https://betterstack.com) - Modern monitoring

Monitor these endpoints:
- `https://yourdomain.com/api/health`
- `https://yourdomain.com/auth/login`

---

## 🔄 CI/CD Setup (Optional)

Enable automatic deployments:

### GitHub Actions (for non-Vercel platforms)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

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
      - run: npm install
      - run: npm run build
      - run: npm run deploy # Your deployment command
```

### Vercel (Automatic)

Vercel automatically deploys on:
- **Push to main** → Production deployment
- **Pull requests** → Preview deployments
- **Push to other branches** → Preview deployments

---

## 📈 Scaling Considerations

### When Your App Grows:

1. **Database Optimization**
   - Add Firestore indexes for frequent queries
   - Consider caching layer (Redis)

2. **File Storage**
   - Firebase Storage has good scalability
   - Consider CDN for static assets

3. **API Rate Limiting**
   - Implement rate limiting for API routes
   - Use Vercel Edge Config for feature flags

4. **Performance**
   - Enable Next.js Image Optimization
   - Implement code splitting
   - Use React Server Components

---

## ✅ Deployment Checklist Summary

### Pre-Deployment
- [ ] All features tested locally
- [ ] Environment variables prepared
- [ ] Firebase project set up
- [ ] Email service configured
- [ ] Flutterwave account created
- [ ] Code pushed to GitHub

### Deployment
- [ ] Project deployed to Vercel/platform
- [ ] Environment variables added
- [ ] Custom domain configured (optional)
- [ ] HTTPS enabled

### Post-Deployment
- [ ] Superadmin account created
- [ ] Payment webhook configured
- [ ] Email domain verified
- [ ] Test payment flow works
- [ ] Monitoring set up
- [ ] Smoke tests passed

---

## 🎉 You're Live!

Congratulations! Your Ecclesia app is now in production.

### Next Steps:

1. **Create your first church** - Register via the app
2. **Invite team members** - Add admins and pastors
3. **Configure branding** - Add church logo and colors
4. **Create content** - Add sermons, events, groups
5. **Enable payments** - Switch Flutterwave to live mode
6. **Promote your app** - Share with church members

### Support Resources:

- **Documentation**: Check the various `.md` files in the project
- **Setup Guides**: 
  - `FLUTTERWAVE_SETUP.md` - Payment setup
  - `ENV_SETUP_GUIDE.md` - Environment variables
  - `FIREBASE_SETUP_COMPLETE.md` - Firebase configuration

---

## 🆘 Need Help?

- Review error logs in Vercel dashboard
- Check Firebase console for database issues
- Verify all environment variables are set
- Test locally with production environment variables
- Check webhook logs in Flutterwave dashboard

**Happy Deploying! 🚀**

