import { execFile } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'
import { join } from 'path'
import { readFile, unlink } from 'fs/promises'
import crypto from 'crypto'
import { StorageService } from './storage-service'

const execFileAsync = promisify(execFile)

const YOUTUBE_RE =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
const VIMEO_RE =
  /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)(?:$|\/|\?)/
const DIRECT_VIDEO_RE = /\.(mp4|webm|mov|m4v|mkv)([?#].*)?$/i

const FFMPEG_TIMEOUT_MS = 45_000

export interface VideoMeta {
  thumbnailUrl?: string
  durationSeconds?: number
}

/**
 * Best-effort media metadata for sermon videos — never throws.
 *
 * - YouTube/Vimeo embeds: thumbnail pulled from the platform's public
 *   image/oEmbed endpoints (hotlinked, no upload needed).
 * - Direct video URLs (mp4/webm/...): ffmpeg grabs the first meaningful
 *   frame and ffprobe reports duration — requires ffmpeg in the image;
 *   degrades to {} when unavailable or the URL is unreachable.
 */
export class SermonMediaService {
  static async resolveVideoMeta(
    videoUrl: string,
    ctx: { churchId: string; userId?: string }
  ): Promise<VideoMeta> {
    try {
      const yt = videoUrl.match(YOUTUBE_RE)
      if (yt) {
        // hqdefault always exists (maxresdefault 404s on low-res uploads)
        return { thumbnailUrl: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` }
      }

      const vm = videoUrl.match(VIMEO_RE)
      if (vm) {
        return await this.vimeoMeta(videoUrl)
      }

      if (DIRECT_VIDEO_RE.test(videoUrl)) {
        return await this.ffmpegMeta(videoUrl, ctx)
      }
    } catch (error) {
      console.warn('SermonMediaService.resolveVideoMeta failed:', error)
    }
    return {}
  }

  private static async vimeoMeta(videoUrl: string): Promise<VideoMeta> {
    const res = await fetch(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoUrl)}`,
      { signal: AbortSignal.timeout(10_000) }
    )
    if (!res.ok) return {}
    const data = (await res.json()) as { thumbnail_url?: string }
    return { thumbnailUrl: data.thumbnail_url }
  }

  private static async ffmpegMeta(
    videoUrl: string,
    ctx: { churchId: string; userId?: string }
  ): Promise<VideoMeta> {
    const meta: VideoMeta = {}

    try {
      const { stdout } = await execFileAsync(
        'ffprobe',
        [
          '-v', 'error',
          '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1',
          videoUrl,
        ],
        { timeout: FFMPEG_TIMEOUT_MS }
      )
      const seconds = Math.round(parseFloat(stdout.trim()))
      if (Number.isFinite(seconds) && seconds > 0) meta.durationSeconds = seconds
    } catch {
      // ffprobe missing or URL unreadable — duration stays unset
    }

    const tmpPath = join(tmpdir(), `sermon-thumb-${crypto.randomUUID()}.jpg`)
    try {
      await execFileAsync(
        'ffmpeg',
        [
          '-v', 'error',
          '-ss', '1',
          '-i', videoUrl,
          '-frames:v', '1',
          '-q:v', '3',
          '-f', 'image2',
          '-y', tmpPath,
        ],
        { timeout: FFMPEG_TIMEOUT_MS }
      )
      const frame = await readFile(tmpPath)
      if (frame.length > 0) {
        const upload = await StorageService.uploadFile({
          file: frame,
          fileName: `${crypto.randomUUID()}.jpg`,
          folder: `sermons/${ctx.churchId}/thumbnail`,
          userId: ctx.userId,
          churchId: ctx.churchId,
          contentType: 'image/jpeg',
        })
        meta.thumbnailUrl = upload.url
      }
    } catch {
      // ffmpeg missing or extraction failed — thumbnail stays unset
    } finally {
      await unlink(tmpPath).catch(() => {})
    }

    return meta
  }
}
