/**
 * Storage Service
 * Handles file uploads to local disk (VPS deployment).
 * Files are stored under UPLOAD_DIR (default /app/uploads, backed by a
 * Docker volume) and served via /api/files/<path>.
 */

import { mkdir, writeFile, unlink, stat } from 'fs/promises'
import { join, normalize, extname } from 'path'
import sharp from 'sharp'

interface UploadOptions {
  file: File | Buffer
  fileName: string
  folder?: string
  userId?: string
  churchId?: string
  contentType?: string
}

interface OptimizedImage {
  buffer: Buffer
  size: 'thumbnail' | 'medium' | 'original'
  width: number
  height: number
  format: string
}

export class StorageService {
  /**
   * Resolve the upload root directory. Kept in sync with the
   * /api/files/[...path] serving route.
   */
  static getUploadDir(): string {
    return process.env.UPLOAD_DIR || '/app/uploads'
  }

  /**
   * Upload a file to local storage
   */
  static async uploadFile(options: UploadOptions): Promise<{ url: string; path: string }> {
    try {
      const { data } = await this.prepareBody(options.file)
      const filePath = this.buildFilePath(options)
      const absPath = join(this.getUploadDir(), filePath)

      await mkdir(join(absPath, '..'), { recursive: true })
      await writeFile(absPath, data)

      return {
        url: `/api/files/${filePath}`,
        path: filePath,
      }
    } catch (error: any) {
      console.error('Error uploading file:', error)
      throw new Error(`File upload failed: ${error.message}`)
    }
  }

  /**
   * Upload image with optimization
   */
  static async uploadImage(
    file: File,
    options: {
      userId?: string
      churchId?: string
      folder?: string
      maxWidth?: number
      maxHeight?: number
      quality?: number
    } = {}
  ): Promise<{ url: string; path: string; urls?: { thumbnail?: string; medium?: string; original?: string } }> {
    try {
      const buffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(buffer)

      // Optimize and resize image
      const optimized = await this.optimizeImage(uint8Array, {
        quality: options.quality || 80,
        maxWidth: options.maxWidth || 512,
        maxHeight: options.maxHeight || 512,
      })

      const baseFileName = file.name || `image-${Date.now()}`
      const nameWithoutExt = baseFileName.substring(0, baseFileName.lastIndexOf('.') || baseFileName.length)
      const ext = 'webp' // Always convert to webp for better compression

      const results: any = {
        urls: {},
      }

      // Upload original (full size) optimized version
      const originalResult = await this.uploadFile({
        file: optimized.original.buffer,
        fileName: `${nameWithoutExt}-orig.${ext}`,
        folder: options.folder || 'avatars',
        userId: options.userId,
        churchId: options.churchId,
        contentType: 'image/webp',
      })

      results.url = originalResult.url
      results.path = originalResult.path
      results.urls.original = originalResult.url

      // Upload medium version (for previews/thumbnails in lists)
      const mediumResult = await this.uploadFile({
        file: optimized.medium.buffer,
        fileName: `${nameWithoutExt}-med.${ext}`,
        folder: options.folder || 'avatars',
        userId: options.userId,
        churchId: options.churchId,
        contentType: 'image/webp',
      })

      results.urls.medium = mediumResult.url

      // Upload thumbnail version (for small displays)
      const thumbResult = await this.uploadFile({
        file: optimized.thumbnail.buffer,
        fileName: `${nameWithoutExt}-thumb.${ext}`,
        folder: options.folder || 'avatars',
        userId: options.userId,
        churchId: options.churchId,
        contentType: 'image/webp',
      })

      results.urls.thumbnail = thumbResult.url

      return results
    } catch (error: any) {
      console.error('Error uploading image:', error)
      throw new Error(`Image upload failed: ${error.message}`)
    }
  }

