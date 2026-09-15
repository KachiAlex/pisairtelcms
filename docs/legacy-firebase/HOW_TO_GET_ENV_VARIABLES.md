# How to Get Environment Variable Values

This guide shows you exactly how to get each environment variable value needed for your Vercel deployment.

## Required Environment Variables

### 1. **NEXT_PUBLIC_FIREBASE_PROJECT_ID**
**Value:** `ecclesia-2025` (already known)

**How to verify:**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click ⚙️ **Project Settings**
4. Copy the **Project ID** from the General tab

---

### 2. **FIREBASE_ADMIN_PROJECT_ID**
**Value:** `ecclesia-2025` (same as above)

**Same as NEXT_PUBLIC_FIREBASE_PROJECT_ID**

---

### 3. **FIREBASE_PROJECT_ID**
**Value:** `ecclesia-2025` (same as above)

**Same as NEXT_PUBLIC_FIREBASE_PROJECT_ID**

---

### 4. **NEXTAUTH_URL**
**Value:** Your production URL

**How to get:**
- **Production:** `https://ecclesia-ifjzn0hss-onyedikachi-akomas-projects.vercel.app`
- Or use your custom domain if you set one up
- **Preview:** Use the preview URL shown in each deployment
- **Development:** `http://localhost:3000`

**Current Production URL:** `https://ecclesia-ifjzn0hss-onyedikachi-akomas-projects.vercel.app`

---

### 5. **NEXTAUTH_SECRET**
**Value:** A random secret key (32+ characters)

**How to generate:**

**Option A: Using Node.js (Recommended)**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Option B: Using PowerShell (Windows)**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**Option C: Online Generator**
- Visit: https://generate-secret.vercel.app/32
- Copy the generated secret

**Example output:** `5BTVRwmH1+tfYdaXI2YGvpzREuUi7CofKqeX5M5aXBY=`

---

### 6. **FIREBASE_SERVICE_ACCOUNT**
**Value:** JSON content from Firebase Service Account file

**How to get:**

**Step 1: Download Service Account JSON**
1. Go to [Firebase Console](https://console.firebase.google.com/project/ecclesia-2025/settings/serviceaccounts/adminsdk)
2. Click **"Generate new private key"** button
3. Click **"Generate key"** in the popup
4. A JSON file will download automatically
5. Save it as `firebase-service-account.json` in your project root

**Step 2: Convert to Single-Line String**

**Option A: Using Node.js (Recommended)**
```bash
node -e "console.log(JSON.stringify(require('./firebase-service-account.json')))"
```

**Option B: Manual (if file exists)**
1. Open `firebase-service-account.json`
2. Copy all content
3. Remove all newlines (make it one line)
4. Paste as the value

**The JSON should look like this (but all on one line):**
```json
{"type":"service_account","project_id":"ecclesia-2025","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

---

### 7. **OPENAI_API_KEY** (Optional - only if using AI features)
**Value:** Your OpenAI API key

**How to get:**
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click **"Create new secret key"**
4. Copy the key (you won't see it again!)
5. Save it securely

**Note:** This is optional. Only add if you're using AI features like AI Coaching or AI Discipleship.

---

### 8. **NODE_ENV**
**Value:** `production`

**Just set this to:** `production`

---

## Quick Setup Script

Run this command to generate the NEXTAUTH_SECRET and convert your service account:

```bash
# Generate NEXTAUTH_SECRET
node -e "console.log('NEXTAUTH_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"

# Convert service account to single line (if file exists)
node -e "console.log('FIREBASE_SERVICE_ACCOUNT=' + JSON.stringify(require('./firebase-service-account.json')))"
```

---

## Setting Variables in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your project: **ecclesia**
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. For each variable:
   - **Key:** Variable name (e.g., `NEXTAUTH_SECRET`)
   - **Value:** The value you got above
   - **Environment:** Select Production, Preview, and/or Development
6. Click **Save**
7. **Redeploy** your app after adding variables

---

## Current Values Summary

Based on your deployment, here are the values you need:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `ecclesia-2025` |
| `FIREBASE_ADMIN_PROJECT_ID` | `ecclesia-2025` |
| `FIREBASE_PROJECT_ID` | `ecclesia-2025` |
| `NEXTAUTH_URL` | `https://ecclesia-ifjzn0hss-onyedikachi-akomas-projects.vercel.app` |
| `NEXTAUTH_SECRET` | *(Generate using command above)* |
| `FIREBASE_SERVICE_ACCOUNT` | *(Download from Firebase and convert)* |
| `OPENAI_API_KEY` | *(Optional - get from OpenAI)* |
| `NODE_ENV` | `production` |

---

## Need Help?

If you need help getting any of these values, let me know which one and I'll guide you through it!

