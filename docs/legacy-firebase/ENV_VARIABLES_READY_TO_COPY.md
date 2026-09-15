# Environment Variables - Ready to Copy & Paste

Here are all your environment variable values ready to add to Vercel:

## 📋 Step-by-Step Instructions

1. Go to: https://vercel.com/dashboard
2. Click on your project: **ecclesia**
3. Go to **Settings** → **Environment Variables**
4. Add each variable below (click "Add New" for each)

---

## ✅ Required Variables

### 1. NEXT_PUBLIC_FIREBASE_PROJECT_ID
```
ecclesia-2025
```
**Environments:** Production, Preview, Development

---

### 2. FIREBASE_ADMIN_PROJECT_ID
```
ecclesia-2025
```
**Environments:** Production, Preview, Development

---

### 3. FIREBASE_PROJECT_ID
```
ecclesia-2025
```
**Environments:** Production, Preview, Development

---

### 4. NEXTAUTH_URL
```
https://ecclesia-ifjzn0hss-onyedikachi-akomas-projects.vercel.app
```
**Environments:** Production only

**For Preview:** Use the preview URL from each deployment  
**For Development:** `http://localhost:3000`

---

### 5. NEXTAUTH_SECRET
```
atbrhFqbOHbHC3RBEAO+AJsSUUH0rsf+oHmn6I/5w+w=
```
**Environments:** Production, Preview, Development

---

### 6. FIREBASE_SERVICE_ACCOUNT
```
[YOUR_FIREBASE_SERVICE_ACCOUNT_JSON_HERE]
```

**How to get:**
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Copy the entire JSON content (it should be one continuous line, no line breaks)
4. Paste it as the value above
**Environments:** Production, Preview, Development

⚠️ **Important:** Copy the ENTIRE line above (it's all one line, no line breaks)

---

### 7. NODE_ENV
```
production
```
**Environments:** Production only

---

## 🔧 Optional Variables

### 8. DEEPSEEK_API_KEY (Recommended for AI features - Cost-effective)
```
your-deepseek-api-key-here
```
**How to get:**
1. Go to https://platform.deepseek.com
2. Sign in and create an account
3. Go to API Keys section: https://platform.deepseek.com/api_keys
4. Create a new secret key
5. Copy and paste it here

**Optional:**
- `DEEPSEEK_MODEL=deepseek-chat` (default: deepseek-chat, other options: deepseek-coder)

**Environments:** Production, Preview, Development (if using)

**Alternative:**
### 8b. OPENAI_API_KEY (Alternative AI provider)
```
your-openai-api-key-here
```
**How to get:**
1. Go to https://platform.openai.com/api-keys
2. Sign in and create a new secret key
3. Copy and paste it here

**Note:** The app will use DeepSeek if `DEEPSEEK_API_KEY` is set, otherwise it falls back to OpenAI if `OPENAI_API_KEY` is set.

---

## 🚀 After Adding Variables

1. **Redeploy your app:**
   - Go to **Deployments** tab
   - Click the **three dots (⋯)** on the latest deployment
   - Click **Redeploy**
   
   OR run:
   ```bash
   vercel --prod
   ```

2. **Verify it works:**
   - Visit: https://ecclesia-ifjzn0hss-onyedikachi-akomas-projects.vercel.app
   - Test login functionality
   - Check that pages load correctly

---

## 📝 Quick Checklist

- [ ] Added NEXT_PUBLIC_FIREBASE_PROJECT_ID
- [ ] Added FIREBASE_ADMIN_PROJECT_ID
- [ ] Added FIREBASE_PROJECT_ID
- [ ] Added NEXTAUTH_URL (Production)
- [ ] Added NEXTAUTH_SECRET (All environments)
- [ ] Added FIREBASE_SERVICE_ACCOUNT (All environments)
- [ ] Added NODE_ENV (Production)
- [ ] Added DEEPSEEK_API_KEY (Recommended - if using AI) OR OPENAI_API_KEY (Alternative)
- [ ] Redeployed the app

---

## 🆘 Troubleshooting

**If something doesn't work:**
1. Check that all variables are added correctly
2. Make sure you redeployed after adding variables
3. Check deployment logs in Vercel Dashboard
4. Verify Firestore is enabled in Firebase Console

---

**Your Production URL:** https://ecclesia-ifjzn0hss-onyedikachi-akomas-projects.vercel.app

