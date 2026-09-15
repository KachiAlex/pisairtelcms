# Superadmin Portal - Complete Tenant & License Management

## 🎯 Overview

The superadmin portal provides comprehensive tools to manage all church tenants (organizations) and their licenses/subscriptions. This is a complete multi-tenant SaaS management system.

## 🔐 Access Control

- **Route**: `/superadmin/*`
- **Required Role**: `SUPER_ADMIN`
- **Unauthorized Access**: Redirects to `/dashboard`

## 📊 Features

### 1. Tenant Management Dashboard (`/superadmin`)

**Overview Statistics**:
- Total churches registered
- Total users across all churches
- Active subscriptions count
- Trial subscriptions count
- Recent churches list

### 2. Churches Management (`/superadmin/churches`)

**Features**:
- ✅ List all church organizations
- ✅ Search churches by name, slug, city, country
- ✅ Filter by subscription status (TRIAL, ACTIVE, EXPIRED, SUSPENDED, CANCELLED)
- ✅ Sort by:
  - Newest/Oldest first
  - Name (A-Z)
  - Member count
- ✅ View church details with one click

**Table Columns**:
- Church name & slug
- Location (city, country)
- Member count
- Subscription status (color-coded badges)
- Created date
- Quick action link

### 3. Church Detail & License Management (`/superadmin/churches/[churchId]`)

#### Church Information
- Full church details (name, slug, contact info, address)
- Owner information (name, email, role)
- Member count
- Creation date

#### Usage Statistics
- **Users**: Current count vs plan limit
- **Storage**: Used GB vs plan limit
- **Sermons**: Count vs plan limit
- **Events**: Count vs plan limit
- Visual progress bars with color coding:
  - Green: < 75% usage
  - Yellow: 75-90% usage
  - Red: > 90% usage

#### License Management Actions

**1. Extend Trial**
- Extend trial period by custom days (1-365)
- Updates trial end date
- Can reactivate expired trials

**2. Change Plan**
- View all available subscription plans
- Switch church to any plan instantly
- Shows current plan highlighted
- Displays plan features and pricing

**3. Suspend/Activate**
- **Suspend**: Immediately disable church access
- **Activate**: Reactivate suspended churches
- Status changes reflected immediately

**4. Update Status**
- Manually set subscription status:
  - `ACTIVE` - Full access
  - `TRIAL` - Trial period active
  - `EXPIRED` - Trial/plan expired
  - `SUSPENDED` - Access disabled
  - `CANCELLED` - Cancelled subscription

## 🔌 API Endpoints

### Get Church Details
```
GET /api/superadmin/churches/[churchId]
```
Returns: church, subscription, plan, userCount

### Update Church/Subscription
```
PUT /api/superadmin/churches/[churchId]
Body: { action: 'extend_trial' | 'change_plan' | 'update_status', ...data }
```

### Extend Trial
```
POST /api/superadmin/churches/[churchId]/extend-trial
Body: { days: 30 }
```

### Change Plan
```
POST /api/superadmin/churches/[churchId]/change-plan
Body: { planId: 'plan-id' }
```

### Suspend Church
```
POST /api/superadmin/churches/[churchId]/suspend
```

### Activate Church
```
POST /api/superadmin/churches/[churchId]/activate
```

## 🎨 UI Components

### `LicenseManager` (`components/superadmin/LicenseManager.tsx`)
- Displays current license status
- Quick action buttons
- Modals for extend trial and change plan
- Real-time status updates

### `LicenseManagerWrapper` (`components/superadmin/LicenseManagerWrapper.tsx`)
- Client-side wrapper for server components
- Handles data refresh after actions
- Manages state updates

### `ChurchesList` (`components/superadmin/ChurchesList.tsx`)
- Client-side filtering and sorting
- Search functionality
- Status badges
- Responsive table layout

### `UsageStats` (`components/superadmin/UsageStats.tsx`)
- Visual usage indicators
- Progress bars
- Limit comparisons
- Color-coded warnings

## 📋 Subscription Statuses

| Status | Description | Access Level |
|--------|-------------|--------------|
| `TRIAL` | Free trial period active | Full access (limited features) |
| `ACTIVE` | Paid subscription active | Full access |
| `EXPIRED` | Trial/subscription expired | Read-only or disabled |
| `SUSPENDED` | Manually suspended by admin | No access |
| `CANCELLED` | Subscription cancelled | No access after period end |

## 🔄 Workflow Examples

### Extending a Trial
1. Navigate to church detail page
2. Click "Extend Trial" button
3. Enter number of days (e.g., 30)
4. Click "Extend Trial"
5. Trial end date updates immediately
6. Status remains `TRIAL` or changes from `EXPIRED` to `TRIAL`

### Changing a Plan
1. Navigate to church detail page
2. Click "Change Plan" button
3. View all available plans
4. Click on desired plan
5. Plan updates immediately
6. Usage limits adjust to new plan

### Suspending a Church
1. Navigate to church detail page
2. Click "Suspend" button
3. Confirm suspension
4. Status changes to `SUSPENDED`
5. Church loses access immediately

### Reactivating a Suspended Church
1. Navigate to church detail page
2. Click "Activate" button
3. Status changes to `ACTIVE` or `TRIAL`
4. Church regains access immediately

## 🛡️ Security

- All routes protected by authentication
- Role-based access control (SUPER_ADMIN only)
- Server-side validation for all actions
- No client-side bypass possible
- Audit trail via Firestore timestamps

## 📈 Usage Tracking

The system tracks:
- User count (real-time)
- Storage usage (GB)
- Sermons count
- Events count
- API calls
- AI coaching sessions

All metrics compared against plan limits with visual indicators.

## 🎯 Best Practices

1. **Trial Management**
   - Monitor trial expiration dates
   - Extend trials for promising churches
   - Contact churches before expiration

2. **Plan Management**
   - Upgrade churches hitting limits
   - Downgrade underutilized plans
   - Monitor usage statistics

3. **Suspension**
   - Use for policy violations
   - Temporary suspensions for payment issues
   - Always communicate with church owner

4. **Monitoring**
   - Check usage statistics regularly
   - Watch for churches approaching limits
   - Review subscription statuses weekly

## 🚀 Future Enhancements

- [ ] Bulk operations (extend multiple trials)
- [ ] Email notifications for status changes
- [ ] Export church data (CSV/Excel)
- [ ] Advanced analytics dashboard
- [ ] Automated trial expiration handling
- [ ] Payment integration management
- [ ] Custom plan creation
- [ ] Usage alerts and notifications

## 📝 Notes

- All actions are immediate (no queuing)
- Changes reflect in real-time
- No confirmation required for plan changes (consider adding)
- Usage statistics update on page load
- Subscription status affects church access globally

