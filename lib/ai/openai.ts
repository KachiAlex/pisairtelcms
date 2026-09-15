import OpenAI from 'openai'

// Groq and DeepSeek APIs are OpenAI-compatible, so we can use the OpenAI SDK
// Groq endpoint: https://api.groq.com/openai/v1 — key: https://console.groq.com/keys
// DeepSeek endpoint: https://api.deepseek.com — key: https://platform.deepseek.com/api_keys

type Provider = 'groq' | 'deepseek' | 'openai'

const provider: Provider = process.env.GROQ_API_KEY
  ? 'groq'
  : process.env.DEEPSEEK_API_KEY
    ? 'deepseek'
    : 'openai'

const apiKey =
  process.env.GROQ_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY

if (!apiKey) {
  console.warn('GROQ_API_KEY, DEEPSEEK_API_KEY or OPENAI_API_KEY not set. AI features will be disabled.')
}

const BASE_URLS: Record<Provider, string | undefined> = {
  groq: 'https://api.groq.com/openai/v1',
  deepseek: 'https://api.deepseek.com',
  openai: undefined, // SDK default
}

const openai = apiKey
  ? new OpenAI({
      apiKey: apiKey,
      baseURL: BASE_URLS[provider],
    })
  : null

/**
 * Get the model name based on the active provider
 * Groq models: openai/gpt-oss-120b, openai/gpt-oss-20b, qwen/qwen3-32b, etc.
 * DeepSeek models: deepseek-chat, deepseek-coder
 */
function getModel(): string {
  if (provider === 'groq') {
    return process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
  }
  if (provider === 'deepseek') {
    return process.env.DEEPSEEK_MODEL || 'deepseek-chat'
  }
  return process.env.OPENAI_MODEL || 'gpt-4'
}

/**
 * Get AI spiritual coaching response
 */
export async function getSpiritualCoachingResponse(
  question: string,
  context?: {
    userMaturity?: string
    recentTopics?: string[]
    churchContext?: string
  }
): Promise<string> {
  if (!openai) {
    return 'AI coaching is not available. Please configure GROQ_API_KEY, DEEPSEEK_API_KEY or OPENAI_API_KEY.'
  }

  try {
    const systemPrompt = `You are a wise, compassionate spiritual coach helping Christians grow in their faith. 
Your responses should be:
- Bible-based and theologically sound
- Encouraging and supportive
- Practical and actionable
- Appropriate for the user's spiritual maturity level
- Focused on discipleship and spiritual growth

Always reference specific Bible verses when relevant. Be warm, understanding, and guide users toward deeper relationship with God.`

    const userPrompt = context?.userMaturity
      ? `User's spiritual maturity: ${context.userMaturity}\n\nQuestion: ${question}`
      : question

    const completion = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    })

    return completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.'
  } catch (error: any) {
    console.error('AI API error:', error)

    if (error?.response?.status === 401 || error?.code === 'invalid_request_error') {
      return 'AI coaching is temporarily unavailable because the API key is invalid. Please verify the key in your settings.'
    }

    if (error.message?.includes('API key')) {
      return 'AI service configuration error. Please check your API key.'
    }
    if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
      return 'AI service rate limit reached. Please try again later.'
    }
    if (error.message?.includes('timeout')) {
      return 'AI service timeout. Please try again.'
    }

    return 'Failed to get AI response. Please try again later.'
  }
}

/**
 * Reading coach structured response
 */
export interface ReadingCoachContextPayload {
  user?: {
    name?: string
    spiritualMaturity?: string
    churchContext?: string
  }
  plan?: {
    title: string
    duration: number
    topics?: string[]
  } | null
  progress?: {
    currentDay: number
    totalDays?: number
    percentComplete?: number
    completed?: boolean
  } | null
  day?: {
    dayNumber: number
    title?: string
    summary?: string
    prayerFocus?: string
  } | null
  passage?: {
    reference?: string
    excerpt?: string
  } | null
  resources?: Array<{
    title: string
    type?: string
    description?: string
  }>
  dailyVerse?: {
    reference: string
    theme: string
    excerpt?: string
  }
}

export interface ReadingCoachAIResponse {
  answer: string
  actionStep?: string
  encouragement?: string
  scriptures?: string[]
  followUpQuestion?: string
  insights?: string[]
}

function extractJsonFromText(text: string) {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    return trimmed
  }
  const jsonBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/)
  if (jsonBlockMatch) {
    return jsonBlockMatch[1]
  }
  return trimmed
}

