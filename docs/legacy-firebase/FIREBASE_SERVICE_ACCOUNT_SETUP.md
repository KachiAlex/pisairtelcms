# Firebase Service Account Setup for Vercel

## Problem
The application is failing because Firebase Admin SDK cannot authenticate with Firestore. The error is:
```
Error: Could not load the default credentials
```

This happens because Vercel doesn't have access to Google Cloud default credentials. We need to provide the Firebase service account JSON explicitly.

## Solution: Add Firebase Service Account to Vercel

### Step 1: Get Your Firebase Service Account JSON

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **ecclesia-2025**
3. Click the gear icon (⚙️) → **Project Settings**
4. Go to the **Service Accounts** tab
5. Click **Generate New Private Key**
6. A JSON file will download - **KEEP THIS SAFE**

The file will look like:
```json
{
  "type": "service_account",
  "project_id": "ecclesia-2025",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-...",
  ...
}
```

### Step 2: Convert to Base64

You need to convert the JSON to Base64 for safe storage in environment variables.

**Option A: Using Online Tool**
1. Go to [base64encode.org](https://www.base64encode.org/)
2. Paste the entire JSON content
3. Click "Encode"
4. Copy the Base64 string

**Option B: Using Command Line (Windows PowerShell)**
```powershell
$json = Get-Content "path/to/firebase-service-account.json" -Raw
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
$base64 = [System.Convert]::ToBase64String($bytes)
$base64 | Set-Clipboard
```

**Option C: Using Command Line (Mac/Linux)**
```bash
cat firebase-service-account.json | base64 | pbcopy
```

### Step 3: Add to Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **ecclesia** project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. Fill in:
   - **Name**: `FIREBASE_SERVICE_ACCOUNT_BASE64`
   - **Value**: Paste the Base64 string from Step 2
   - **Environments**: Select all (Production, Preview, Development)
6. Click **Save**

### Step 4: Redeploy

1. Go to **Deployments** tab
2. Click the three dots on the latest deployment
3. Select **Redeploy**
4. Wait for the build to complete

## Verification

After redeployment, check the logs:
1. Go to **Deployments** → Latest deployment
2. Click **View Build Logs**
3. Look for: `Successfully parsed Firebase service account from BASE64 environment variable`
4. If you see this, Firebase is now properly configured!

## Testing

1. Go to your Vercel URL
2. Try to access `/auth/register`
3. The page should load without Firebase errors
4. Try to register a new church
5. If successful, you'll see the church created in Firestore

## Troubleshooting

### Error: "Invalid Base64"
- Make sure you copied the entire Base64 string
- No line breaks or extra spaces
- Try re-encoding the JSON

### Error: "Invalid service account"
- Verify the JSON is valid (use [jsonlint.com](https://www.jsonlint.com/))
- Make sure it's the complete file
- Check that `type` is `service_account`

### Error: "Permission denied"
- The service account might not have Firestore permissions
- Go to Firebase Console → IAM & Admin
- Ensure the service account has "Editor" or "Firebase Admin" role

### Still seeing "Could not load the default credentials"
- Clear Vercel cache: Settings → Git → Clear Cache
- Redeploy the project
- Check that FIREBASE_SERVICE_ACCOUNT_BASE64 is set in all environments

## Security Notes

⚠️ **IMPORTANT**: 
- Never commit the service account JSON to GitHub
- Never share the Base64 string publicly
- The service account has full access to your Firebase project
- Treat it like a password
- If compromised, regenerate it immediately

## Alternative: Using JSON String (Not Recommended)

If Base64 doesn't work, you can try the JSON string directly:

1. Get the service account JSON
2. Minify it (remove all newlines and extra spaces)
3. Add to Vercel as `FIREBASE_SERVICE_ACCOUNT` with the minified JSON

However, Base64 is more reliable for Vercel.

## Next Steps

Once Firebase is properly configured:
1. Test the registration flow
2. Create a test church
3. Verify data appears in Firestore
4. Test the login flow
5. Access the dashboard

## Support

If you continue to have issues:
1. Check Vercel deployment logs
2. Verify the service account JSON is valid
3. Ensure Base64 encoding is correct
4. Check Firebase Console for any errors
5. Contact Firebase support if needed
