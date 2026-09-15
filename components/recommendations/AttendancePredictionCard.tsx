'use client'

import React, { useState } from 'react'
import { usePredictAttendance } from '@/hooks/useRecommendations'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

/**
 * AttendancePredictionCard
 * Shows attendance predictions with confidence levels
 */
export function AttendancePredictionCard({ eventType, dayOfWeek, timeOfDay }: {
  eventType: string
  dayOfWeek: string
  timeOfDay: string
}) {
  const { predictions, isPredicting, predictEvent } = usePredictAttendance()
  const [showDetails, setShowDetails] = useState(false)

  const handlePredict = async () => {
    await predictEvent({
      eventType,
      dayOfWeek,
      timeOfDay,
      historicalEvents: [], // Would come from prayer/event analytics
      specialFactors: [],
    })
  }

  const prediction = predictions.find(
    (p) =>
      p.eventId.includes(dayOfWeek) && 
      p.eventId.includes(timeOfDay)
  )

  if (!prediction && !isPredicting) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Predict Attendance
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Get AI-powered predictions for event attendance based on historical data
          </p>
          <Button
            onClick={handlePredict}
            disabled={isPredicting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isPredicting ? 'Generating...' : 'Generate Prediction'}
          </Button>
        </div>
      </Card>
    )
  }

  if (isPredicting) {
    return (
      <Card className="p-6 animate-pulse space-y-4">
        <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-3/4" />
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2" />
        <div className="h-40 bg-gray-300 dark:bg-gray-600 rounded" />
      </Card>
    )
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Attendance Prediction
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {dayOfWeek} • {timeOfDay}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
          prediction?.confidence === 'very_high'
            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
            : prediction?.confidence === 'high'
            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
            : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
        }`}>
          {prediction?.confidence?.toUpperCase()} Confidence
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
          <p className="text-xs text-gray-600 dark:text-gray-400">Predicted</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {prediction?.predictedAttendance}
          </p>
        </div>
        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded">
          <p className="text-xs text-gray-600 dark:text-gray-400">Trend</p>
          <p className="text-lg font-semibold text-purple-600 dark:text-purple-400">
            {prediction?.trend === 'increasing' ? '📈' : prediction?.trend === 'decreasing' ? '📉' : '➡️'}
            {' '}{prediction?.trend ? prediction.trend.charAt(0).toUpperCase() + prediction.trend.slice(1) : 'Stable'}
          </p>
        </div>
        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded">
          <p className="text-xs text-gray-600 dark:text-gray-400">Factors</p>
          <p className="text-lg font-semibold text-orange-600 dark:text-orange-400">
            {prediction?.factors?.length || 0}
          </p>
        </div>
      </div>

      {/* Factors */}
      <div className="space-y-2">
        <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
          Influential Factors
        </h4>
        <div className="space-y-2">
          {prediction?.factors?.map((factor, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {factor.name}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {factor.description}
                </p>
              </div>
              <span className={`font-semibold text-sm whitespace-nowrap ${
                factor.impact > 0 ? 'text-green-600' : factor.impact < 0 ? 'text-red-600' : 'text-gray-600'
              }`}>
                {factor.impact > 0 ? '+' : ''}{(factor.impact * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {prediction?.recommendations && prediction.recommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
            Suggestions
          </h4>
          <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            {prediction.recommendations.map((rec, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="text-blue-500">→</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
