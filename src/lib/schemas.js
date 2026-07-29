import { z } from 'zod'

// Tiny hand-rolled resolver so react-hook-form can validate with zod
// without pulling in the separate @hookform/resolvers package.
export function zodResolver(schema) {
  return (values) => {
    const result = schema.safeParse(values)
    if (result.success) {
      return { values: result.data, errors: {} }
    }
    const errors = {}
    for (const issue of result.error.issues) {
      const path = issue.path.join('.')
      if (!errors[path]) {
        errors[path] = { type: issue.code, message: issue.message }
      }
    }
    return { values: {}, errors }
  }
}

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const signupSchema = z.object({
  displayName: z.string().trim().min(1, 'Tell us what to call you'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(6, 'Password needs at least 6 characters'),
})

export const LOVE_LANGUAGES = [
  {
    value: 'Words of Affirmation',
    description: 'Feels most loved through verbal encouragement, compliments, and hearing "I love you."',
  },
  {
    value: 'Quality Time',
    description: 'Feels most loved through undivided attention — real conversations and shared activities.',
  },
  {
    value: 'Acts of Service',
    description: 'Feels most loved when a partner does something helpful, easing their day-to-day load.',
  },
  {
    value: 'Receiving Gifts',
    description: 'Feels most loved by thoughtful gifts — the gesture and thought matter more than the price.',
  },
  {
    value: 'Physical Touch',
    description: 'Feels most loved through physical closeness — holding hands, hugs, sitting close.',
  },
]

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name is required'),
  photoURL: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^https?:\/\/.+/i.test(v) || /^data:image\/.+/i.test(v), {
      message: 'Must be a valid link starting with http(s)://',
    }),
  anniversaryDate: z.string().optional(),
  favoriteSong: z.string().trim().max(120, 'Keep it under 120 characters').optional(),
  loveLanguage: z.string().optional(),
})

export const joinCodeSchema = z.object({
  joinCode: z
    .string()
    .trim()
    .min(4, 'Invite codes are at least 4 characters')
    .max(12, 'That code looks too long')
    .transform((v) => v.toUpperCase()),
})