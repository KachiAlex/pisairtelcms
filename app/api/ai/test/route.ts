
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getSpiritualCoachingResponse } from '@/lib/ai/openai'

/**
 * Test endpoint to verify DeepSeek API is working
 * This endpoint can be called to check if AI is properly configured
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['ADMIN', 'SUPER_ADMIN'].includes((session.user as any)?.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const testQuestion = 'What is prayer?'
    
    const response = await getSpiritualCoachingResponse(testQuestion, {
      userMaturity: 'beginner',
    })

    // Check if we got a valid response
    if (response && !response.includes('not available') && !response.includes('configure')) {
      return NextResponse.json({
        success: true,
        message: 'DeepSeek API is working correctly!',
        provider: process.env.DEEPSEEK_API_KEY ? 'DeepSeek' : 'OpenAI',
        model: process.env.DEEPSEEK_API_KEY 
          ? (process.env.DEEPSEEK_MODEL || 'deepseek-chat')
          : (process.env.OPENAI_MODEL || 'gpt-4'),
        testResponse: response.substring(0, 100) + '...', // First 100 chars
        timestamp: new Date().toISOString(),
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'AI API is not properly configured',
        error: response,
        provider: process.env.DEEPSEEK_API_KEY ? 'DeepSeek (not working)' : 'None configured',
      }, { status: 500 })
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'Error testing AI API',
      error: error.message,
      provider: process.env.DEEPSEEK_API_KEY ? 'DeepSeek' : 'OpenAI',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 })
  }
}
