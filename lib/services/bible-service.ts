import { prisma } from '@/lib/prisma'
import { DEFAULT_BIBLE_VERSION, BIBLE_VERSIONS } from '@/lib/bible/config'

const API_BASE_URL = 'https://rest.api.bible/v1'

export interface BiblePassage {
  bibleId: string
  passageId: string
  reference: string
  content: string
  html?: string
  copyright?: string
  fetchedAt: Date
}

export interface BibleSearchResult {
  verseId: string
  reference: string
  text: string
}

export function getBibleVersionById(bibleId?: string) {
  if (!bibleId) return DEFAULT_BIBLE_VERSION
  return BIBLE_VERSIONS.find((version) => version.id === bibleId) || DEFAULT_BIBLE_VERSION
}

function getApiKey() {
  const apiKey = process.env.API_BIBLE_KEY
  if (!apiKey) {
    throw new Error('API_BIBLE_KEY is not configured. Please add it to your environment.')
  }
  return apiKey
}

async function fetchFromBibleApi(path: string, searchParams?: Record<string, string>) {
  const apiKey = getApiKey()
  const url = new URL(`${API_BASE_URL}${path}`)
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value) url.searchParams.append(key, value)
    })
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Bible API error (${response.status}): ${errorBody}`)
  }

  return response.json()
}

async function getPassageCacheDocId(bibleId: string, passageId: string) {
  return `${bibleId}::${passageId}`
}

export class BibleService {
  static async getPassage(bibleId: string, passageId: string): Promise<BiblePassage> {
    const docId = await getPassageCacheDocId(bibleId, passageId)
    const cached = await prisma.biblePassageCache.findUnique({ where: { id: docId } })

    if (cached) {
      return {
        bibleId: cached.bibleId,
        passageId: cached.passageId,
        reference: cached.reference,
        content: cached.content,
        html: cached.html ?? undefined,
        copyright: cached.copyright ?? undefined,
        fetchedAt: cached.fetchedAt,
      }
    }

    const result = await fetchFromBibleApi(`/bibles/${bibleId}/passages/${encodeURIComponent(passageId)}`, {
      'content-type': 'text',
      'include-titles': 'true',
      'include-notes': 'false',
      'include-chapter-numbers': 'true',
      'include-verse-numbers': 'true',
      'use-org-id': 'false',
    })

    const passageData = result?.data
    if (!passageData) {
      throw new Error('Bible API returned no data for the requested passage.')
    }

    await prisma.biblePassageCache.upsert({
      where: { id: docId },
      update: {},
      create: {
        id: docId,
        bibleId,
        passageId,
        reference: passageData.reference,
        content: passageData.content,
        html: passageData.content,
        copyright: passageData.copyright ?? null,
      },
    })

    return {
      bibleId,
      passageId,
      reference: passageData.reference,
      content: passageData.content,
      html: passageData.content,
      copyright: passageData.copyright,
      fetchedAt: new Date(),
    }
  }

  static async searchPassage(bibleId: string, query: string): Promise<BibleSearchResult | null> {
    const response = await fetchFromBibleApi(`/bibles/${bibleId}/search`, {
      query,
      'sort': 'relevance',
      'limit': '1',
    })

    const data = response?.data
    const matches = data?.passages
    if (!matches || matches.length === 0) {
      return null
    }

    const match = matches[0]
    return {
      verseId: match.id,
      reference: match.reference,
      text: match.content || match.text,
    }
  }
}
