// eslint-disable-next-line import/no-extraneous-dependencies
import { z } from 'zod';

export const createUserSchema = z
  .object({
    userName: z.object({
      firstName: z.string().min(1, 'First name is required'),
      lastName: z.string().min(1, 'Last name is required'),
      displayName: z.string().min(1, 'Display name is required'),
    }),

    contactInfo: z.object({
      email: z.object({
        email: z.string().email(),
        verified: z.boolean(),
        verifiedAt: z.union([z.date(), z.string(), z.null()]),
        verificationCode: z.string(),
      }),
      phone: z.object({
        countryCode: z.string(),
        phoneNumber: z.string(),
        verified: z.boolean(),
        verifiedAt: z.union([z.date(), z.string(), z.null()]),
        verificationCode: z.string(),
      }),
    }),

    password: z.object({
      hashed: z.string(),
      expirationDate: z.union([z.date(), z.string()]),
    }),

    historyID: z.string().nullable().optional(),
    licenseID: z.string().nullable().optional(),

    userInfo: z.object({
      gender: z.string(),
      nationality: z.string(),
      address: z.object({
        city: z.string(),
        country: z.string(),
      }),
      profilePicture: z.string().optional(),
    }),

    active: z.boolean().optional(),
    role: z.enum(['user', 'owner', 'admin', 'demo', 'driver']),
    subUsersIDs: z.array(z.string()).optional(),
    subscriptionID: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // if role is driver, licenseID is required (and not null/empty)
    if (
      data.role === 'driver' &&
      (!data.licenseID || data.licenseID === null)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'licenseID is required when role is driver',
        path: ['licenseID'],
      });
    }
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
