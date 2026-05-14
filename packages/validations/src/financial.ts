import { z } from 'zod';

import { amountSchema, dateStringSchema, idSchema } from './common';

export const recordPaymentSchema = z.object({
  tenantId: idSchema,
  rentCycleId: idSchema.optional(),
  amount: amountSchema,
  type: z.enum(['RENT', 'DEPOSIT', 'DEPOSIT_REFUND', 'MAINTENANCE', 'FINE', 'OTHER']),
  method: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE']),
  referenceNo: z.string().optional(),
  notes: z.string().max(500).optional(),
  paymentDate: dateStringSchema,
});

export const setFinancialModelSchema = z
  .object({
    type: z.enum(['FIXED_PAYOUT', 'REVENUE_SHARE', 'OWNER_OPERATED']),
    fixedOwnerPayout: amountSchema.optional(),
    ownerSharePercent: z.number().min(0).max(100).optional(),
    operatorSharePercent: z.number().min(0).max(100).optional(),
    effectiveFrom: dateStringSchema,
  })
  .superRefine((data, ctx) => {
    if (data.type === 'FIXED_PAYOUT' && !data.fixedOwnerPayout) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fixedOwnerPayout is required for FIXED_PAYOUT model',
        path: ['fixedOwnerPayout'],
      });
    }
    if (data.type === 'REVENUE_SHARE') {
      if (data.ownerSharePercent === undefined || data.operatorSharePercent === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'ownerSharePercent and operatorSharePercent are required for REVENUE_SHARE',
          path: ['ownerSharePercent'],
        });
      } else if (data.ownerSharePercent + data.operatorSharePercent !== 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Owner and operator share percentages must sum to 100',
          path: ['operatorSharePercent'],
        });
      }
    }
  });

export const generateSettlementSchema = z.object({
  propertyId: idSchema,
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});

export type RecordPaymentDto = z.infer<typeof recordPaymentSchema>;
export type SetFinancialModelDto = z.infer<typeof setFinancialModelSchema>;
export type GenerateSettlementDto = z.infer<typeof generateSettlementSchema>;