export async function getReadingCoachResponse(input: {
  question: string
  context: ReadingCoachContextPayload
}): Promise<ReadingCoachAIResponse> {
  if (!openai) {
    return {
      answer: 'AI Reading Coach is not available right now. Please try again later.',
    }
  }

  try {
    const systemPrompt = `You are pi-CMS's AI Reading Coach. Ground every response in Scripture, highlight practical next steps, and keep a pastoral, encouraging tone.
Always respond in JSON with this shape:
{
  "answer": string, // conversational multi-paragraph response
  "actionStep": string, // single practical next action
  "encouragement": string, // short uplifting note
  "scriptures": string[], // list of references mentioned
  "followUpQuestion": string, // optional thoughtful follow-up for the reader
  "insights": string[] // optional bullet insights about their progress or passage
}`

    const userPrompt = `Question: ${input.question}
Context: ${JSON.stringify(input.context)}`

    const completion = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 800,
    })

    const raw = completion.choices[0]?.message?.content || ''
    const jsonString = extractJsonFromText(raw)
    const parsed = JSON.parse(jsonString)
    return {
      answer: parsed.answer || 'I hope this reading encouraged you today.',
      actionStep: parsed.actionStep,
      encouragement: parsed.encouragement,
      scriptures: parsed.scriptures,
      followUpQuestion: parsed.followUpQuestion,
      insights: parsed.insights,
    }
  } catch (error: any) {
    console.error('Reading coach AI error:', error)
    return {
      answer: 'I ran into an issue preparing your coaching insight. Please try again in a moment.',
    }
  }
}

/**
 * Generate a personalized spiritual growth plan
 */
export async function generateSpiritualGrowthPlan(
  userProfile: {
    spiritualMaturity?: string
    currentPractices?: string[]
    goals?: string[]
    challenges?: string[]
  }
): Promise<{
  plan: {
    title: string
    description: string
    duration: number // in days
    goals: Array<{ title: string; description: string; steps: string[] }>
    practices: Array<{ title: string; description: string; frequency: string }>
    milestones: Array<{ week: number; description: string }>
  }
}> {
  if (!openai) {
    return {
      plan: {
        title: 'Spiritual Growth Plan',
        description: 'AI growth plan generation is not available. Please configure GROQ_API_KEY, DEEPSEEK_API_KEY or OPENAI_API_KEY.',
        duration: 30,
        goals: [],
        practices: [],
        milestones: [],
      },
    }
  }

  try {
    const systemPrompt = `You are a spiritual growth coach creating personalized growth plans for Christians.
Create a comprehensive, practical growth plan based on the user's profile. Include specific goals, daily/weekly practices, and milestones.`

    const userPrompt = `User Profile:
- Spiritual Maturity: ${userProfile.spiritualMaturity || 'Not specified'}
- Current Practices: ${userProfile.currentPractices?.join(', ') || 'None'}
- Goals: ${userProfile.goals?.join(', ') || 'General spiritual growth'}
- Challenges: ${userProfile.challenges?.join(', ') || 'None specified'}

Generate a personalized 30-day spiritual growth plan in JSON format: {
  plan: {
    title: string,
    description: string,
    duration: 30,
    goals: [{ title, description, steps: string[] }],
    practices: [{ title, description, frequency: string }],
    milestones: [{ week: number, description: string }]
  }
}`

    const completion = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    })

    const response = completion.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(response)
    return parsed
  } catch (error: any) {
    console.error('AI API error:', error)
    return {
      plan: {
        title: 'Spiritual Growth Plan',
        description: 'Unable to generate personalized plan. Please try again.',
        duration: 30,
        goals: [],
        practices: [],
        milestones: [],
      },
    }
  }
}

/**
 * Generate sermon summary from description
 */
export async function generateSermonSummary(
  description: string,
  title?: string
): Promise<string> {
  if (!openai) {
    return description.substring(0, 200) + '...' // Fallback to truncated description
  }

  try {
    const systemPrompt = `You are a sermon summarizer. Create a concise, engaging summary of sermons that highlights key points and biblical themes.`

    const userPrompt = title
      ? `Sermon Title: ${title}\n\nDescription: ${description}\n\nCreate a concise summary (2-3 sentences).`
      : `Sermon Description: ${description}\n\nCreate a concise summary (2-3 sentences).`

    const completion = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
    })

    return completion.choices[0]?.message?.content || description.substring(0, 200) + '...'
  } catch (error: any) {
    console.error('AI API error:', error)
    return description.substring(0, 200) + '...' // Fallback
  }
}

/**
 * Generate personalized reading plan recommendations
 */
export async function recommendReadingPlans(
  userProfile: {
    spiritualMaturity?: string
    interests?: string[]
    completedPlans?: string[]
    preferredDuration?: number
  }
): Promise<{
  recommendations: Array<{
    title: string
    description: string
    duration: number
    topics: string[]
    difficulty: string
    reason: string
  }>
}> {
  if (!openai) {
    return {
      recommendations: [],
    }
  }

  try {
    const systemPrompt = `You are a Bible reading plan recommender. Analyze the user's profile and recommend 3-5 personalized reading plans.
Each recommendation should include: title, description, duration (in days), topics (array), difficulty (beginner/intermediate/advanced), and reason for recommendation.`

    const userPrompt = `User Profile:
- Spiritual Maturity: ${userProfile.spiritualMaturity || 'Not specified'}
- Interests: ${userProfile.interests?.join(', ') || 'Not specified'}
- Completed Plans: ${userProfile.completedPlans?.join(', ') || 'None'}
- Preferred Duration: ${userProfile.preferredDuration || 'Flexible'} days

Recommend 3-5 reading plans in JSON format: { recommendations: [{ title, description, duration, topics, difficulty, reason }] }`

    const completion = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })

    const response = completion.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(response)
    return parsed
  } catch (error: any) {
    console.error('AI API error:', error)
    return {
      recommendations: [],
    }
  }
}
