import { StorageService } from '@/lib/services/storage-service'
import { v4 as uuidv4 } from 'uuid'

export interface MediaUploadOptions {
  file: File
  churchId: string
  type: 'video' | 'audio' | 'thumbnail'
}

export class SermonUploadService {
  /**
   * Upload a media file to local storage (served via /api/files/...)
   */
  static async uploadMedia(options: MediaUploadOptions): Promise<string> {
    const { file, churchId, type } = options

    // Generate unique filename
    const fileExtension = file.name.split('.').pop()
    const fileName = `${uuidv4()}.${fileExtension}`

    const result = await StorageService.uploadFile({
      file,
      fileName,
      folder: `sermons/${churchId}/${type}`,
      churchId,
      contentType: file.type,
    })

    return result.url
  }

  /**
   * Parse and validate media URLs (YouTube, Vimeo, Telegram, direct URLs)
   */
  static parseMediaUrl(url: string): {
    type: 'youtube' | 'vimeo' | 'telegram' | 'direct'
    embedUrl?: string
    originalUrl: string
  } {
    // YouTube
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
    const youtubeMatch = url.match(youtubeRegex)
    if (youtubeMatch) {
      const videoId = youtubeMatch[1]
      return {
        type: 'youtube',
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        originalUrl: url,
      }
    }

    // Vimeo
    const vimeoRegex = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)(?:$|\/|\?)/
    const vimeoMatch = url.match(vimeoRegex)
    if (vimeoMatch) {
      const videoId = vimeoMatch[3]
      return {
        type: 'vimeo',
        embedUrl: `https://player.vimeo.com/video/${videoId}`,
        originalUrl: url,
      }
    }

    // Telegram
    if (url.includes('t.me/') || url.includes('telegram.')) {
      return {
        type: 'telegram',
        embedUrl: url,
        originalUrl: url,
      }
    }

    // Direct URL (mp4, mp3, etc.)
    return {
      type: 'direct',
      originalUrl: url,
    }
  }

  /**
   * Validate file type for uploads
   */
  static validateFileType(file: File, type: 'video' | 'audio' | 'thumbnail'): boolean {
    const videoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
    const audioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

    switch (type) {
      case 'video':
        return videoTypes.includes(file.type)
      case 'audio':
        return audioTypes.includes(file.type)
      case 'thumbnail':
        return imageTypes.includes(file.type)
      default:
        return false
    }
  }

  /**
   * Get file size in MB
   */
  static getFileSizeMB(file: File): number {
    return file.size / (1024 * 1024)
  }
}

