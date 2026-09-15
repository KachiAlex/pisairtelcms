# 🚀 Deploy Ecclesia to Vercel - Quick Guide

## ✅ Build Status: SUCCESS

Your app is ready for production deployment! Build completed successfully.

---

## 🎯 Quick Deploy Steps

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Go to Vercel**
   - Visit [vercel.com](https://vercel.com)
   - Sign in with GitHub

2. **Import Project**
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - If not on GitHub yet, push your code:
     ```bash
     git init
     git add .
     git commit -m "Ready for production"
     git branch -M main
     git remote add origin https://github.com/yourusername/ecclesia.git
     git push -u origin main
     ```

3. **Configure Project**
   - **Framework**: Next.js (auto-detected)
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - Click "Deploy"

4. **Add Environment Variables** (see below)

5. **Done!**
   - Your app will be live at `https://your-project.vercel.app`

---

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - What's your project's name? ecclesia
# - In which directory? ./
# - Override settings? No

# After deployment, add environment variables via dashboard
# Then deploy to production:
vercel --prod
```

---

## 🔐 Environment Variables to Add

### In Vercel Dashboard → Settings → Environment Variables

Copy and paste these (update with your actual values):

```env
# Firebase
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_ADMIN_PROJECT_ID=your-firebase-project-id
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}

# NextAuth - Generate a new secret for production!
NEXTAUTH_URL=https://your-vercel-domain.vercel.app
NEXTAUTH_SECRET=generate-a-strong-secret-here

# Email Service (Resend recommended)
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Payment Gateway (Flutterwave)
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-xxxxxxxxxxxxx
FLUTTERWAVE_SECRET_KEY=FLWSECK-xxxxxxxxxxxxx
FLUTTERWAVE_SECRET_HASH=your-webhook-secret

# Optional: AI Provider
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxx
```

### Generate NEXTAUTH_SECRET

**On Windows (PowerShell):**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }) -as [byte[]])
```

**On Linux/Mac:**
```bash
openssl rand -base64 32
```

**Or use online generator:**
- https://generate-secret.vercel.app/32

---

## 📋 Post-Deployment Checklist

After your first deployment:

### 1. Update NEXTAUTH_URL
```env
NEXTAUTH_URL=https://your-actual-domain.vercel.app
```
Redeploy after changing this.

### 2. Configure Flutterwave Webhook
- Go to Flutterwave Dashboard → Settings → Webhooks
- Add webhook URL: `https://your-domain.vercel.app/api/webhooks/flutterwave`
- Select event: `charge.completed`
- Save the secret hash

### 3. Verify Email Service
If using Resend with custom domain:
- Go to Resend Dashboard → Domains
- Add and verify your domain
- Update `RESEND_FROM_EMAIL` to use verified domain

### 4. Test Critical Features
- [ ] Login/Register
- [ ] Dashboard loads
- [ ] Create church
- [ ] Make test donation
- [ ] Verify email receipt sent

### 5. Create Superadmin (Optional)
```bash
# Clone your repo
git clone https://github.com/yourusername/ecclesia.git
cd ecclesia

# Install dependencies
npm install

# Pull environment variables from Vercel
vercel env pull

# Create superadmin
node scripts/create-superadmin.js
```

---

## 🎨 Add Custom Domain (Optional)

1. Go to your project on Vercel
2. Settings → Domains
3. Add your custom domain (e.g., `church.yourdomain.com`)
4. Update DNS records as instructed by Vercel
5. Update `NEXTAUTH_URL` to your custom domain
6. Redeploy

---

## 🧪 Test Your Deployment

Visit your deployed app and test:

1. **Authentication**
   ```
   https://your-domain.vercel.app/auth/register
   ```

2. **Dashboard**
   ```
   https://your-domain.vercel.app/dashboard
   ```

3. **Test Donation** (use Flutterwave test keys)
   - Go to Giving page
   - Click "Donate"
   - Use test card: `5531886652142950`
   - CVV: `564`, Expiry: `09/32`, PIN: `3310`, OTP: `12345`

---

## 🐛 Common Issues & Solutions

### Issue: Build Fails on Vercel

**Solution:**
```bash
# Test build locally first
npm run build

# If it works locally but fails on Vercel, check:
# 1. Environment variables are set
# 2. Node version matches (18.x)
# 3. Check Vercel build logs
```

### Issue: Environment Variables Not Working

**Solution:**
1. Verify variables are added in Vercel dashboard
2. Redeploy after adding/changing variables
3. Check variable names match exactly (case-sensitive)

### Issue: Firebase Connection Error

**Solution:**
1. Verify `FIREBASE_SERVICE_ACCOUNT` is valid JSON
2. Check Firebase project ID is correct
3. Ensure service account has correct permissions

### Issue: NEXTAUTH_URL Mismatch

**Solution:**
```env
# Make sure it matches your actual domain
NEXTAUTH_URL=https://your-actual-domain.vercel.app
# No trailing slash!
```

---

## 📊 Monitor Your Deployment

### Vercel Dashboard
- **Deployments**: View all deployments
- **Functions**: Monitor API performance  
- **Analytics**: Track usage (enable in settings)
- **Logs**: Real-time debugging

### Enable Analytics
1. Go to your project on Vercel
2. Analytics tab → Enable
3. View real-time traffic and performance

---

## 🔄 Continuous Deployment

Vercel automatically deploys when you push to GitHub:

- **Push to `main` branch** → Production deployment
- **Push to other branches** → Preview deployment
- **Pull requests** → Preview deployment with unique URL

---

## ✅ You're Ready!

Your app is production-ready. Just:

1. ✅ Build succeeded locally
2. ⏳ Push to GitHub
3. ⏳ Deploy to Vercel
4. ⏳ Add environment variables
5. ⏳ Test and verify

**Next step**: Deploy using one of the options above!

---

## 📚 Additional Resources

- **Full Guide**: See `PRODUCTION_DEPLOYMENT_GUIDE.md`
- **Flutterwave Setup**: See `FLUTTERWAVE_SETUP.md`
- **Environment Variables**: See `ENV_SETUP_GUIDE.md`
- **Vercel Docs**: https://vercel.com/docs

---

## 🆘 Need Help?

1. Check Vercel build logs
2. Review error messages in browser console
3. Verify all environment variables are set
4. Check Firebase and Flutterwave dashboards
5. Review the deployment guides

**Good luck with your deployment! 🎉**

