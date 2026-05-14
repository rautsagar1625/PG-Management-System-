'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Loader2 } from 'lucide-react';
import { createProperty, setFinancialModel } from '@/lib/properties-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormField, Input, SelectField } from '@/components/ui/FormField';

const schema = z
  .object({
    name: z.string().min(2, 'Name is required'),
    address: z.string().min(5, 'Address is required'),
    city: z.string().min(2, 'City is required'),
    state: z.string().min(2, 'State is required'),
    pincode: z.string().regex(/^\d{6}$/, '6-digit pincode required'),
    type: z.enum(['MALE', 'FEMALE', 'MIXED']),
    financialModelType: z.enum(['FIXED_PAYOUT', 'REVENUE_SHARE', 'OWNER_OPERATED']),
    fixedOwnerPayout: z.coerce.number().optional(),
    ownerSharePercent: z.coerce.number().min(1).max(99).optional(),
    operatorSharePercent: z.coerce.number().min(1).max(99).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.financialModelType === 'FIXED_PAYOUT' && !data.fixedOwnerPayout) {
      ctx.addIssue({
        code: 'custom',
        path: ['fixedOwnerPayout'],
        message: 'Fixed owner payout is required',
      });
    }
    if (data.financialModelType === 'REVENUE_SHARE') {
      if (!data.ownerSharePercent || !data.operatorSharePercent) {
        ctx.addIssue({
          code: 'custom',
          path: ['ownerSharePercent'],
          message: 'Both share percentages are required',
        });
      } else if (data.ownerSharePercent + data.operatorSharePercent !== 100) {
        ctx.addIssue({
          code: 'custom',
          path: ['ownerSharePercent'],
          message: 'Owner + operator shares must total 100%',
        });
      }
    }
  });

type FormData = z.infer<typeof schema>;

const PROPERTY_TYPES = [
  { value: 'MALE', label: 'Male PG' },
  { value: 'FEMALE', label: 'Female PG' },
  { value: 'MIXED', label: 'Mixed PG' },
];

const FINANCIAL_MODELS = [
  { value: 'OWNER_OPERATED', label: 'Owner Operated — I run it myself' },
  { value: 'FIXED_PAYOUT', label: 'Fixed Payout — Operator pays fixed rent to owner' },
  { value: 'REVENUE_SHARE', label: 'Revenue Share — Split by percentage' },
];

export default function NewPropertyPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [apiError, setApiError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'MIXED',
      financialModelType: 'OWNER_OPERATED',
    },
  });

  const financialModel = watch('financialModelType');

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const property = await createProperty({
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        type: data.type,
      });

      // Always set a financial model
      await setFinancialModel(property.id, {
        type: data.financialModelType,
        fixedOwnerPayout: data.fixedOwnerPayout,
        ownerSharePercent: data.ownerSharePercent,
        operatorSharePercent: data.operatorSharePercent,
        effectiveFrom: new Date().toISOString(),
      });

      return property;
    },
    onSuccess: (property) => {
      qc.invalidateQueries({ queryKey: ['properties'] });
      qc.invalidateQueries({ queryKey: ['operator-dashboard'] });
      router.push(`/dashboard/properties/${property.id}`);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create property';
      setApiError(msg);
    },
  });

  const onSubmit = (data: FormData) => {
    setApiError('');
    mutation.mutate(data);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <PageHeader title="Add Property" subtitle="Set up a new PG property" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Basic Info */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Basic Information
          </h2>

          <FormField label="Property Name" error={errors.name?.message} required>
            <Input {...register('name')} error={!!errors.name} placeholder="Green Residency" />
          </FormField>

          <FormField label="Property Type" error={errors.type?.message} required>
            <SelectField
              {...register('type')}
              error={!!errors.type}
              options={PROPERTY_TYPES}
            />
          </FormField>

          <FormField label="Full Address" error={errors.address?.message} required>
            <Input
              {...register('address')}
              error={!!errors.address}
              placeholder="123, Koramangala 4th Block"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="City" error={errors.city?.message} required>
              <Input {...register('city')} error={!!errors.city} placeholder="Bangalore" />
            </FormField>
            <FormField label="State" error={errors.state?.message} required>
              <Input {...register('state')} error={!!errors.state} placeholder="Karnataka" />
            </FormField>
          </div>

          <FormField label="Pincode" error={errors.pincode?.message} required>
            <Input
              {...register('pincode')}
              error={!!errors.pincode}
              placeholder="560034"
              maxLength={6}
              className="max-w-[140px]"
            />
          </FormField>
        </div>

        {/* Financial Model */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Financial Model
          </h2>

          <FormField
            label="Revenue Model"
            error={errors.financialModelType?.message}
            required
          >
            <SelectField
              {...register('financialModelType')}
              error={!!errors.financialModelType}
              options={FINANCIAL_MODELS}
            />
          </FormField>

          {financialModel === 'FIXED_PAYOUT' && (
            <FormField
              label="Fixed Owner Payout (₹ / month)"
              error={errors.fixedOwnerPayout?.message}
              hint="Amount owner receives monthly regardless of collection"
              required
            >
              <Input
                {...register('fixedOwnerPayout')}
                error={!!errors.fixedOwnerPayout}
                type="number"
                min={0}
                placeholder="200000"
              />
            </FormField>
          )}

          {financialModel === 'REVENUE_SHARE' && (
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Owner Share (%)"
                error={errors.ownerSharePercent?.message}
                required
              >
                <Input
                  {...register('ownerSharePercent')}
                  error={!!errors.ownerSharePercent}
                  type="number"
                  min={1}
                  max={99}
                  placeholder="60"
                />
              </FormField>
              <FormField label="Operator Share (%)" required>
                <Input
                  {...register('operatorSharePercent')}
                  type="number"
                  min={1}
                  max={99}
                  placeholder="40"
                />
              </FormField>
            </div>
          )}
        </div>

        {apiError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {apiError}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Property
          </button>
        </div>
      </form>
    </div>
  );
}
