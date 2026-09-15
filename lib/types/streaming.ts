// Multi-Platform Streaming Types
// Enums re-exported from Prisma so service-layer types stay unified
// (identical member sets in schema.prisma)

import {
  StreamingPlatform,
  PlatformConnectionStatus,
  MeetingStatus,
  MeetingPlatformStatus,
  LivestreamStatus,
  LivestreamPlatformStatus,
} from '@prisma/client'

export {
  StreamingPlatform,
  PlatformConnectionStatus,
  MeetingStatus,
  MeetingPlatformStatus,
  LivestreamStatus,
  LivestreamPlatformStatus,
}

export interface PlatformCredentials {
  accessToken?: string
  refreshToken?: string
  apiKey?: string
  apiSecret?: string
  webhookSecret?: string
  channelId?: string
  pageId?: string
  instagramUserId?: string
  igUserId?: string
  [key: string]: any
}

export interface PlatformConnectionData {
  id: string
  churchId: string
  platform: StreamingPlatform
  status: PlatformConnectionStatus
  credentials: PlatformCredentials
  expiresAt?: Date
  lastError?: string
  lastErrorAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface LivestreamPlatformSettings {
  title?: string
  description?: string
  thumbnail?: string
  [key: string]: any
}

export interface LivestreamData {
  id: string
  churchId: string
  title: string
  description?: string
  thumbnail?: string
  status: LivestreamStatus
  startAt: Date
  endAt?: Date
  createdBy: string
  createdAt: Date
  updatedAt: Date
  platforms?: LivestreamPlatformData[]
}

export interface LivestreamPlatformData {
  id: string
  platform: StreamingPlatform
  status: LivestreamPlatformStatus
  url?: string
  error?: string
  settings?: LivestreamPlatformSettings
}

export interface MeetingPlatformData {
  id: string
  meetingId: string
  platform: StreamingPlatform
  platformMeetingId?: string | null
  url?: string | null
  status: MeetingPlatformStatus
  error?: string | null
  settings?: unknown
  createdAt: Date
  updatedAt: Date
}

export interface MeetingData {
  id: string
  churchId: string
  title: string
  description?: string
  status: string
  startAt: Date
  endAt: Date
  primaryPlatform?: StreamingPlatform
  createdBy: string
  createdAt: Date
  updatedAt: Date
  platforms?: MeetingPlatformData[]
}
