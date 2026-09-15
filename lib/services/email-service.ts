/**
 * Email Service
 * Supports multiple providers: Brevo, Resend, SendGrid, AWS SES
 * Preferred on this VPS: Brevo
 */

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
}

export class EmailService {
  private static provider: 'brevo' | 'resend' | 'sendgrid' | 'ses' | null = null

  /**
   * Initialize email service based on available environment variables
   * Brevo is the preferred provider on this VPS.
   */
  static initialize() {
    if (process.env.BREVO_API_KEY) {
      this.provider = 'brevo'
    } else if (process.env.RESEND_API_KEY) {
      this.provider = 'resend'
    } else if (process.env.SENDGRID_API_KEY) {
      this.provider = 'sendgrid'
    } else if (process.env.AWS_SES_REGION && process.env.AWS_ACCESS_KEY_ID) {
      this.provider = 'ses'
    } else {
      this.provider = null
      console.warn('No email service configured. Email functionality will be disabled.')
    }
  }

  /**
   * Send an email
   */
  static async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Initialize if not done
    if (this.provider === null) {
      this.initialize()
    }

    if (!this.provider) {
      console.warn('Email service not configured. Email would be sent to:', options.to)
      return {
        success: false,
        error: 'Email service not configured',
      }
    }

    try {
      switch (this.provider) {
        case 'brevo':
          return await this.sendViaBrevo(options)
        case 'resend':
          return await this.sendViaResend(options)
        case 'sendgrid':
          return await this.sendViaSendGrid(options)
        case 'ses':
          return await this.sendViaSES(options)
        default:
          return {
            success: false,
            error: 'No email provider configured',
          }
      }
    } catch (error: any) {
      console.error('Error sending email:', error)
      return {
        success: false,
        error: error.message || 'Failed to send email',
      }
    }
  }

  /**
   * Send email via Brevo (Sendinblue)
   */
  private static async sendViaBrevo(options: EmailOptions) {
    try {
      const from = options.from || process.env.BREVO_FROM_EMAIL || 'noreply@example.com'
      const fromName = process.env.BREVO_FROM_NAME || 'Pisairtel CMS'

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'api-key': process.env.BREVO_API_KEY!,
        },
        body: JSON.stringify({
          sender: { name: fromName, email: from },
          to: [{ email: options.to }],
          subject: options.subject,
          htmlContent: options.html,
          textContent: options.text || this.htmlToText(options.html),
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.message || `Brevo error: ${response.status}`)
      }

      return {
        success: true,
        messageId: result.messageId,
      }
    } catch (error: any) {
      throw new Error(`Brevo error: ${error.message}`)
    }
  }

  /**
   * Send email via Resend
   */
  private static async sendViaResend(options: EmailOptions) {
    try {
      const { Resend } = await import('resend')
      const client = new Resend(process.env.RESEND_API_KEY)

      const from = options.from || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

      const result = await client.emails.send({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html),
      })

      if (result.error) {
        throw new Error(result.error.message)
      }

      return {
        success: true,
        messageId: result.data?.id,
      }
    } catch (error: any) {
      throw new Error(`Resend error: ${error.message}`)
    }
  }

  /**
   * Send email via SendGrid
   */
  private static async sendViaSendGrid(options: EmailOptions) {
    try {
      const sgMailModule = await import('@sendgrid/mail')
      const sgMail = sgMailModule.default
      sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

      const from = options.from || process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com'

      const msg = {
        to: options.to,
        from,
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html),
      }

      const result = await sgMail.send(msg)

      return {
        success: true,
        messageId: result[0]?.headers['x-message-id'] as string,
      }
    } catch (error: any) {
      throw new Error(`SendGrid error: ${error.message}`)
    }
  }

  /**
   * Send email via AWS SES
   */
  private static async sendViaSES(options: EmailOptions) {
    try {
      const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses')
      const client = new SESClient({
        region: process.env.AWS_SES_REGION!,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      })

      const from = options.from || process.env.AWS_SES_FROM_EMAIL || 'noreply@example.com'

      const command = new SendEmailCommand({
        Source: from,
        Destination: {
          ToAddresses: [options.to],
        },
        Message: {
          Subject: {
            Data: options.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: options.html,
              Charset: 'UTF-8',
            },
            Text: {
              Data: options.text || this.htmlToText(options.html),
              Charset: 'UTF-8',
            },
          },
        },
      })

      const result = await client.send(command)

      return {
        success: true,
        messageId: result.MessageId,
      }
    } catch (error: any) {
      throw new Error(`AWS SES error: ${error.message}`)
    }
  }

  /**
   * Convert HTML to plain text (simple implementation)
   */
  private static htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()
  }

  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(email: string, resetUrl: string, userName?: string) {
    const subject = 'Reset Your Password'
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">pi-CMS</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin-top: 0;">Reset Your Password</h2>
            <p>Hello${userName ? ` ${userName}` : ''},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Reset Password</a>
            </div>
            <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${resetUrl}</p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} pi-CMS. All rights reserved.</p>
          </div>
        </body>
      </html>
    `

    return this.sendEmail({
      to: email,
      subject,
      html,
    })
  }

  /**
   * Send donation receipt email
   */
  static async sendDonationReceipt(
    email: string,
    receiptData: {
      amount: number
      type: string
      projectName?: string
      transactionId?: string
      date: Date
      receiptUrl?: string
    },
    userName?: string
  ) {
    const subject = 'Thank You for Your Donation'
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">pi-CMS</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin-top: 0;">Thank You for Your Generosity!</h2>
            <p>Hello${userName ? ` ${userName}` : ''},</p>
            <p>We are grateful for your donation. Here are the details:</p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Amount:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #1f2937;">$${receiptData.amount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Type:</td>
                  <td style="padding: 8px 0; text-align: right; color: #1f2937;">${receiptData.type}</td>
                </tr>
                ${receiptData.projectName ? `
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Project:</td>
                  <td style="padding: 8px 0; text-align: right; color: #1f2937;">${receiptData.projectName}</td>
                </tr>
                ` : ''}
                ${receiptData.transactionId ? `
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Transaction ID:</td>
                  <td style="padding: 8px 0; text-align: right; color: #1f2937; font-size: 12px;">${receiptData.transactionId}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Date:</td>
                  <td style="padding: 8px 0; text-align: right; color: #1f2937;">${receiptData.date.toLocaleDateString()}</td>
                </tr>
              </table>
            </div>
            ${receiptData.receiptUrl ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${receiptData.receiptUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Download Receipt</a>
            </div>
            ` : ''}
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">Your generosity makes a difference. Thank you for supporting our mission!</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} pi-CMS. All rights reserved.</p>
          </div>
        </body>
      </html>
    `

    return this.sendEmail({
      to: email,
      subject,
      html,
    })
  }
}

