# Production Deployment Guide

## 🚀 Quick Deploy to Production

### Prerequisites
- ✅ Vercel CLI installed (`vercel --version`)
- ✅ Logged into Vercel (`vercel login`)
- ✅ Environment variables configured in Vercel Dashboard

### Step 1: Verify Environment Variables

Make sure all environment variables are set in Vercel Dashboard:
1. Go to: https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Verify these are set:
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `FIREBASE_ADMIN_PROJECT_ID`
   - `FIREBASE_PROJECT_ID`
   - `NEXTAUTH_URL` (your production URL)
   - `NEXTAUTH_SECRET`
   - `FIREBASE_SERVICE_ACCOUNT` (entire JSON as single line)
   - `NODE_ENV=production`

### Step 2: Build Locally (Optional - Test First)

```bash
npm run build
```

If build succeeds, you're ready to deploy!

### Step 3: Deploy to Production

```bash
vercel --prod
```

This will:
- Build your application
- Deploy to production
- Give you the production URL

### Step 4: Verify Deployment

After deployment completes:
1. Visit your production URL
2. Test login functionality
3. Check superadmin portal: `/superadmin`
4. Verify API routes work

## 📋 Post-Deployment Checklist

- [ ] App loads at production URL
- [ ] Login works correctly
- [ ] Registration creates church organization
- [ ] Superadmin portal accessible (`/superadmin`)
- [ ] Church slug login works (`/login/[slug]`)
- [ ] API routes respond correctly
- [ ] Firestore reads/writes work
- [ ] No console errors in browser

## 🔧 Troubleshooting

### Build Fails
- Check build logs in Vercel Dashboard
- Verify all environment variables are set
- Check `next.config.js` configuration

### Environment Variables Not Working
- Make sure variables are set for "Production" environment
- Redeploy after adding variables: `vercel --prod`
- Check variable names match exactly (case-sensitive)

### Firebase Connection Issues
- Verify `FIREBASE_SERVICE_ACCOUNT` is set correctly (single-line JSON)
- Check Firebase project ID matches
- Verify Firestore is enabled in Firebase Console

### 404 Errors
- Check route structure matches Next.js App Router conventions
- Verify `next.config.js` output mode
- Check Vercel build logs for routing issues

## 🔄 Continuous Deployment

To enable automatic deployments from Git:

1. Connect your Git repository in Vercel Dashboard
2. Push to `main` branch → Auto-deploys to production
3. Push to other branches → Creates preview deployments

## 📝 Environment Variables Reference

See `ENV_VARIABLES_READY_TO_COPY.md` for complete list with values.

## 🆘 Need Help?

- Check Vercel Dashboard → Deployments → Logs
- Review `VERCEL_DEPLOY.md` for detailed setup
- Check `DEPLOYMENT_CHECKLIST.md` for pre-deployment items


