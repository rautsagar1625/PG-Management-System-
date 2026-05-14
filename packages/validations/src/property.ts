import { z } from 'zod';

import { addressSchema, amountSchema } from './common';

export const createPropertySchema = z.object({
  name: z.string().min(3, 'Property name too short').max(100),
  address: addressSchema,
  type: z.enum(['MALE', 'FEMALE', 'MIXED']),
  amenities: z.array(z.string()).optional().default([]),
  rules: z.array(z.string()).optional().default([]),
});

export const updatePropertySchema = createPropertySchema.partial();

export const createRoomSchema = z.object({
  number: z.string().min(1).max(20),
  floor: z.number().int().optional(),
  type: z.enum([
    'SINGLE_SHARING',
    'DOUBLE_SHARING',
    'TRIPLE_SHARING',
    'FOUR_SHARING',
    'SIX_SHARING',
    'PRIVATE',
  ]),
  sharingCapacity: z.number().int().min(1).max(6),
  monthlyRent: amountSchema,
  amenities: z.array(z.string()).optional().default([]),
});

export const updateRoomSchema = createRoomSchema.partial();

export const createBedSchema = z.object({
  label: z.string().min(1).max(10),
  monthlyRent: amountSchema.optional(),
});

export const updateBedSchema = createBedSchema.partial().extend({
  status: z
    .enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'UNDER_MAINTENANCE'])
    .optional(),
});

export const addPropertyRoleSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum(['OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF']),
  sharePercent: z.number().min(0).max(100).optional(),
  startDate: z.string().datetime(),
});

export type CreatePropertyDto = z.infer<typeof createPropertySchema>;
export type UpdatePropertyDto = z.infer<typeof updatePropertySchema>;
export type CreateRoomDto = z.infer<typeof createRoomSchema>;
export type CreateBedDto = z.infer<typeof createBedSchema>;
export type AddPropertyRoleDto = z.infer<typeof addPropertyRoleSchema>;
