import { z } from 'zod';

import { amountSchema, contactInfoSchema, dateStringSchema, idSchema, phoneSchema } from './common';

export const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: phoneSchema,
  propertyId: idSchema,
  emergencyContact: contactInfoSchema.optional(),
  leadSource: z.string().optional(),
  depositAmount: amountSchema,
});

export const updateTenantSchema = createTenantSchema.partial();

export const scheduleVisitSchema = z.object({
  visitDate: dateStringSchema,
  notes: z.string().optional(),
});

export const finalizeRoomSchema = z.object({
  bedId: idSchema,
  monthlyRent: amountSchema,
  depositAmount: amountSchema,
  notes: z.string().optional(),
});

export const moveInSchema = z.object({
  bedId: idSchema,
  moveInDate: dateStringSchema,
  monthlyRent: amountSchema,
  depositAmount: amountSchema,
  notes: z.string().optional(),
});

export const moveOutSchema = z.object({
  moveOutDate: dateStringSchema,
  depositRefundAmount: amountSchema.optional(),
  depositForfeitAmount: amountSchema.optional(),
  notes: z.string().optional(),
});

export const roomTransferSchema = z.object({
  newBedId: idSchema,
  transferDate: dateStringSchema,
  newMonthlyRent: amountSchema.optional(),
  reason: z.string().optional(),
});

export const kycSubmitSchema = z.object({
  documents: z.array(
    z.object({
      type: z.enum(['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID']),
      documentNumber: z.string().min(5),
      fileUrl: z.string().url().optional(),
    }),
  ),
});

export type CreateTenantDto = z.infer<typeof createTenantSchema>;
export type MoveInDto = z.infer<typeof moveInSchema>;
export type MoveOutDto = z.infer<typeof moveOutSchema>;
export type RoomTransferDto = z.infer<typeof roomTransferSchema>;
export type KycSubmitDto = z.infer<typeof kycSubmitSchema>;
