import { describe, expect, it, beforeEach } from 'vitest'
import { SurveyValidation } from '@/lib/utils/survey-validation'
import type { CreateSurveyRequest, SubmitSurveyResponseRequest } from '@/types/survey'

describe('Survey Data Model Validation', () => {
  describe('Survey Creation Validation', () => {
    it('should validate valid survey creation request', () => {
      const validSurvey: CreateSurveyRequest = {
        title: 'Test Survey',
        description: 'A test survey for validation',
        questions: [
          {
            type: 'MULTIPLE_CHOICE',
            title: 'What is your favorite color?',
            description: 'Choose one option',
            required: true,
            options: [
              { text: 'Red', order: 1 },
              { text: 'Blue', order: 2 }
            ]
          },
          {
            type: 'TEXT',
            title: 'Any comments?',
            required: false
          }
        ],
        settings: {
          isAnonymous: false,
          allowMultipleResponses: false,
          targetAudienceType: 'ALL',
          sendOnPublish: true,
          sendReminders: true,
          reminderDays: [3, 1]
        }
      }

      const result = SurveyValidation.validateCreateSurvey(validSurvey)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject survey with missing title', () => {
      const invalidSurvey: CreateSurveyRequest = {
        title: '',
        questions: [
          {
            type: 'TEXT',
            title: 'Test question',
            required: false
          }
        ],
        settings: {
          isAnonymous: false,
          allowMultipleResponses: false,
          targetAudienceType: 'ALL',
          sendOnPublish: true,
          sendReminders: false,
          reminderDays: []
        }
      }

      const result = SurveyValidation.validateCreateSurvey(invalidSurvey)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Survey title is required')
    })

    it('should reject survey with title too long', () => {
      const longTitle = 'A'.repeat(201)
      const invalidSurvey: CreateSurveyRequest = {
        title: longTitle,
        questions: [
          {
            type: 'TEXT',
            title: 'Test question',
            required: false
          }
        ],
        settings: {
          isAnonymous: false,
          allowMultipleResponses: false,
          targetAudienceType: 'ALL',
          sendOnPublish: true,
          sendReminders: false,
          reminderDays: []
        }
      }

      const result = SurveyValidation.validateCreateSurvey(invalidSurvey)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Survey title must be less than 200 characters')
    })

    it('should reject survey with no questions', () => {
      const invalidSurvey: CreateSurveyRequest = {
        title: 'Test Survey',
        questions: [],
        settings: {
          isAnonymous: false,
          allowMultipleResponses: false,
          targetAudienceType: 'ALL',
          sendOnPublish: true,
          sendReminders: false,
          reminderDays: []
        }
      }

      const result = SurveyValidation.validateCreateSurvey(invalidSurvey)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Survey must have at least one question')
    })

    it('should reject survey with too many questions', () => {
      const tooManyQuestions = Array.from({ length: 51 }, (_, i) => ({
        type: 'TEXT' as const,
        title: `Question ${i + 1}`,
        required: false
      }))

      const invalidSurvey: CreateSurveyRequest = {
        title: 'Test Survey',
        questions: tooManyQuestions,
        settings: {
          isAnonymous: false,
          allowMultipleResponses: false,
          targetAudienceType: 'ALL',
          sendOnPublish: true,
          sendReminders: false,
          reminderDays: []
        }
      }

      const result = SurveyValidation.validateCreateSurvey(invalidSurvey)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Survey cannot have more than 50 questions')
    })
  })

  describe('Question Validation', () => {
    it('should validate multiple choice questions with valid options', () => {
      const validSurvey: CreateSurveyRequest = {
        title: 'Test Survey',
        questions: [
          {
            type: 'MULTIPLE_CHOICE',
            title: 'Choose your preference',
            required: true,
            options: [
              { text: 'Option 1', order: 1 },
              { text: 'Option 2', order: 2 },
              { text: 'Option 3', order: 3 }
            ]
          }
        ],
        settings: {
          isAnonymous: false,
          allowMultipleResponses: false,
          targetAudienceType: 'ALL',
          sendOnPublish: true,
          sendReminders: false,
          reminderDays: []
        }
      }

      const result = SurveyValidation.validateCreateSurvey(validSurvey)
      expect(result.isValid).toBe(true)
    })

    it('should reject multiple choice questions with insufficient options', () => {
      const invalidSurvey: CreateSurveyRequest = {
        title: 'Test Survey',
        questions: [
          {
            type: 'MULTIPLE_CHOICE',
            title: 'Choose your preference',
            required: true,
            options: [
              { text: 'Only Option', order: 1 }
            ]
          }
        ],
        settings: {
          isAnonymous: false,
          allowMultipleResponses: false,
          targetAudienceType: 'ALL',
          sendOnPublish: true,
          sendReminders: false,
          reminderDays: []
        }
      }

      const result = SurveyValidation.validateCreateSurvey(invalidSurvey)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('must have at least 2 options'))).toBe(true)
    })

    it('should validate rating questions with valid scale', () => {
      const validSurvey: CreateSurveyRequest = {
        title: 'Test Survey',
        questions: [
          {
            type: 'RATING',
            title: 'Rate your experience',
            required: true,
            minRating: 1,
            maxRating: 5,
            ratingLabels: { min: 'Poor', max: 'Excellent' }
          }
        ],
        settings: {
          isAnonymous: false,
          allowMultipleResponses: false,
          targetAudienceType: 'ALL',
          sendOnPublish: true,
          sendReminders: false,
          reminderDays: []
        }
      }

      const result = SurveyValidation.validateCreateSurvey(validSurvey)
      expect(result.isValid).toBe(true)
    })

    it('should reject rating questions with invalid scale', () => {
      const invalidSurvey: CreateSurveyRequest = {
        title: 'Test Survey',
        questions: [
          {
            type: 'RATING',
            title: 'Rate your experience',
            required: true,
            minRating: 5,
            maxRating: 3 // Invalid: min > max
          }
        ],
        settings: {
          isAnonymous: false,
          allowMultipleResponses: false,
          targetAudienceType: 'ALL',
          sendOnPublish: true,
          sendReminders: false,
          reminderDays: []
        }
      }

      const result = SurveyValidation.validateCreateSurvey(invalidSurvey)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('Min rating must be less than max rating'))).toBe(true)
    })

    it('should reject questions with missing titles', () => {
      const invalidSurvey: CreateSurveyRequest = {
        title: 'Test Survey',
        questions: [
          {
            type: 'TEXT',
            title: '',
            required: false
          }
        ],
        settings: {
          isAnonymous: false,
          allowMultipleResponses: false,
          targetAudienceType: 'ALL',
          sendOnPublish: true,
          sendReminders: false,
          reminderDays: []
        }
      }

      const result = SurveyValidation.validateCreateSurvey(invalidSurvey)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('Title is required'))).toBe(true)
    })
  })

  describe('Survey Settings Validation', () => {
    it('should reject deadline in the past', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)

      const invalidSurvey: CreateSurveyRequest = {
        title: 'Test Survey',
        questions: [
          {
            type: 'TEXT',
            title: 'Test question',
            required: false
          }
        ],
        settings: {
          isAnonymous: false,
          allowMultipleResponses: false,
          deadline: pastDate,
          targetAudienceType: 'ALL',
          sendOnPublish: true,
          sendReminders: false,
          reminderDays: []
        }
      }

      const result = SurveyValidation.validateCreateSurvey(invalidSurvey)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Survey deadline must be in the future')
    })

    it('should validate branch target audience with branch IDs', () => {
      const validSurvey: CreateSurveyRequest = {
        title: 'Test Survey',
        questions: [
          {
            type: 'TEXT',
            title: 'Test question',
            required: false
          }
        ],
        settings: {
          isAnonymous: false,
          allowMultipleResponses: false,
          targetAudienceType: 'BRANCH',
          targetBranchIds: ['branch-1', 'branch-2'],
          sendOnPublish: true,
          sendReminders: false,
          reminderDays: []
        }
      }

      const result = SurveyValidation.validateCreateSurvey(validSurvey)
      expect(result.isValid).toBe(true)
    })

    it('should reject branch target audience without branch IDs', () => {
      const invalidSurvey: CreateSurveyRequest = {
        title: 'Test Survey',
        questions: [
          {
            type: 'TEXT',
            title: 'Test question',
            required: false
          }
        ],
        settings: {
          isAnonymous: false,
          allowMultipleResponses: false,
          targetAudienceType: 'BRANCH',
          targetBranchIds: [],
          sendOnPublish: true,
          sendReminders: false,
          reminderDays: []
        }
      }

      const result = SurveyValidation.validateCreateSurvey(invalidSurvey)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Branch target audience requires at least one branch')
    })
  })

  describe('Response Validation', () => {
    const sampleQuestions = [
      {
        id: 'q1',
        type: 'MULTIPLE_CHOICE',
        title: 'Choose color',
        required: true,
        options: [
          { id: 'opt1', text: 'Red' },
          { id: 'opt2', text: 'Blue' }
        ]
      },
      {
        id: 'q2',
        type: 'TEXT',
        title: 'Comments',
        required: false
      },
      {
        id: 'q3',
        type: 'RATING',
        title: 'Rate experience',
        required: true,
        minRating: 1,
        maxRating: 5
      },
      {
        id: 'q4',
        type: 'YES_NO',
        title: 'Recommend?',
        required: true
      }
    ]

    it('should validate complete valid response', () => {
      const validResponse: SubmitSurveyResponseRequest = {
        responses: [
          { questionId: 'q1', value: 'opt1' },
          { questionId: 'q2', value: 'Great survey!' },
          { questionId: 'q3', value: 4 },
          { questionId: 'q4', value: true }
        ]
      }

      const result = SurveyValidation.validateSurveyResponse(validResponse, sampleQuestions)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject response missing required questions', () => {
      const invalidResponse: SubmitSurveyResponseRequest = {
        responses: [
          { questionId: 'q2', value: 'Great survey!' }
          // Missing required questions q1, q3, q4
        ]
      }

      const result = SurveyValidation.validateSurveyResponse(invalidResponse, sampleQuestions)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(error => error.includes('Response required for question'))).toBe(true)
    })

    it('should validate multiple choice responses', () => {
      const validResponse: SubmitSurveyResponseRequest = {
        responses: [
          { questionId: 'q1', value: 'opt1' },
          { questionId: 'q3', value: 3 },
          { questionId: 'q4', value: true }
        ]
      }

      const result = SurveyValidation.validateSurveyResponse(validResponse, sampleQuestions)
      expect(result.isValid).toBe(true)
    })

    it('should reject invalid multiple choice responses', () => {
      const invalidResponse: SubmitSurveyResponseRequest = {
        responses: [
          { questionId: 'q1', value: 'invalid-option' },
          { questionId: 'q3', value: 3 },
          { questionId: 'q4', value: true }
        ]
      }

      const result = SurveyValidation.validateSurveyResponse(invalidResponse, sampleQuestions)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('Invalid option selected'))).toBe(true)
    })

    it('should validate rating responses within range', () => {
      const validResponse: SubmitSurveyResponseRequest = {
        responses: [
          { questionId: 'q1', value: 'opt1' },
          { questionId: 'q3', value: 3 },
          { questionId: 'q4', value: true }
        ]
      }

      const result = SurveyValidation.validateSurveyResponse(validResponse, sampleQuestions)
      expect(result.isValid).toBe(true)
    })

    it('should reject rating responses outside range', () => {
      const invalidResponse: SubmitSurveyResponseRequest = {
        responses: [
          { questionId: 'q1', value: 'opt1' },
          { questionId: 'q3', value: 10 }, // Outside 1-5 range
          { questionId: 'q4', value: true }
        ]
      }

      const result = SurveyValidation.validateSurveyResponse(invalidResponse, sampleQuestions)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('Rating must be between'))).toBe(true)
    })

    it('should validate text responses', () => {
      const validResponse: SubmitSurveyResponseRequest = {
        responses: [
          { questionId: 'q1', value: 'opt1' },
          { questionId: 'q2', value: 'This is a valid text response' },
          { questionId: 'q3', value: 4 },
          { questionId: 'q4', value: true }
        ]
      }

      const result = SurveyValidation.validateSurveyResponse(validResponse, sampleQuestions)
      expect(result.isValid).toBe(true)
    })

    it('should reject text responses that are too long', () => {
      const longText = 'A'.repeat(2001)
      const invalidResponse: SubmitSurveyResponseRequest = {
        responses: [
          { questionId: 'q1', value: 'opt1' },
          { questionId: 'q2', value: longText },
          { questionId: 'q3', value: 4 },
          { questionId: 'q4', value: true }
        ]
      }

      const result = SurveyValidation.validateSurveyResponse(invalidResponse, sampleQuestions)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('must be less than 2000 characters'))).toBe(true)
    })
  })

  describe('Data Sanitization', () => {
    it('should sanitize survey data by trimming whitespace', () => {
      const unsanitizedSurvey: CreateSurveyRequest = {
        title: '  Test Survey  ',
        description: '  A test survey  ',
        questions: [
          {
            type: 'MULTIPLE_CHOICE',
            title: '  What is your favorite color?  ',
            description: '  Choose one  ',
            required: true,
            options: [
              { text: '  Red  ', order: 1 },
              { text: '  Blue  ', order: 2 }
            ]
          }
        ],
        settings: {
          isAnonymous: false,
          allowMultipleResponses: false,
          targetAudienceType: 'CUSTOM',
          targetUserIds: ['  user1  ', '', '  user2  '],
          sendOnPublish: true,
          sendReminders: false,
          reminderDays: []
        }
      }

      const sanitized = SurveyValidation.sanitizeSurveyData(unsanitizedSurvey)
      
      expect(sanitized.title).toBe('Test Survey')
      expect(sanitized.description).toBe('A test survey')
      expect(sanitized.questions[0].title).toBe('What is your favorite color?')
      expect(sanitized.questions[0].options![0].text).toBe('Red')
      expect(sanitized.settings.targetUserIds).toEqual(['user1', 'user2'])
    })

    it('should sanitize response data by trimming text values', () => {
      const unsanitizedResponse: SubmitSurveyResponseRequest = {
        responses: [
          { questionId: 'q1', value: '  text response  ', textValue: '  additional text  ' },
          { questionId: 'q2', value: 42 }
        ]
      }

      const sanitized = SurveyValidation.sanitizeResponseData(unsanitizedResponse)
      
      expect(sanitized.responses[0].value).toBe('text response')
      expect(sanitized.responses[0].textValue).toBe('additional text')
      expect(sanitized.responses[1].value).toBe(42) // Numbers should remain unchanged
    })
  })
})