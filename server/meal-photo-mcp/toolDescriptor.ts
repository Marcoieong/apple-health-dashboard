const oauthSecurityScheme = {
  type: 'oauth2',
  scopes: ['meal.write']
} as const;

const openAiFileSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    download_url: {
      type: 'string',
      format: 'uri',
      description: 'Short-lived URL supplied by ChatGPT.'
    },
    file_id: {
      type: 'string',
      minLength: 1,
      description: 'Opaque ChatGPT file identifier.'
    },
    mime_type: {
      type: 'string',
      description: 'Optional MIME type reported by ChatGPT.'
    },
    file_name: {
      type: 'string',
      description: 'Optional original filename reported by ChatGPT.'
    }
  },
  required: ['download_url', 'file_id']
} as const;

/**
 * Provider-neutral descriptor used by the future MCP transport adapter.
 * Keeping it as data makes the mobile attachment contract testable before
 * OAuth, storage and deployment credentials exist.
 */
export const recordMealToolDescriptor = {
  name: 'record_meal',
  title: '記錄餐食照片',
  description:
    'Save one meal from photos uploaded in the current ChatGPT conversation. Record food types and preparation methods, not calories or portions.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      photos: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: openAiFileSchema,
        description: 'One to four photos of the same meal.'
      },
      client_request_id: {
        type: 'string',
        minLength: 8,
        maxLength: 128,
        description: 'Stable idempotency key generated once for this meal.'
      },
      local_date: {
        type: 'string',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
        description: 'Meal date in the user timezone.'
      },
      timezone: {
        type: 'string',
        minLength: 1,
        maxLength: 64,
        description: 'IANA timezone, normally Asia/Macau.'
      },
      meal_type: {
        type: 'string',
        enum: ['breakfast', 'lunch', 'dinner', 'snack']
      },
      food_labels: {
        type: 'array',
        maxItems: 30,
        items: { type: 'string', minLength: 1, maxLength: 80 },
        description: 'Visible food types only; do not estimate quantities or calories.'
      },
      preparation_methods: {
        type: 'array',
        maxItems: 12,
        items: { type: 'string', minLength: 1, maxLength: 60 }
      },
      notes: {
        type: 'string',
        maxLength: 500
      }
    },
    required: [
      'photos',
      'client_request_id',
      'local_date',
      'timezone',
      'meal_type'
    ]
  },
  outputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      entry_id: { type: 'string' },
      local_date: { type: 'string' },
      meal_type: {
        type: 'string',
        enum: ['breakfast', 'lunch', 'dinner', 'snack']
      },
      photo_count: { type: 'integer', minimum: 1, maximum: 4 },
      reused_photo_count: { type: 'integer', minimum: 0, maximum: 4 },
      status: {
        type: 'string',
        enum: ['recorded', 'already_recorded']
      }
    },
    required: [
      'entry_id',
      'local_date',
      'meal_type',
      'photo_count',
      'reused_photo_count',
      'status'
    ]
  },
  securitySchemes: [oauthSecurityScheme],
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  _meta: {
    securitySchemes: [oauthSecurityScheme],
    'openai/fileParams': ['photos'],
    'openai/toolInvocation/invoking': '正在儲存餐食照片…',
    'openai/toolInvocation/invoked': '餐食照片已記錄'
  }
} as const;
