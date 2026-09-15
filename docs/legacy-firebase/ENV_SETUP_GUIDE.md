# Environment Variables Setup Guide

## Required for Core Functionality

### Firebase (Already Configured)
```env
FIREBASE_PROJECT_ID=ecclesia-2025
FIREBASE_ADMIN_PROJECT_ID=ecclesia-2025
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ecclesia-2025
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

### NextAuth
```env
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret-key-32-chars-minimum
```

### AI Model Provider (Optional - for AI features)
Choose one provider:

#### Option 1: DeepSeek (Recommended - Cost-effective)
**Why DeepSeek?**
- OpenAI-compatible API
- Cost-effective pricing
- Good performance for spiritual coaching
- Easy setup

**Setup:**
1. Sign up at [platform.deepseek.com](https://platform.deepseek.com)
2. Get API key from [API Keys section](https://platform.deepseek.com/api_keys)
3. Add to environment:

```env
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxx
DEEPSEEK_MODEL=deepseek-chat  # Optional: default is deepseek-chat
```

#### Option 2: OpenAI (Alternative)
```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
OPENAI_MODEL=gpt-4  # Optional: default is gpt-4
```

**Note:** The application will use DeepSeek if `DEEPSEEK_API_KEY` is set, otherwise it falls back to OpenAI if `OPENAI_API_KEY` is set.

---

## New: Email Service (Choose One Provider)

### Option 1: Resend (Recommended - Easiest Setup)
**Why Resend?**
- Modern API, great developer experience
- Free tier: 3,000 emails/month
- Easy domain verification
- Best for startups and small apps

**Setup:**
1. Sign up at [resend.com](https://resend.com)
2. Get API key from dashboard
3. Verify your domain (optional but recommended)
4. Add to environment:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

### Option 2: SendGrid (Enterprise Option)
**Why SendGrid?**
- Free tier: 100 emails/day
- Enterprise features
- Good for high volume

**Setup:**
1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Create API key
3. Verify sender email
4. Add to environment:

```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

### Option 3: AWS SES (For AWS Infrastructure)
**Why AWS SES?**
- Very low cost ($0.10 per 1,000 emails)
- Integrates with AWS ecosystem
- Requires AWS account

**Setup:**
1. Set up AWS account
2. Verify email/domain in SES
3. Create IAM user with SES permissions
4. Add to environment:

```env
AWS_SES_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxx
AWS_SES_FROM_EMAIL=noreply@yourdomain.com
```

---

## Payment Gateway (Flutterwave)

### Flutterwave (Recommended for Nigeria and Global)
**Why Flutterwave?**
- Supports 150+ countries worldwide
- 34 currencies including NGN, USD, GBP, EUR
- Multiple payment methods: Cards, Bank Transfer, USSD, Mobile Money
- Works for both Nigerian and international businesses
- Easy integration

**Setup:**
1. Sign up at [flutterwave.com](https://flutterwave.com)
2. Complete business verification (for live mode)
3. Get your API keys from Settings → API
4. Add to environment:

```env
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-xxxxxxxxxxxxx  # Use FLWPUBK_TEST- for testing
FLUTTERWAVE_SECRET_KEY=FLWSECK-xxxxxxxxxxxxx  # Use FLWSECK_TEST- for testing
FLUTTERWAVE_SECRET_HASH=your-webhook-secret-hash
```

**Webhook Configuration:**
1. Go to Settings → Webhooks in Flutterwave dashboard
2. Add webhook URL: `https://your-domain.com/api/webhooks/flutterwave`
3. Select event: `charge.completed`
4. Copy the secret hash and add it to your environment variables

---

## Storage (Already Configured)

Firebase Storage is automatically available with your Firebase project. No additional environment variables needed.

**Note:** Files are stored in: `gs://[project-id].appspot.com/`

---

## How Email Service Works

The `EmailService` automatically detects which provider is configured:

1. Checks for `RESEND_API_KEY` → Uses Resend
2. Checks for `SENDGRID_API_KEY` → Uses SendGrid
3. Checks for `AWS_SES_REGION` + `AWS_ACCESS_KEY_ID` → Uses AWS SES
4. If none found → Logs warning, emails disabled (development mode shows links in console)

**Priority Order:** Resend > SendGrid > AWS SES

---

## Testing Email Service

### Development Mode
If no email service is configured, the app will:
- Log password reset links to console
- Continue functioning normally
- Show warnings in logs

### Production Mode
In production, you **must** configure an email service for:
- Password reset emails
- Donation receipt emails
- Future notification emails

---

## Quick Start (Recommended: Resend)

1. **Sign up for Resend:**
   ```bash
   # Visit https://resend.com and create account
   ```

2. **Get API Key:**
   - Go to API Keys section
   - Create new key
   - Copy the key (starts with `re_`)

3. **Add to Environment:**
   ```env
   RESEND_API_KEY=re_your_key_here
   RESEND_FROM_EMAIL=onboarding@resend.dev  # Use default for testing
   ```

4. **For Production:**
   - Verify your domain in Resend dashboard
   - Update `RESEND_FROM_EMAIL` to your verified domain
   - Example: `noreply@yourchurch.com`

---

## Verification Checklist

### Email Service
- [ ] Email service API key added to environment
- [ ] `RESEND_FROM_EMAIL` or equivalent configured
- [ ] Test password reset email delivery
- [ ] Test donation receipt email delivery
- [ ] Verify emails arrive in inbox (check spam folder)
- [ ] Domain verified (for production)

### Payment Gateway (Flutterwave)
- [ ] Flutterwave API keys (Public & Secret) added to environment
- [ ] Flutterwave Secret Hash added to environment
- [ ] Webhook URL configured in Flutterwave dashboard
- [ ] Test payment flow end-to-end in test mode
- [ ] Verify webhook receives charge.completed events
- [ ] Test donation receipt email after payment
- [ ] Verify giving records are created correctly
- [ ] Test with real payment in live mode (small amount)

---

## Troubleshooting

### Emails Not Sending
1. Check API key is correct
2. Verify sender email is verified/authorized
3. Check email service dashboard for errors
4. Review application logs for error messages

### Development Mode
- Password reset links are logged to console
- Check terminal output for reset URLs
- This is expected behavior when email service is not configured

### Production Mode
- Emails must be configured
- Verify domain/email in provider dashboard
- Check spam folder if emails not received
- Review provider's delivery logs

