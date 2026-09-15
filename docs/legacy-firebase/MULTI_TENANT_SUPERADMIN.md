# Multi-Tenant Superadmin Portal

## ✅ What's Been Built

### 1. **Updated Registration Flow**
- When users register, they now create a **church organization**
- The registering user becomes the **church owner** with **ADMIN** role
- Church slug is automatically generated from church name
- Registration form includes church name, city, and country fields

### 2. **Superadmin Portal**
- **Dashboard** (`/superadmin`) - Overview of all churches and platform stats
- **Churches Management** (`/superadmin/churches`) - List and manage all church organizations
- **Church Details** (`/superadmin/churches/[churchId]`) - View detailed information about each church
- **Subscriptions** (`/superadmin/subscriptions`) - Manage subscription plans and church subscriptions
- **Analytics** (`/superadmin/analytics`) - Platform-wide analytics (coming soon)

### 3. **API Routes**
- `/api/superadmin/churches` - Get all churches (superadmin only)

### 4. **Access Control**
- Superadmin routes are protected - only users with `SUPER_ADMIN` role can access
- Regular users are redirected to `/dashboard` if they try to access superadmin routes

## 🏗️ Architecture

### Multi-Tenant Structure
- **Churches** are the tenants
- Each church has:
  - An **owner** (the user who registered the church)
  - **Members** (users belonging to that church)
  - **Subscription** (trial, active, expired, etc.)
  - **Settings** (branding, custom domain, etc.)

### User Roles
- `SUPER_ADMIN` - Platform administrator (can manage all churches)
- `ADMIN` - Church administrator (manages their church)
- `PASTOR` - Church pastor (manages church operations)
- `LEADER` - Department/group leader
- `MEMBER` - Regular church member
- `VISITOR` - Visitor/new member

## 🚀 How to Use

### Creating a Superadmin User

To create a superadmin user, you need to manually update a user's role in the database:

**Option 1: Using Firestore Console**
1. Go to Firebase Console → Firestore Database
2. Find the user document in the `users` collection
3. Update the `role` field to `SUPER_ADMIN`

**Option 2: Using API (if you have access)**
```typescript
// Update user role to SUPER_ADMIN
await UserService.update(userId, { role: 'SUPER_ADMIN' })
```

**Option 3: Create via Seed Script**
Create a seed script that creates a superadmin user:
```typescript
const superadmin = await UserService.create({
  firstName: 'Super',
  lastName: 'Admin',
  email: 'admin@ecclesia.app',
  password: 'secure-password',
  role: 'SUPER_ADMIN',
})
```

### Registration Flow

1. **User visits** `/auth/register`
2. **Fills out form**:
   - Personal information (name, email, password)
   - Church organization details (church name, city, country)
3. **System creates**:
   - Church organization with unique slug
   - User account with ADMIN role
   - Links user as church owner
4. **User is redirected** to login page
5. **After login**, user sees their church dashboard

### Accessing Superadmin Portal

1. **Login** as a superadmin user
2. **Navigate** to `/superadmin`
3. **View** platform overview and manage churches

## 📁 File Structure

```
app/
  (superadmin)/
    layout.tsx              # Superadmin layout with navigation
    page.tsx                # Superadmin dashboard
    churches/
      page.tsx              # Churches list
      [churchId]/
        page.tsx            # Church details
    subscriptions/
      page.tsx              # Subscriptions management
    analytics/
      page.tsx              # Platform analytics

app/api/
  auth/
    register/
      route.ts              # Updated to create church + user
  superadmin/
    churches/
      route.ts              # Get all churches (superadmin only)

lib/services/
  church-service.ts         # Updated with findAll, findBySlug, generateSlug
```

## 🔐 Security

- All superadmin routes check for `SUPER_ADMIN` role
- Unauthorized users are redirected to `/dashboard`
- API routes verify session and role before processing

## 🎯 Next Steps

1. **Create Superadmin User** - Set up your first superadmin account
2. **Test Registration** - Register a new church to verify the flow
3. **Customize Dashboard** - Add more metrics and features to superadmin dashboard
4. **Add Features**:
   - Church suspension/activation
   - Subscription management UI
   - Advanced analytics
   - Church search and filtering
   - Bulk operations

## 📝 Notes

- Church slugs are auto-generated from church name
- If a slug already exists, a number suffix is added (e.g., `grace-church-2`)
- The first user to register a church becomes its owner and admin
- Superadmin users can view all churches but cannot directly edit them (yet)
- Each church operates as an isolated tenant with its own data

## 🐛 Known Limitations

- Superadmin cannot yet edit churches directly (needs to be added)
- Subscription management UI is basic (needs enhancement)
- Analytics page is placeholder (needs implementation)
- No way to transfer church ownership yet

