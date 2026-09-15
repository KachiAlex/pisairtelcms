import type {
  CreateSurveyRequest,
  QuestionType,
  SubmitSurveyResponseRequest
} from '@/types/survey'

export class SurveyValidation {
  /**
   * Validate survey creation request
   */
  static validateCreateSurvey(data: CreateSurveyRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate title
    if (!data.title || data.title.trim().length === 0) {
      errors.push('Survey title is required')
    } else if (data.title.length > 200) {
      errors.push('Survey title must be less than 200 characters')
    }

    // Validate description
    if (data.description && data.description.length > 1000) {
      errors.push('Survey description must be less than 1000 characters')
    }

    // Validate questions
    if (!data.questions || data.questions.length === 0) {
      errors.push('Survey must have at least one question')
    } else if (data.questions.length > 50) {
      errors.push('Survey cannot have more than 50 questions')
    } else {
      data.questions.forEach((question, index) => {
        const questionErrors = this.validateQuestion(question, index + 1)
        errors.push(...questionErrors)
      })
    }

    // Validate settings
    const settingsErrors = this.validateSurveySettings(data.settings)
    errors.push(...settingsErrors)

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Validate individual question
   */
  private static validateQuestion(question: any, questionNumber: number): string[] {
    const errors: string[] = []
    const prefix = `Question ${questionNumber}:`

    // Validate title
    if (!question.title || question.title.trim().length === 0) {
      errors.push(`${prefix} Title is required`)
    } else if (question.title.length > 300) {
      errors.push(`${prefix} Title must be less than 300 characters`)
    }

    // Validate description
    if (question.description && question.description.length > 500) {
      errors.push(`${prefix} Description must be less than 500 characters`)
    }

    // Validate question type
    const validTypes: QuestionType[] = ['MULTIPLE_CHOICE', 'TEXT', 'RATING', 'YES_NO']
    if (!validTypes.includes(question.type)) {
      errors.push(`${prefix} Invalid question type`)
    }

    // Type-specific validation
    switch (question.type) {
      case 'MULTIPLE_CHOICE':
        if (!question.options || question.options.length < 2) {
          errors.push(`${prefix} Multiple choice questions must have at least 2 options`)
        } else if (question.options.length > 10) {
          errors.push(`${prefix} Multiple choice questions cannot have more than 10 options`)
        } else {
          question.options.forEach((option: any, optionIndex: number) => {
            if (!option.text || option.text.trim().length === 0) {
              errors.push(`${prefix} Option ${optionIndex + 1} text is required`)
            } else if (option.text.length > 200) {
              errors.push(`${prefix} Option ${optionIndex + 1} text must be less than 200 characters`)
            }
          })
        }
        break

      case 'RATING':
        if (!question.minRating || !question.maxRating) {
          errors.push(`${prefix} Rating questions must have min and max rating values`)
        } else if (question.minRating >= question.maxRating) {
          errors.push(`${prefix} Min rating must be less than max rating`)
        } else if (question.minRating < 1 || question.maxRating > 10) {
          errors.push(`${prefix} Rating scale must be between 1 and 10`)
        } else if (question.maxRating - question.minRating > 10) {
          errors.push(`${prefix} Rating scale cannot have more than 10 points`)
        }

        // ratingLabels is a { min?, max? } label pair, not a per-point array
        if (question.ratingLabels) {
          const labels = question.ratingLabels
          if (typeof labels !== 'object' || Array.isArray(labels)) {
            errors.push(`${prefix} Rating labels must be an object with min/max labels`)
          } else if (
            (labels.min !== undefined && typeof labels.min !== 'string') ||
            (labels.max !== undefined && typeof labels.max !== 'string')
          ) {
            errors.push(`${prefix} Rating labels must be strings`)
          }
        }
        break

      case 'TEXT':
        // Text questions don't need additional validation
        break

      case 'YES_NO':
        // Yes/No questions don't need additional validation
        break
    }

    return errors
  }

  /**
   * Validate survey settings
   */
  private static validateSurveySettings(settings: any): string[] {
    const errors: string[] = []

    // Validate deadline
    if (settings.deadline && new Date(settings.deadline) <= new Date()) {
      errors.push('Survey deadline must be in the future')
    }

    // Validate target audience
    const validAudienceTypes = ['ALL', 'BRANCH', 'GROUP', 'CUSTOM']
    if (!validAudienceTypes.includes(settings.targetAudienceType)) {
      errors.push('Invalid target audience type')
    }

    switch (settings.targetAudienceType) {
      case 'BRANCH':
        if (!settings.targetBranchIds || settings.targetBranchIds.length === 0) {
          errors.push('Branch target audience requires at least one branch')
        }
        break

      case 'GROUP':
        if (!settings.targetGroupIds || settings.targetGroupIds.length === 0) {
          errors.push('Group target audience requires at least one group')
        }
        break

      case 'CUSTOM':
        if (!settings.targetUserIds || settings.targetUserIds.length === 0) {
          errors.push('Custom target audience requires at least one user')
        } else if (settings.targetUserIds.length > 1000) {
          errors.push('Custom target audience cannot have more than 1000 users')
        }
        break
    }

    // Validate reminder days
    if (settings.sendReminders && settings.reminderDays) {
      if (!Array.isArray(settings.reminderDays)) {
        errors.push('Reminder days must be an array')
      } else {
        settings.reminderDays.forEach((day: any) => {
          if (typeof day !== 'number' || day < 1 || day > 30) {
            errors.push('Reminder days must be numbers between 1 and 30')
          }
        })
      }
    }

    return errors
  }

  /**
   * Validate survey response submission with detailed error reporting
   */
  static validateResponseSubmission(
    questions: any[],
    responses: any[]
  ): { isValid: boolean; errors: Array<{ questionId: string; type: string; message: string }> } {
    const errors: Array<{ questionId: string; type: string; message: string }> = []

    // Check each question for validation
    questions.forEach(question => {
      const response = responses.find(r => r.questionId === question.id)

      // Check required questions
      if (question.required) {
        if (!response || response.value === null || response.value === undefined || response.value === '') {
          errors.push({
            questionId: question.id,
            type: 'required',
            message: `Response required for question: ${question.title}`
          })
          return // Skip further validation for this question
        }
      }

      // If response exists and has a value, validate it
      if (response && response.value !== null && response.value !== undefined) {
        const validationErrors = this.validateResponseValueDetailed(response.value, question)
        errors.push(...validationErrors)
      }
    })

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Validate response value with detailed error types
   */
  private static validateResponseValueDetailed(value: any, question: any): Array<{ questionId: string; type: string; message: string }> {
    const errors: Array<{ questionId: string; type: string; message: string }> = []

    switch (question.type) {
      case 'MULTIPLE_CHOICE':
        if (Array.isArray(value)) {
          // Check if all selected options are valid
          if (question.options) {
            const invalidOptions = value.filter(val => !question.options.includes(val))
            if (invalidOptions.length > 0) {
              errors.push({
                questionId: question.id,
                type: 'invalid_option',
                message: `Invalid options selected: ${invalidOptions.join(', ')}`
              })
            }
          }
        } else if (typeof value === 'string') {
          // Single selection
          if (question.options && !question.options.includes(value)) {
            errors.push({
              questionId: question.id,
              type: 'invalid_option',
              message: `Invalid option selected: ${value}`
            })
          }
        } else {
          errors.push({
            questionId: question.id,
            type: 'invalid_type',
            message: 'Multiple choice response must be string or array'
          })
        }
        break

      case 'TEXT':
        if (typeof value !== 'string') {
          errors.push({
            questionId: question.id,
            type: 'invalid_type',
            message: 'Text response must be a string'
          })
        } else {
          // Check email format for email questions
          if (question.textType === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(value)) {
              errors.push({
                questionId: question.id,
                type: 'invalid_format',
                message: 'Invalid email format'
              })
            }
          }

          // Check character limit
          if (question.hasCharacterLimit && question.characterLimit && value.length > question.characterLimit) {
            errors.push({
              questionId: question.id,
              type: 'character_limit_exceeded',
              message: `Response exceeds character limit of ${question.characterLimit}`
            })
          }
        }
        break

      case 'RATING':
        if (typeof value !== 'number') {
          errors.push({
            questionId: question.id,
            type: 'invalid_type',
            message: 'Rating response must be a number'
          })
        } else {
          const min = question.minRating || 1
          const max = question.maxRating || 5
          if (value < min || value > max) {
            errors.push({
              questionId: question.id,
              type: 'out_of_range',
              message: `Rating must be between ${min} and ${max}`
            })
          }
        }
        break

      case 'YES_NO':
        if (typeof value !== 'boolean') {
          errors.push({
            questionId: question.id,
            type: 'invalid_type',
            message: 'Yes/No response must be true or false'
          })
        }
        break

      default:
        errors.push({
          questionId: question.id,
          type: 'unknown_type',
          message: 'Unknown question type'
        })
    }

    return errors
  }

  /**
   * Validate survey response submission
   */
  static validateSurveyResponse(
    data: SubmitSurveyResponseRequest,
    questions: any[]
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check if all required questions have responses
    const requiredQuestions = questions.filter(q => q.required)
    for (const question of requiredQuestions) {
      const response = data.responses.find(r => r.questionId === question.id)
      if (!response) {
        errors.push(`Response required for question: ${question.title}`)
        continue
      }

      // Validate response value based on question type
      const valueErrors = this.validateResponseValue(response.value, question)
      if (valueErrors.length > 0) {
        errors.push(`Invalid response for question "${question.title}": ${valueErrors.join(', ')}`)
      }
    }

    // Validate optional question responses
    const optionalQuestions = questions.filter(q => !q.required)
    for (const question of optionalQuestions) {
      const response = data.responses.find(r => r.questionId === question.id)
      if (response && response.value !== null && response.value !== undefined && response.value !== '') {
        const valueErrors = this.validateResponseValue(response.value, question)
        if (valueErrors.length > 0) {
          errors.push(`Invalid response for question "${question.title}": ${valueErrors.join(', ')}`)
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Validate response value based on question type
   */
  private static validateResponseValue(value: any, question: any): string[] {
    const errors: string[] = []

    switch (question.type) {
      case 'MULTIPLE_CHOICE': {
        // Options may be stored as plain strings or { id, text, order } objects;
        // the respond form submits the option text/id as the value
        const validOptions = (question.options || [])
          .map((opt: any) => (typeof opt === 'string' ? opt : opt?.id ?? opt?.text))
          .filter(Boolean)
        if (Array.isArray(value)) {
          // Multiple selection
          if (value.length === 0) {
            errors.push('At least one option must be selected')
          } else {
            value.forEach((selected: string) => {
              if (!validOptions.includes(selected)) {
                errors.push('Invalid option selected')
              }
            })
          }
        } else {
          // Single selection
          if (!validOptions.includes(value)) {
            errors.push('Invalid option selected')
          }
        }
        break
      }

      case 'TEXT':
        if (typeof value !== 'string') {
          errors.push('Text response must be a string')
        } else if (value.length > 2000) {
          errors.push('Text response must be less than 2000 characters')
        }
        break

      case 'RATING':
        if (typeof value !== 'number') {
          errors.push('Rating response must be a number')
        } else if (value < question.minRating || value > question.maxRating) {
          errors.push(`Rating must be between ${question.minRating} and ${question.maxRating}`)
        }
        break

      case 'YES_NO':
        if (typeof value !== 'boolean') {
          errors.push('Yes/No response must be true or false')
        }
        break

      default:
        errors.push('Unknown question type')
    }

    return errors
  }

  /**
   * Sanitize survey data for storage
   */
  static sanitizeSurveyData(data: CreateSurveyRequest): CreateSurveyRequest {
    return {
      title: data.title.trim(),
      description: data.description?.trim(),
      questions: data.questions.map(question => ({
        ...question,
        title: question.title.trim(),
        description: question.description?.trim(),
        options: question.options?.map(option => ({
          ...option,
          text: option.text.trim()
        }))
      })),
      settings: {
        ...data.settings,
        targetBranchIds: data.settings.targetBranchIds?.map(id => id.trim()).filter(id => id.length > 0) || [],
        targetGroupIds: data.settings.targetGroupIds?.map(id => id.trim()).filter(id => id.length > 0) || [],
        targetUserIds: data.settings.targetUserIds?.map(id => id.trim()).filter(id => id.length > 0) || []
      }
    }
  }

  /**
   * Sanitize response data for storage
   */
  static sanitizeResponseData(data: SubmitSurveyResponseRequest): SubmitSurveyResponseRequest {
    return {
      responses: data.responses.map(response => ({
        questionId: response.questionId,
        value: typeof response.value === 'string' ? response.value.trim() : response.value,
        textValue: response.textValue?.trim()
      }))
    }
  }
}