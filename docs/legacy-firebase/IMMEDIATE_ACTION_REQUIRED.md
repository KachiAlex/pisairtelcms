# ⚠️ IMMEDIATE ACTION REQUIRED

## Current Issue
Your application is deployed but **Firebase is not authenticated**. This is why you're seeing the 404 error.

**Error in logs:**
```
Error: Could not load the default credentials
```

## Root Cause
Vercel doesn't have access to Google Cloud default credentials. Firebase Admin SDK needs the service account JSON to authenticate with Firestore.

## Solution (5 minutes)

### Step 1: Get Firebase Service Account
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: **ecclesia-2025**
3. Click ⚙️ (gear icon) → **Project Settings**
4. Go to **Service Accounts** tab
5. Click **Generate New Private Key**
6. Save the JSON file

### Step 2: Convert to Base64
Use one of these methods:

**Windows PowerShell:**
```powershell
$json = Get-Content "path/to/firebase-service-account.json" -Raw
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
$base64 = [System.Convert]::ToBase64String($bytes)
$base64 | Set-Clipboard
```

**Mac/Linux:**
```bash
cat firebase-service-account.json | base64 | pbcopy
```

**Online:** Use [base64encode.org](https://www.base64encode.org/)

### Step 3: Add to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select **ecclesia** project
3. **Settings** → **Environment Variables**
4. Click **Add New**
5. Name: `FIREBASE_SERVICE_ACCOUNT_BASE64`
6. Value: Paste the Base64 string
7. Environments: Select all
8. Click **Save**

### Step 4: Redeploy
1. Go to **Deployments**
2. Click three dots on latest deployment
3. Select **Redeploy**
4. Wait for build to complete (~3-4 minutes)

### Step 5: Verify
Check the build logs:
- Look for: `Successfully parsed Firebase service account from BASE64 environment variable`
- If you see this, Firebase is working!

## Expected Result After Fix

✅ Application loads without errors
✅ Can access `/auth/register`
✅ Can create a new church
✅ Church data saves to Firestore
✅ Can log in with credentials
✅ Dashboard displays correctly

## Timeline

- **Now**: Get Firebase service account (2 min)
- **Next**: Add to Vercel (1 min)
- **Then**: Redeploy (3-4 min)
- **Total**: ~6-7 minutes

## After Deployment

Once Firebase is working:
1. Go to `/auth/register`
2. Create a test church
3. Access `/login/[slug]` with your church slug
4. Log in and verify dashboard works

## Need Help?

See detailed guide: `FIREBASE_SERVICE_ACCOUNT_SETUP.md`

## Important Notes

⚠️ **Security:**
- Never commit the service account JSON to GitHub
- Never share the Base64 string publicly
- Treat it like a password
- If compromised, regenerate immediately

✅ **Verification:**
- After redeploy, check Vercel logs
- Look for Firebase initialization success message
- Test the application

## Questions?

If you get stuck:
1. Check `FIREBASE_SERVICE_ACCOUNT_SETUP.md` for detailed instructions
2. Verify the Base64 encoding is correct
3. Ensure the environment variable is set in all environments
4. Check Vercel deployment logs for specific errors

---

**Status**: 🔴 BLOCKED - Waiting for Firebase service account configuration
**Action**: Follow the 5 steps above
**Estimated Time**: 6-7 minutes
