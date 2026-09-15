# Superadmin Portal Access Details

## 🔐 Initial Setup

### Option 1: Create Superadmin via API (Recommended for First Setup)

**Step 1: Create Superadmin Account**

Make a POST request to create the first superadmin:

```bash
curl -X POST http://localhost:3000/api/superadmin/create \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@ecclesia.com",
    "password": "ChangeThisPassword123!",
    "firstName": "Super",
    "lastName": "Admin"
  }'
```

**Or using PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/superadmin/create" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{
    "email": "admin@ecclesia.com",
    "password": "ChangeThisPassword123!",
    "firstName": "Super",
    "lastName": "Admin"
  }'
```

**Response:**
```json
{
  "message": "Superadmin account created successfully",
  "user": {
    "id": "...",
    "email": "admin@ecclesia.com",
    "firstName": "Super",
    "lastName": "Admin",
    "role": "SUPER_ADMIN"
  },
  "access": {
    "portal": "/superadmin",
    "loginUrl": "/auth/login",
    "email": "admin@ecclesia.com"
  }
}
```

### Option 2: Promote Existing User to Superadmin

If you already have a user account, you can promote them to superadmin (requires existing superadmin):

```bash
curl -X POST http://localhost:3000/api/superadmin/promote \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<your-session-token>" \
  -d '{
    "email": "existing-user@example.com"
  }'
```

Or by user ID:
```bash
curl -X POST http://localhost:3000/api/superadmin/promote \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<your-session-token>" \
  -d '{
    "userId": "user-id-here"
  }'
```

## 🚀 Accessing the Superadmin Portal

### Step 1: Login
1. Navigate to: `http://localhost:3000/auth/login`
2. Enter your superadmin credentials:
   - **Email**: `admin@ecclesia.com` (or your superadmin email)
   - **Password**: `ChangeThisPassword123!` (or your password)

### Step 2: Access Portal
After login, you'll be redirected to `/dashboard`. To access the superadmin portal:

1. Navigate directly to: `http://localhost:3000/superadmin`
2. Or click the superadmin link in the navigation (if available)

### Portal Routes

- **Dashboard**: `/superadmin`
- **Churches Management**: `/superadmin/churches`
- **Church Details**: `/superadmin/churches/[churchId]`
- **Subscriptions**: `/superadmin/subscriptions`
- **Analytics**: `/superadmin/analytics`

## 🔒 Default Credentials (Change Immediately!)

**⚠️ IMPORTANT: Change these credentials immediately after first login!**

```
Email: admin@ecclesia.com
Password: ChangeThisPassword123!
```

### How to Change Password

Currently, password changes need to be done through the database or by creating a new superadmin. Future enhancement: Add password change functionality in the portal.

## 📋 Superadmin Capabilities

### Tenant Management
- ✅ View all church organizations
- ✅ View church details and statistics
- ✅ Search and filter churches
- ✅ View church owners and members

### License Management
- ✅ Extend trial periods (1-365 days)
- ✅ Change subscription plans
- ✅ Suspend/activate churches
- ✅ Update subscription status
- ✅ View usage statistics vs limits

### Platform Management
- ✅ Monitor all churches
- ✅ Track platform-wide statistics
- ✅ Manage subscriptions
- ✅ View analytics

## 🛡️ Security Best Practices

1. **Change Default Password**: Immediately change the default password after first login
2. **Use Strong Password**: Minimum 12 characters, mix of uppercase, lowercase, numbers, and symbols
3. **Limit Superadmin Accounts**: Only create superadmin accounts for trusted administrators
4. **Regular Audits**: Review superadmin access logs regularly
5. **Two-Factor Authentication**: Consider implementing 2FA (future enhancement)

## 🔧 Troubleshooting

### Cannot Access Superadmin Portal

**Issue**: Getting redirected to `/dashboard` instead of `/superadmin`

**Solution**: 
1. Verify your role is `SUPER_ADMIN`:
   - Check your user record in Firestore
   - Ensure `role` field is set to `SUPER_ADMIN`
2. Clear browser cache and cookies
3. Logout and login again

### "Forbidden" Error

**Issue**: Getting 403 Forbidden error

**Solution**:
1. Verify you're logged in
2. Check your session role: `(session.user as any).role`
3. Ensure role is exactly `SUPER_ADMIN` (case-sensitive)

### Cannot Create Superadmin

**Issue**: API returns "Superadmin already exists"

**Solution**:
1. Check if superadmin already exists in database
2. Use `/api/superadmin/promote` to promote existing user
3. Or manually update user role in Firestore

## 📝 Quick Reference

### Create Superadmin
```bash
POST /api/superadmin/create
Body: { email, password, firstName, lastName }
```

### Promote User to Superadmin
```bash
POST /api/superadmin/promote
Headers: { Cookie: "next-auth.session-token=..." }
Body: { userId } or { email }
```

### Login URL
```
http://localhost:3000/auth/login
```

### Superadmin Portal
```
http://localhost:3000/superadmin
```

## 🎯 Production Deployment

### Before Going Live

1. **Create Superadmin**: Use the API endpoint to create your superadmin account
2. **Change Password**: Immediately change the default password
3. **Secure API Endpoint**: Consider adding IP whitelist or secret token to `/api/superadmin/create`
4. **Remove Default Credentials**: Never use default credentials in production
5. **Enable HTTPS**: Always use HTTPS in production
6. **Monitor Access**: Set up logging and monitoring for superadmin access

### Securing the Create Endpoint

You can secure the `/api/superadmin/create` endpoint by:

1. **Adding IP Whitelist**:
```typescript
const allowedIPs = ['your-server-ip']
const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
if (!allowedIPs.includes(clientIP)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

2. **Adding Secret Token**:
```typescript
const secretToken = request.headers.get('x-admin-secret')
if (secretToken !== process.env.ADMIN_SECRET_TOKEN) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

3. **Disabling After First Use**:
```typescript
// Check if superadmin exists, if yes, disable this endpoint
const superAdminExists = await checkSuperAdminExists()
if (superAdminExists) {
  return NextResponse.json({ error: 'Endpoint disabled' }, { status: 403 })
}
```

## 📞 Support

If you encounter issues accessing the superadmin portal:

1. Check browser console for errors
2. Verify user role in Firestore database
3. Check server logs for authentication errors
4. Ensure `NEXTAUTH_SECRET` environment variable is set

## 🔄 Next Steps

After creating your superadmin account:

1. ✅ Login with superadmin credentials
2. ✅ Access `/superadmin` portal
3. ✅ Review all registered churches
4. ✅ Test license management features
5. ✅ Change default password
6. ✅ Set up monitoring and alerts

---

**Remember**: Keep superadmin credentials secure and limit access to trusted administrators only!

