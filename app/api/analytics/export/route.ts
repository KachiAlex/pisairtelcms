import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurchId } from '@/lib/church-context'
import { ExportService } from '@/lib/services/export-service'
import { AnalyticsService } from '@/lib/services/analytics-service'
import { formatChartDataByInterval, ChartDataPoint } from '@/lib/types/chart-types'

/**
 * POST /api/analytics/export
 * Export analytics data as PDF, CSV, or JSON.
 * The church is always derived from the authenticated session; SUPER_ADMIN may
 * override it with `church` in the body.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      type,
      metric = 'meetings',
      startDate,
      endDate,
      interval = 'daily',
      title = `${metric} Export`,
      includeChart = false,
      includeData = true,
      includeMetadata = true,
      church: requestedChurch,
    } = body

    const isSuperAdmin = (session?.user as any)?.role === 'SUPER_ADMIN'
    const church = isSuperAdmin && requestedChurch
      ? requestedChurch
      : await getCurrentChurchId(userId)

    if (!church) {
      return NextResponse.json({ success: false, error: 'No church selected' }, { status: 400 })
    }

    // Validate request
    if (!['pdf', 'csv', 'json'].includes(type)) {
      return NextResponse.json({ success: false, error: 'Invalid export type' }, { status: 400 })
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'startDate and endDate are required' }, { status: 400 })
    }

    // Fetch data based on metric
    let rawData: ChartDataPoint[] = []

    try {
      switch (metric) {
        case 'meetings': {
          const meetingData = await AnalyticsService.getChurchMeetingAnalytics(
            church,
            new Date(startDate),
            new Date(endDate)
          )
          rawData = (meetingData || []).map((item: any, index: number) => ({
            time: item.scheduledDate?.toDate?.() || item.scheduledDate || new Date(),
            value: item.attendeeCount || item.count || 0,
            label: new Date(item.scheduledDate?.toDate?.() || item.scheduledDate || new Date()).toLocaleDateString() || `Day ${index + 1}`,
            metadata: {
              date: item.scheduledDate,
              duration: item.duration,
              title: item.title,
            },
          }))
          break
        }

        case 'attendance': {
          const attendanceData = await AnalyticsService.getAttendanceAnalytics(
            church,
            new Date(startDate),
            new Date(endDate)
          )
          rawData = (attendanceData || []).map((item: any, index: number) => ({
            time: item.eventDate?.toDate?.() || item.eventDate || new Date(),
            value: item.attendeesPresent || item.present || 0,
            label: new Date(item.eventDate?.toDate?.() || item.eventDate || new Date()).toLocaleDateString() || `Day ${index + 1}`,
            metadata: {
              date: item.eventDate,
              totalExpected: item.totalExpected,
              absent: item.totalExpected ? item.totalExpected - (item.attendeesPresent || 0) : 0,
            },
          }))
          break
        }

        default: {
          rawData = []
        }
      }
    } catch (error) {
      console.warn(`Warning fetching ${metric} data:`, error)
      rawData = []
    }

    // Format data by interval
    const formattedData = formatChartDataByInterval(rawData, interval as any)

    // Validate data
    const validation = ExportService.validateExportData(formattedData)
    if (!validation.valid) {
      console.warn('Export data validation warnings:', validation.errors)
    }

    // Calculate metrics for PDF
    const metrics = {
      totalValue: formattedData.reduce((sum, p) => sum + p.value, 0),
      averageValue: formattedData.length > 0 ? formattedData.reduce((sum, p) => sum + p.value, 0) / formattedData.length : 0,
      peakValue: Math.max(...formattedData.map((p) => p.value), 0),
    }

    // Generate export file
    let content: Buffer | string
    let filename: string
    let contentType: string

    switch (type) {
      case 'pdf': {
        const config = {
          id: metric,
          title,
          type: 'line' as const,
          datasets: [{ label: metric, data: formattedData }],
          timeInterval: interval as any,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        }

        content = await ExportService.generatePDF(
          formattedData,
          config,
          {
            title,
            subtitle: `${metric.charAt(0).toUpperCase() + metric.slice(1)} Report`,
            includeChart,
            includeData,
            includeMetadata,
            metrics,
          }
        )
        filename = ExportService.formatFilename(`${metric}_report`, 'pdf', true)
        contentType = 'application/pdf'
        break
      }

      case 'csv': {
        const config = {
          id: metric,
          title,
          type: 'line' as const,
          datasets: [{ label: metric, data: formattedData }],
          timeInterval: interval as any,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        }

        content = await ExportService.generateCSV(formattedData, config, {
          filename: metric,
          includeTimestamp: true,
        })
        filename = ExportService.formatFilename(`${metric}_data`, 'csv', true)
        contentType = 'text/csv'
        break
      }

      case 'json': {
        const config = {
          id: metric,
          title,
          type: 'line' as const,
          datasets: [{ label: metric, data: formattedData }],
          timeInterval: interval as any,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        }

        content = await ExportService.generateJSON(formattedData, config)
        filename = ExportService.formatFilename(`${metric}_data`, 'json', true)
        contentType = 'application/json'
        break
      }

      default:
        return NextResponse.json({ success: false, error: 'Export type not supported' }, { status: 400 })
    }

    // Return file as download
    const buffer = typeof content === 'string' ? Buffer.from(content) : content
    const uint8Array = new Uint8Array(buffer)

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Export API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed',
      },
      { status: 500 }
    )
  }
}
