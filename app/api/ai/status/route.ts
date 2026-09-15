import { NextResponse } from 'next/server'
import { getSpiritualCoachingResponse } from '@/lib/ai/openai'

export const dynamic = 'force-dynamic'

function getProviderInfo(): { provider: string; model: string } {
  if (process.env.GROQ_API_KEY) {
    return { provider: 'Groq', model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b' }
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return { provider: 'DeepSeek', model: process.env.DEEPSEEK_MODEL || 'deepseek-chat' }
  }
  return { provider: 'OpenAI', model: process.env.OPENAI_MODEL || 'gpt-4' }
}

/**
 * Public AI status check endpoint
 * Tests if AI is actually working with a simple test query
 */
export async function GET() {
  try {
    const testQuestion = 'What is faith?'
    const { provider, model } = getProviderInfo()

    // Quick test to see if AI responds
    const startTime = Date.now()
    const response = await getSpiritualCoachingResponse(testQuestion)
    const duration = Date.now() - startTime

    // Check if we got a valid response
    const isWorking = response &&
                     !response.includes('not available') &&
                     !response.includes('configure') &&
                     !response.includes('Failed to get AI response') &&
                     !response.includes('try again later') &&
                     response.length > 20

    if (isWorking) {
      return NextResponse.json({
        status: 'operational',
        provider,
        model,
        responseTime: `${duration}ms`,
        testResponse: response.substring(0, 150) + '...',
        timestamp: new Date().toISOString(),
      })
    } else {
      return NextResponse.json({
        status: 'error',
        message: 'AI not properly configured',
        details: response,
        provider: provider === 'OpenAI' && !process.env.OPENAI_API_KEY ? 'None' : `${provider} (not working)`,
        timestamp: new Date().toISOString(),
      }, { status: 503 })
    }
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: 'AI service error',
      error: error.message,
      provider: getProviderInfo().provider,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
