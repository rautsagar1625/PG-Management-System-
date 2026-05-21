'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  IndianRupee,
  CheckCircle2,
  Loader2,
  MapPin,
  Users,
} from 'lucide-react';
import { createProperty, setFinancialModel } from '@/lib/properties-api';
import { FormField, Input, SelectField } from '@/components/ui/FormField';
import { cn } from '@/lib/utils';

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
      ctx.addIssue({ code: 'custom', path: ['fixedOwnerPayout'], message: 'Fixed owner payout is required' });
    }
    if (data.financialModelType === 'REVENUE_SHARE') {
      if (!data.ownerSharePercent || !data.operatorSharePercent) {
        ctx.addIssue({ code: 'custom', path: ['ownerSharePercent'], message: 'Both share percentages are required' });
      } else if (data.ownerSharePercent + data.operatorSharePercent !== 100) {
        ctx.addIssue({ code: 'custom', path: ['ownerSharePercent'], message: 'Owner + operator shares must total 100%' });
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

const STEPS = [
  { id: 1, label: 'Basic Info',      icon: Building2 },
  { id: 2, label: 'Financial Model', icon: IndianRupee },
  { id: 3, label: 'Review',          icon: CheckCircle2 },
];

type StepId = 1 | 2 | 3;

const STEP1_FIELDS: (keyof FormData)[] = ['name', 'address', 'city', 'state', 'pincode', 'type'];
const STEP2_FIELDS: (keyof FormData)[] = ['financialModelType', 'fixedOwnerPayout', 'ownerSharePercent', 'operatorSharePercent'];

const TYPE_LABEL: Record<string, string> = { MALE: 'Male PG', FEMALE: 'Female PG', MIXED: 'Mixed PG' };
const MODEL_LABEL: Record<string, string> = {
  OWNER_OPERATED: 'Owner Operated',
  FIXED_PAYOUT: 'Fixed Payout',
  REVENUE_SHARE: 'Revenue Share',
};

export default function NewPropertyPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState<StepId>(1);
  const [apiError, setApiError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'MIXED', financialModelType: 'OWNER_OPERATED' },
    mode: 'onTouched',
  });

  const watched = watch();
  const financialModel = watched.financialModelType;

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

  const goNext = async () => {
    const fields = step === 1 ? STEP1_FIELDS : STEP2_FIELDS;
    const valid = await trigger(fields);
    if (valid) setStep((s) => (s + 1) as StepId);
  };

  const goBack = () => setStep((s) => (s - 1) as StepId);

  const onSubmit = (data: FormData) => {
    setApiError('');
    mutation.mutate(data);
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Add Property</h1>
          <p className="text-sm text-gray-500">Set up a new PG property</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map(({ id, label, icon: Icon }, idx) => {
          const done = step > id;
          const active = step === id;
          return (
            <div key={id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center transition-colors',
                    done ? 'bg-green-500' : active ? 'bg-indigo-600' : 'bg-gray-200',
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : (
                    <Icon className={cn('w-4 h-4', active ? 'text-white' : 'text-gray-400')} />
                  )}
                </div>
                <span className={cn('text-xs font-medium', active ? 'text-indigo-600' : done ? 'text-green-600' : 'text-gray-400')}>
                  {label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={cn('flex-1 h-0.5 mx-2 mb-5 rounded', step > id ? 'bg-green-400' : 'bg-gray-200')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-500" />
              Basic Information
            </h2>

            <FormField label="Property Name" error={errors.name?.message} required>
              <Input {...register('name')} error={!!errors.name} placeholder="Green Residency" />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Property Type" error={errors.type?.message} required>
                <SelectField {...register('type')} error={!!errors.type} options={PROPERTY_TYPES} />
              </FormField>
              <div className="flex items-end gap-2">
                {(['MALE', 'FEMALE', 'MIXED'] as const).map((t) => (
                  <div
                    key={t}
                    className={cn(
                      'flex-1 flex flex-col items-center py-2 rounded-lg border-2 cursor-pointer transition-all text-xs font-semibold',
                      watched.type === t
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300',
                    )}
                  >
                    <Users className="w-4 h-4 mb-1" />
                    {t === 'MALE' ? 'Male' : t === 'FEMALE' ? 'Female' : 'Mixed'}
                  </div>
                ))}
              </div>
            </div>

            <FormField label="Full Address" error={errors.address?.message} required>
              <Input {...register('address')} error={!!errors.address} placeholder="123, Koramangala 4th Block" />
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
        )}

        {/* Step 2: Financial Model */}
        {step === 2 && (
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-indigo-500" />
              Financial Model
            </h2>

            <div className="grid grid-cols-1 gap-3">
              {FINANCIAL_MODELS.map(({ value, label }) => (
                <label
                  key={value}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                    financialModel === value
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300',
                  )}
                >
                  <input
                    type="radio"
                    value={value}
                    {...register('financialModelType')}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <div>
                    <p className={cn('text-sm font-semibold', financialModel === value ? 'text-indigo-800' : 'text-gray-700')}>
                      {label.split(' — ')[0]}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{label.split(' — ')[1]}</p>
                  </div>
                </label>
              ))}
            </div>

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
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Owner Share (%)" error={errors.ownerSharePercent?.message} required>
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
                {(watched.ownerSharePercent ?? 0) + (watched.operatorSharePercent ?? 0) === 100 && (
                  <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Shares add up to 100%
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="card p-6 space-y-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-500" />
              Review & Create
            </h2>

            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Property</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <span className="text-gray-500">Name</span>
                  <span className="font-semibold text-gray-900">{watched.name}</span>
                  <span className="text-gray-500">Type</span>
                  <span className="font-semibold text-gray-900">{TYPE_LABEL[watched.type] ?? watched.type}</span>
                  <span className="text-gray-500">Address</span>
                  <span className="font-semibold text-gray-900">{watched.address}</span>
                  <span className="text-gray-500">City / State</span>
                  <span className="font-semibold text-gray-900">{watched.city}, {watched.state}</span>
                  <span className="text-gray-500">Pincode</span>
                  <span className="font-semibold text-gray-900">{watched.pincode}</span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Financial Model</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <span className="text-gray-500">Model</span>
                  <span className="font-semibold text-gray-900">{MODEL_LABEL[watched.financialModelType] ?? watched.financialModelType}</span>
                  {financialModel === 'FIXED_PAYOUT' && watched.fixedOwnerPayout && (
                    <>
                      <span className="text-gray-500">Owner Payout</span>
                      <span className="font-semibold text-gray-900">₹{watched.fixedOwnerPayout.toLocaleString('en-IN')}/mo</span>
                    </>
                  )}
                  {financialModel === 'REVENUE_SHARE' && (
                    <>
                      <span className="text-gray-500">Owner / Operator</span>
                      <span className="font-semibold text-gray-900">{watched.ownerSharePercent}% / {watched.operatorSharePercent}%</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {apiError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {apiError}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-5">
          {step > 1 ? (
            <button type="button" onClick={goBack} className="btn-secondary flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <button type="button" onClick={() => router.back()} className="btn-secondary">
              Cancel
            </button>
          )}

          {step < 3 ? (
            <button type="button" onClick={goNext} className="btn-primary flex items-center gap-1.5 ml-auto">
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary flex items-center gap-2 ml-auto disabled:opacity-50"
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Property
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
