
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

/**
 * Public health check endpoint - no authentication required
 * Checks if the application is running and if AI services are configured
 */
export async function GET() {
  try {
    const aiConfigured = !!(process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY)
    const provider = process.env.DEEPSEEK_API_KEY ? 'DeepSeek' : 
                     process.env.OPENAI_API_KEY ? 'OpenAI' : 
                     'Not configured'
    
    const model = process.env.DEEPSEEK_API_KEY 
      ? (process.env.DEEPSEEK_MODEL || 'deepseek-chat')
      : (process.env.OPENAI_MODEL || 'gpt-4')

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        ai: {
          configured: aiConfigured,
          provider: provider,
          model: aiConfigured ? model : undefined,
        },
        firebase: {
          configured: !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT),
        },
        auth: {
          configured: !!(process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_URL),
        },
        email: {
          configured: !!(
            process.env.BREVO_API_KEY ||
            process.env.RESEND_API_KEY || 
            process.env.SENDGRID_API_KEY || 
            (process.env.AWS_SES_REGION && process.env.AWS_ACCESS_KEY_ID)
          ),
        },
      },
    })
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
