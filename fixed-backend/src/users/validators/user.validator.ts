import { z } from 'zod';

const roleSchema = z.enum(['ADMIN', 'BUSINESS_OWNER', 'EMPLOYEE']);

export const updateUserSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    role: roleSchema.optional(),
    password: z.string().min(8).max(200).optional(),
  })
  .strict();

const PASSWORD_REGEX = {
  lower: /[a-z]/,
  upper: /[A-Z]/,
  digit: /[0-9]/,
  special: /[^a-zA-Z0-9]/,
};

export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(PASSWORD_REGEX.lower, 'Password must contain a lowercase letter')
      .regex(PASSWORD_REGEX.upper, 'Password must contain an uppercase letter')
      .regex(PASSWORD_REGEX.digit, 'Password must contain a digit')
      .regex(PASSWORD_REGEX.special, 'Password must contain a special character'),
  })
  .strict();

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  role: roleSchema.optional(),
  isVerified: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .optional(),
  searchTerm: z.string().min(1).optional(),
});

export const userValidators = {
  update: updateUserSchema,
  updatePassword: updatePasswordSchema,
  listQuery: listUsersQuerySchema,
};
