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

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name is required'),
  photoURL: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^https?:\/\/.+/i.test(v), { message: 'Must be a valid link starting with http(s)://' }),
  anniversaryDate: z.string().optional(),
})

export const joinCodeSchema = z.object({
  joinCode: z
    .string()
    .trim()
    .min(4, 'Invite codes are at least 4 characters')
    .max(12, 'That code looks too long')
    .transform((v) => v.toUpperCase()),
})
