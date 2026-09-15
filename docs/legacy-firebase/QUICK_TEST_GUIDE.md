# Quick Test Guide - Getting Started with Ecclesia

## 🚀 Quick Start (5 minutes)

### Step 1: Access the Application
Open your browser and go to your Vercel deployment URL:
```
https://ecclesia-[your-project].vercel.app
```

### Step 2: Register a Test Church
1. Click "Register a new church" or go to `/auth/register`
2. Fill in the form:
   - **Church Name**: "My Test Church"
   - **Church Slug**: "my-test-church" (must be unique, lowercase, no spaces)
   - **Email**: your-email@example.com
   - **Password**: SecurePassword123!
   - **Plan**: Select "Basic" or "Pro"
3. Click "Register"
4. Wait for confirmation

### Step 3: Access the Login Page
Once registered, you can access the tenant-specific login page:
```
https://ecclesia-[your-project].vercel.app/login/my-test-church
```

### Step 4: Log In
1. Use the email and password from Step 2
2. You should see the dashboard

## 🔍 Troubleshooting

### Error: "Church slug not found"
**Cause**: The slug doesn't exist in Firestore
**Solution**: 
1. Go to `/auth/register` and create a new church
2. Use the exact slug you created

### Error: "Unable to load church information"
**Cause**: Firestore connection issue
**Solution**:
1. Check Vercel logs: https://vercel.com/dashboard
2. Verify Firebase credentials are set
3. Check that Firestore is accessible

### Error: "Database connection failed"
**Cause**: PostgreSQL connection issue
**Solution**:
1. Verify DATABASE_URL is set in Vercel
2. Check Neon dashboard for connection issues
3. Verify IP whitelist allows Vercel IPs

## 📋 What to Test

### Basic Flow
- [ ] Register a new church
- [ ] Access tenant login page
- [ ] Log in with credentials
- [ ] View dashboard
- [ ] Log out

### User Management
- [ ] Create a new user
- [ ] Assign roles
- [ ] Edit user profile
- [ ] Delete user

### Church Settings
- [ ] Update church name
- [ ] Upload logo
- [ ] Configure hierarchy
- [ ] Set up branches

### Features
- [ ] Create a survey
- [ ] Create an event
- [ ] View attendance
- [ ] Check giving records

## 🆘 Getting Help

### Check Logs
1. **Vercel Logs**: https://vercel.com/dashboard → Select project → Deployments
2. **Browser Console**: Press F12 → Console tab
3. **Network Tab**: Press F12 → Network tab → Look for failed requests

### Common Issues

| Issue | Solution |
|-------|----------|
| 404 on login page | Create a church first at /auth/register |
| Database errors | Check DATABASE_URL in Vercel settings |
| Firebase errors | Check Firebase project ID and credentials |
| Blank page | Check browser console for JavaScript errors |
| Slow loading | Check Vercel deployment status |

## 📞 Support

If you encounter issues:
1. Check the deployment logs
2. Verify all environment variables are set
3. Test database connections
4. Check browser console for errors
5. Contact support@ecclesia.app

## ✅ Success Indicators

You'll know everything is working when:
- ✅ Registration completes successfully
- ✅ Login page loads with church name
- ✅ Dashboard displays after login
- ✅ Can create and view surveys
- ✅ Can create and view events
- ✅ Can manage users
