'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CheckCircle2, Circle, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { getProperties, type Property } from '@/lib/properties-api';
import { getRooms, type Room, type Bed } from '@/lib/rooms-api';
import {
  createTenant,
  markVisited,
  finalizeRoom,
  moveIn,
  type Tenant,
} from '@/lib/tenants-api';
import { FormField, Input, SelectField } from '@/components/ui/FormField';
import { BedGrid, type BedInfo } from '@/components/ui/BedGrid';
import { OccupancyBar } from '@/components/ui/OccupancyBar';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { formatCurrency } from '@/lib/utils';

// ── Step definitions ──────────────────────────────────────────────────

const STEPS = [
  { id: 1, title: 'Basic Info', desc: 'Tenant details' },
  { id: 2, title: 'Select Bed', desc: 'Pick room & bed' },
  { id: 3, title: 'Move-in', desc: 'Deposit & KYC' },
  { id: 4, title: 'Confirm', desc: 'Review & activate' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

interface OnboardingState {
  // Step 1
  name: string;
  email: string;
  phone: string;
  propertyId: string;
  leadSource: string;
  depositAmount: string;
  // Step 2
  selectedBedId: string;
  selectedBed: BedInfo | null;
  selectedRoom: Room | null;
  // Step 3
  moveInDate: string;
  monthlyRent: string;
  depositPaid: boolean;
  kycSubmitted: boolean;
  // Resolved tenant
  tenant: Tenant | null;
}

const initialState: OnboardingState = {
  name: '',
  email: '',
  phone: '',
  propertyId: '',
  leadSource: '',
  depositAmount: '',
  selectedBedId: '',
  selectedBed: null,
  selectedRoom: null,
  moveInDate: new Date().toISOString().slice(0, 10),
  monthlyRent: '',
  depositPaid: true,
  kycSubmitted: true,
  tenant: null,
};

const LEAD_SOURCES = [
  { value: '', label: 'Select source' },
  { value: 'WALKIN', label: 'Walk-in' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'SOCIAL_MEDIA', label: 'Social Media' },
  { value: 'OTHER', label: 'Other' },
];

// ── Progress Indicator ────────────────────────────────────────────────

function StepIndicator({
  currentStep,
  completedUpTo,
}: {
  currentStep: StepId;
  completedUpTo: StepId;
}) {
  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                step.id < currentStep || step.id <= completedUpTo
                  ? 'bg-primary-600 text-white'
                  : step.id === currentStep
                    ? 'bg-primary-100 text-primary-700 border-2 border-primary-600'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {step.id < currentStep || step.id <= completedUpTo ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                step.id
              )}
            </div>
            <div className="mt-1.5 text-center">
              <p
                className={`text-xs font-medium ${
                  step.id === currentStep ? 'text-primary-700' : 'text-gray-400'
                }`}
              >
                {step.title}
              </p>
            </div>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-3 mb-5 transition-colors ${
                step.id < currentStep ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────

export default function NewTenantPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPropertyId = searchParams.get('propertyId') ?? '';

  const [step, setStep] = useState<StepId>(1);
  const [completedUpTo, setCompletedUpTo] = useState<StepId>(0 as StepId);
  const [state, setState] = useState<OnboardingState>({
    ...initialState,
    propertyId: initialPropertyId,
  });
  const [error, setError] = useState('');

  const update = useCallback(
    (partial: Partial<OnboardingState>) =>
      setState((s) => ({ ...s, ...partial })),
    [],
  );

  const advance = (nextStep: StepId) => {
    setCompletedUpTo((p) => Math.max(p, step) as StepId);
    setStep(nextStep);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Step 1 mutation: create tenant ──
  const createMutation = useMutation({
    mutationFn: () =>
      createTenant({
        name: state.name,
        email: state.email,
        phone: state.phone,
        propertyId: state.propertyId,
        leadSource: state.leadSource || undefined,
        depositAmount: parseFloat(state.depositAmount) || 0,
      }),
    onSuccess: async (tenant) => {
      update({ tenant });
      // Fast-forward: mark as visited so we can finalize room next
      try {
        await markVisited(tenant.id);
      } catch (e) {
        console.warn('markVisited failed (state transition may be invalid):', e);
      }
      advance(2);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Failed to create tenant';
      setError(msg);
    },
  });

  // ── Step 2 mutation: finalize room ──
  const finalizeMutation = useMutation({
    mutationFn: () =>
      finalizeRoom(
        state.tenant!.id,
        state.selectedBedId,
        parseFloat(state.depositAmount) || 0,
      ),
    onSuccess: () => advance(3),
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Failed to finalize room';
      setError(msg);
    },
  });

  // ── Step 3 mutation: move in ──
  const moveInMutation = useMutation({
    mutationFn: () =>
      moveIn(state.tenant!.id, {
        bedId: state.selectedBedId,
        moveInDate: state.moveInDate,
        monthlyRent: parseFloat(state.monthlyRent) || (state.selectedRoom?.baseRent ?? 0),
        depositAmount: parseFloat(state.depositAmount) || 0,
        depositPaid: state.depositPaid,
        kycSubmitted: state.kycSubmitted,
      }),
    onSuccess: (updatedTenant) => {
      update({ tenant: updatedTenant });
      advance(4);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Move-in failed';
      setError(msg);
    },
  });

  const isPending =
    createMutation.isPending || finalizeMutation.isPending || moveInMutation.isPending;

  const handleStep1 = () => {
    setError('');
    if (!state.name.trim()) return setError('Name is required');
    if (!state.email.trim() || !state.email.includes('@')) return setError('Valid email is required');
    if (!/^[6-9]\d{9}$/.test(state.phone)) return setError('Enter valid 10-digit mobile number');
    if (!state.propertyId) return setError('Select a property');
    createMutation.mutate();
  };

  const handleStep2 = () => {
    setError('');
    if (!state.selectedBedId) return setError('Select a bed first');
    finalizeMutation.mutate();
  };

  const handleStep3 = () => {
    setError('');
    if (!state.moveInDate) return setError('Move-in date is required');
    moveInMutation.mutate();
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
          <h1 className="text-2xl font-bold text-gray-900">Add Tenant</h1>
          <p className="text-sm text-gray-500 mt-0.5">Guided onboarding workflow</p>
        </div>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={step} completedUpTo={completedUpTo} />

      {/* Step Content */}
      <div className="card p-6">
        {step === 1 && (
          <Step1BasicInfo
            state={state}
            update={update}
            error={error}
            isPending={isPending}
            onNext={handleStep1}
            initialPropertyId={initialPropertyId}
          />
        )}
        {step === 2 && (
          <Step2SelectBed
            state={state}
            update={update}
            error={error}
            isPending={isPending}
            onNext={handleStep2}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3MoveIn
            state={state}
            update={update}
            error={error}
            isPending={isPending}
            onNext={handleStep3}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <Step4Confirm
            state={state}
            onDone={() => router.push(`/dashboard/tenants/${state.tenant?.id}`)}
            onGoToTenants={() => router.push('/dashboard/tenants')}
          />
        )}
      </div>
    </div>
  );
}

// ── Step 1: Basic Info ────────────────────────────────────────────────

function Step1BasicInfo({
  state,
  update,
  error,
  isPending,
  onNext,
  initialPropertyId,
}: {
  state: OnboardingState;
  update: (p: Partial<OnboardingState>) => void;
  error: string;
  isPending: boolean;
  onNext: () => void;
  initialPropertyId: string;
}) {
  const { data: properties = [], isLoading } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: getProperties,
    select: (data) => {
      if (data.length > 0 && !state.propertyId) {
        setTimeout(() => update({ propertyId: data[0]!.id }), 0);
      }
      return data;
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Tenant Details</h2>

      <FormField label="Full Name" required>
        <Input
          value={state.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Raju Sharma"
          autoFocus
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Email" required>
          <Input
            value={state.email}
            onChange={(e) => update({ email: e.target.value })}
            type="email"
            placeholder="raju@gmail.com"
          />
        </FormField>
        <FormField label="Phone" required>
          <Input
            value={state.phone}
            onChange={(e) => update({ phone: e.target.value })}
            type="tel"
            placeholder="9876543210"
            maxLength={10}
          />
        </FormField>
      </div>

      <FormField label="Property" required>
        <SelectField
          value={state.propertyId}
          onChange={(e) => update({ propertyId: e.target.value })}
          options={properties.map((p) => ({ value: p.id, label: `${p.name} — ${p.city}` }))}
          placeholder="Select property"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Lead Source">
          <SelectField
            value={state.leadSource}
            onChange={(e) => update({ leadSource: e.target.value })}
            options={LEAD_SOURCES}
          />
        </FormField>
        <FormField label="Expected Deposit (₹)" hint="Can update at move-in">
          <Input
            value={state.depositAmount}
            onChange={(e) => update({ depositAmount: e.target.value })}
            type="number"
            placeholder="10000"
          />
        </FormField>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          disabled={isPending}
          className="btn-primary flex items-center gap-2"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowRight className="w-4 h-4" />
          )}
          {isPending ? 'Creating...' : 'Next — Select Bed'}
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Select Bed ────────────────────────────────────────────────

function Step2SelectBed({
  state,
  update,
  error,
  isPending,
  onNext,
  onBack,
}: {
  state: OnboardingState;
  update: (p: Partial<OnboardingState>) => void;
  error: string;
  isPending: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['rooms', state.propertyId],
    queryFn: () => getRooms(state.propertyId),
    enabled: !!state.propertyId,
  });

  const availableRooms = rooms.filter(
    (r) => r.status !== 'FULLY_OCCUPIED' && r.status !== 'INACTIVE',
  );

  const handleBedClick = (bed: BedInfo, room: Room) => {
    if (bed.status !== 'AVAILABLE') return;
    update({
      selectedBedId: bed.id,
      selectedBed: bed,
      selectedRoom: room,
      monthlyRent: String(bed.monthlyRent ?? room.baseRent),
    });
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">Select Bed</h2>
        <p className="text-xs text-gray-400">
          {availableRooms.reduce((s, r) => s + r.beds.filter((b) => b.status === 'AVAILABLE').length, 0)} beds available
        </p>
      </div>

      {availableRooms.length === 0 && (
        <div className="p-6 text-center text-gray-500">
          <p className="text-sm font-medium">No available beds</p>
          <p className="text-xs mt-1">All beds are occupied or under maintenance.</p>
        </div>
      )}

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {availableRooms.map((room) => {
          const beds: BedInfo[] = room.beds.map((b) => ({
            id: b.id,
            label: b.label,
            status: b.status,
            tenantName: b.currentAllocation?.tenant.user.name,
            monthlyRent: b.monthlyRent ?? room.baseRent,
          }));

          const occupied = beds.filter((b) => b.status === 'OCCUPIED').length;

          return (
            <div
              key={room.id}
              className={`border rounded-xl p-4 transition-colors ${
                state.selectedRoom?.id === room.id
                  ? 'border-primary-300 bg-primary-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm font-semibold text-gray-900">Room {room.number}</span>
                  {room.floor !== null && (
                    <span className="text-xs text-gray-400 ml-2">Floor {room.floor}</span>
                  )}
                  <span className="text-xs text-gray-500 ml-2">
                    · {formatCurrency(room.baseRent)}/bed
                  </span>
                </div>
                <span className="text-xs text-gray-400">{occupied}/{beds.length} occupied</span>
              </div>

              <BedGrid
                beds={beds}
                compact={false}
                onBedClick={(bed) =>
                  bed.status === 'AVAILABLE' ? handleBedClick(bed, room) : undefined
                }
              />
            </div>
          );
        })}
      </div>

      {state.selectedBed && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-primary-800">
            Selected: Room {state.selectedRoom?.number} — Bed {state.selectedBed.label}
          </p>
          <p className="text-xs text-primary-600 mt-0.5">
            Monthly rent: {formatCurrency(state.selectedBed.monthlyRent ?? state.selectedRoom?.baseRent ?? 0)}
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="btn-secondary flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={onNext}
          disabled={isPending || !state.selectedBedId}
          className="btn-primary flex items-center gap-2"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          <ArrowRight className="w-4 h-4" />
          Next — Move-in Details
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Move-in ────────────────────────────────────────────────────

function Step3MoveIn({
  state,
  update,
  error,
  isPending,
  onNext,
  onBack,
}: {
  state: OnboardingState;
  update: (p: Partial<OnboardingState>) => void;
  error: string;
  isPending: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Move-in Details</h2>

      {/* Bed summary */}
      <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-700">
        Bed:{' '}
        <strong>
          Room {state.selectedRoom?.number} — Bed {state.selectedBed?.label}
        </strong>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Move-in Date" required>
          <Input
            value={state.moveInDate}
            onChange={(e) => update({ moveInDate: e.target.value })}
            type="date"
          />
        </FormField>
        <FormField label="Monthly Rent (₹)" required>
          <Input
            value={state.monthlyRent}
            onChange={(e) => update({ monthlyRent: e.target.value })}
            type="number"
            placeholder={String(state.selectedRoom?.baseRent ?? '')}
          />
        </FormField>
      </div>

      <FormField label="Security Deposit (₹)" required>
        <Input
          value={state.depositAmount}
          onChange={(e) => update({ depositAmount: e.target.value })}
          type="number"
          placeholder="10000"
        />
      </FormField>

      {/* Checkboxes */}
      <div className="space-y-3 pt-1">
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={state.depositPaid}
            onChange={(e) => update({ depositPaid: e.target.checked })}
            className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <div>
            <p className="text-sm font-medium text-gray-700">Deposit collected</p>
            <p className="text-xs text-gray-500">
              Uncheck if deposit will be collected later (tenant enters DEPOSIT_PENDING)
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={state.kycSubmitted}
            onChange={(e) => update({ kycSubmitted: e.target.checked })}
            className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <div>
            <p className="text-sm font-medium text-gray-700">KYC submitted</p>
            <p className="text-xs text-gray-500">
              Uncheck if documents are pending (tenant enters KYC_PENDING)
            </p>
          </div>
        </label>
      </div>

      {/* Status preview */}
      <div className="p-3 bg-gray-50 rounded-xl">
        <p className="text-xs text-gray-500 mb-1">Tenant will be activated as:</p>
        <p className="text-sm font-semibold text-gray-900">
          {!state.depositPaid
            ? '⏳ DEPOSIT PENDING'
            : !state.kycSubmitted
              ? '⏳ KYC PENDING'
              : '✅ ACTIVE'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="btn-secondary flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={onNext}
          disabled={isPending}
          className="btn-primary flex items-center gap-2"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Complete Move-in
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Confirm ────────────────────────────────────────────────────

function Step4Confirm({
  state,
  onDone,
  onGoToTenants,
}: {
  state: OnboardingState;
  onDone: () => void;
  onGoToTenants: () => void;
}) {
  const t = state.tenant;
  if (!t) return null;

  const statusColor =
    t.status === 'ACTIVE'
      ? 'text-green-700 bg-green-50 border-green-200'
      : 'text-yellow-700 bg-yellow-50 border-yellow-200';

  return (
    <div className="space-y-5 text-center">
      <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-9 h-9 text-green-500" />
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900">Tenant Onboarded!</h2>
        <p className="text-sm text-gray-500 mt-1">
          {state.name} has been successfully added.
        </p>
      </div>

      {/* Summary card */}
      <div className="text-left p-4 bg-gray-50 rounded-xl space-y-2 text-sm">
        <Row label="Name" value={state.name} />
        <Row label="Code" value={t.tenantCode} mono />
        <Row label="Phone" value={state.phone} />
        <Row
          label="Room / Bed"
          value={`Room ${state.selectedRoom?.number} — Bed ${state.selectedBed?.label}`}
        />
        <Row
          label="Monthly Rent"
          value={formatCurrency(parseFloat(state.monthlyRent) || 0)}
        />
        <Row
          label="Deposit"
          value={formatCurrency(parseFloat(state.depositAmount) || 0)}
        />
        <div className="flex justify-between pt-1">
          <span className="text-gray-500">Status</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColor}`}>
            {t.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onGoToTenants} className="btn-secondary flex-1 text-sm">
          All Tenants
        </button>
        <button onClick={onDone} className="btn-primary flex-1 text-sm">
          View Tenant
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium text-gray-900 ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}
