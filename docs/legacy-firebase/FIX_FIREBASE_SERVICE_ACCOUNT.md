# Fix FIREBASE_SERVICE_ACCOUNT Error

## ⚠️ Issue
Your deployment has a JSON parsing error with `FIREBASE_SERVICE_ACCOUNT`. This needs to be fixed for Firebase features to work.

## 🔧 Quick Fix (5 minutes)

### Step 1: Go to Vercel Dashboard
1. Visit: https://vercel.com/dashboard
2. Click on your project: **ecclesia**
3. Go to **Settings** → **Environment Variables**

### Step 2: Update FIREBASE_SERVICE_ACCOUNT
1. Find `FIREBASE_SERVICE_ACCOUNT` in the list
2. Click **Edit** (or delete and recreate)
3. **Delete the current value**
4. **Copy the entire line below** (it's all one line, no breaks):

```
[YOUR_FIREBASE_SERVICE_ACCOUNT_JSON_HERE]
```

**Note:** Replace `[YOUR_FIREBASE_SERVICE_ACCOUNT_JSON_HERE]` with your actual Firebase service account JSON. You can get this from:
1. Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Copy the entire JSON content (it should be one continuous line)

5. **Paste it** as the value
6. Make sure **Environment** is set to: **Production, Preview, Development**
7. Click **Save**

### Step 3: Redeploy
After saving the environment variable:

**Option A: Via Dashboard**
1. Go to **Deployments** tab
2. Click the **three dots (⋯)** on the latest deployment
3. Click **Redeploy**

**Option B: Via CLI**
```bash
vercel --prod
```

## ✅ Verify Fix

After redeployment:
1. Check the build logs - should not see JSON parsing error
2. Visit your app: https://ecclesia-fvh0u1aqi-onyedikachi-akomas-projects.vercel.app
3. Test Firebase features (if any)

## 📝 Important Notes

- The value must be **one continuous line** (no line breaks)
- Make sure you copy the **entire** JSON string above
- The `\n` characters in the private key are correct - don't remove them
- After updating, you **must redeploy** for changes to take effect

## 🆘 Still Having Issues?

If you still get errors:
1. Double-check you copied the entire string (it's very long)
2. Make sure there are no extra spaces before/after
3. Try deleting the variable and recreating it fresh
4. Check Vercel deployment logs after redeploy