  /**
   * Optimize image using sharp - resize and compress for web
   */
  private static async optimizeImage(
    imageBuffer: Uint8Array,
    options: { quality?: number; maxWidth?: number; maxHeight?: number } = {}
  ): Promise<{ original: OptimizedImage; medium: OptimizedImage; thumbnail: OptimizedImage }> {
    try {
      const quality = options.quality || 80
      const maxWidth = options.maxWidth || 512

      // Start with the original buffer
      const sharpImage = sharp(Buffer.from(imageBuffer))
      const metadata = await sharpImage.metadata()

      // Calculate dimensions maintaining aspect ratio
      let width = metadata.width || maxWidth
      let height = metadata.height || width

      if (width > maxWidth) {
        const ratio = height / width
        width = maxWidth
        height = Math.round(maxWidth * ratio)
      }

      // Create original size (512x512 max or smaller)
      const original = await sharp(Buffer.from(imageBuffer))
        .resize(Math.min(width, 512), Math.min(height, 512), {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality, effort: 6 })
        .toBuffer()

      // Create medium size (256x256)
      const medium = await sharp(Buffer.from(imageBuffer))
        .resize(256, 256, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: Math.max(quality - 10, 60), effort: 6 })
        .toBuffer()

      // Create thumbnail size (128x128)
      const thumbnail = await sharp(Buffer.from(imageBuffer))
        .resize(128, 128, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: Math.max(quality - 20, 50), effort: 6 })
        .toBuffer()

      return {
        original: {
          buffer: original,
          size: 'original',
          width: Math.min(width, 512),
          height: Math.min(height, 512),
          format: 'webp',
        },
        medium: {
          buffer: medium,
          size: 'medium',
          width: 256,
          height: 256,
          format: 'webp',
        },
        thumbnail: {
          buffer: thumbnail,
          size: 'thumbnail',
          width: 128,
          height: 128,
          format: 'webp',
        },
      }
    } catch (error: any) {
      console.error('Error optimizing image:', error)
      throw new Error(`Image optimization failed: ${error.message}`)
    }
  }

  /**
   * Delete a file from storage
   */
  static async deleteFile(filePath: string): Promise<void> {
    try {
      if (!filePath) return
      const target = this.normalizePath(filePath)
      const absPath = join(this.getUploadDir(), target)
      await unlink(absPath)
    } catch (error: any) {
      // Missing files are fine — treat as already deleted
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return
      console.error('Error deleting file:', error)
      throw new Error(`File deletion failed: ${error.message}`)
    }
  }

  /**
   * Get file URL (if file exists)
   */
  static async getFileUrl(filePath: string): Promise<string | null> {
    try {
      if (!filePath) return null
      const target = this.normalizePath(filePath)
      const absPath = join(this.getUploadDir(), target)
      await stat(absPath)
      return `/api/files/${target}`
    } catch {
      return null
    }
  }

  private static async prepareBody(
    file: File | Buffer,
    contentType?: string,
  ): Promise<{ data: Buffer; contentType: string }> {
    if (typeof File !== 'undefined' && file instanceof File) {
      const arrayBuffer = await file.arrayBuffer()
      return {
        data: Buffer.from(arrayBuffer),
        contentType: contentType || file.type || 'application/octet-stream',
      }
    }

    if (Buffer.isBuffer(file)) {
      return {
        data: file,
        contentType: contentType || 'application/octet-stream',
      }
    }

    throw new Error('Unsupported file type for upload')
  }

  private static buildFilePath(options: UploadOptions): string {
    const timestamp = Date.now()
    const sanitizedFileName = options.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const folder = (options.folder || 'uploads').replace(/^\/+|\/+$/g, '')
    const userSegment = (options.userId || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_')
    return `${folder}/${userSegment}/${timestamp}-${sanitizedFileName}`
  }

  /**
   * Convert a stored URL or raw path into a path relative to UPLOAD_DIR.
   * Rejects traversal outside the upload root.
   */
  private static normalizePath(filePath: string): string {
    if (!filePath) {
      throw new Error('File path is required')
    }
    let target = filePath
    if (target.startsWith('/api/files/')) {
      target = target.slice('/api/files/'.length)
    } else if (target.startsWith('http')) {
      // External URL — nothing to delete locally
      throw new Error('External file URL')
    }
    target = normalize(target).replace(/^(\.\.(\/|\\|$))+/, '')
    return target.replace(/^\/+/, '')
  }
}
