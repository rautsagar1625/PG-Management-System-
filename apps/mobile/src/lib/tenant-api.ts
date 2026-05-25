import { api } from './api';

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface TenantDashboard {
  tenant: {
    id: string;
    tenantCode: string;
    status: string;
    monthlyRent: number | null;
    depositBalance: number;
    user: { name: string; email: string; phone: string | null };
  };
  allocation: {
    room: { roomNumber: string; floor: number | null };
    bed: { label: string };
    property: { name: string; address: string; city: string };
    startDate: string;
  } | null;
  currentCycle: {
    id: string;
    month: number;
    year: number;
    expectedRent: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    dueDate: string;
  } | null;
}

export async function getTenantDashboard(): Promise<TenantDashboard> {
  const res = await api.get<{ success: boolean; data: TenantDashboard }>('/tenant/dashboard');
  return res.data;
}

// ── Rent History ──────────────────────────────────────────────────────────────

export interface RentCycleSummary {
  id: string;
  month: number;
  year: number;
  expectedRent: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  dueDate: string;
}

export async function getTenantRentHistory(): Promise<RentCycleSummary[]> {
  const res = await api.get<{ success: boolean; data: RentCycleSummary[] }>('/tenant/rent-history');
  return res.data;
}

// ── Complaints ────────────────────────────────────────────────────────────────

export interface TenantComplaint {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  updates: { id: string; comment: string; statusChange: string | null; createdAt: string }[];
}

export interface CreateComplaintPayload {
  title: string;
  description: string;
  category: string;
  priority: string;
}

export async function getTenantComplaints(): Promise<TenantComplaint[]> {
  const res = await api.get<{ success: boolean; data: TenantComplaint[] }>('/tenant/complaints');
  return res.data;
}

export async function createTenantComplaint(payload: CreateComplaintPayload): Promise<TenantComplaint> {
  const res = await api.post<{ success: boolean; data: TenantComplaint }>('/tenant/complaints', payload);
  return res.data;
}

// ── Profile ───────────────────────────────────────────────────────────────────

export interface TenantProfile {
  id: string;
  tenantCode: string;
  status: string;
  monthlyRent: number | null;
  depositBalance: number;
  moveInDate: string | null;
  expectedMoveOut: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  user: {
    name: string;
    email: string;
    phone: string | null;
  };
  allocation: {
    room: { roomNumber: string; floor: number | null };
    bed: { label: string };
    property: { name: string; address: string; city: string };
    startDate: string;
  } | null;
}

export async function getTenantProfile(): Promise<TenantProfile> {
  const res = await api.get<{ success: boolean; data: TenantProfile }>('/tenant/profile');
  return res.data;
}

// ── KYC Documents ─────────────────────────────────────────────────────────────

export interface KycDocument {
  id: string;
  tenantId: string;
  type: string;
  documentNumber: string;
  fileUrl: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export async function getTenantKycDocuments(): Promise<KycDocument[]> {
  const res = await api.get<{ success: boolean; data: KycDocument[] }>('/tenant/kyc');
  return res.data;
}

export async function uploadKycDocument(dto: {
  type: string;
  documentNumber: string;
  fileUrl?: string;
}): Promise<KycDocument> {
  const res = await api.post<{ success: boolean; data: KycDocument }>('/tenant/kyc', dto);
  return res.data;
}

// ── Agreements ────────────────────────────────────────────────────────────────

export interface TenantAgreement {
  id: string;
  status: string;
  rentAmount: number;
  depositAmount: number;
  startDate: string;
  endDate: string | null;
  signedByTenantAt: string | null;
  signedByOwnerAt: string | null;
  terms: string;
  createdAt: string;
}

export async function getTenantAgreements(): Promise<TenantAgreement[]> {
  const res = await api.get<{ success: boolean; data: TenantAgreement[] }>('/tenant/agreements');
  return res.data;
}

export async function signTenantAgreement(agreementId: string): Promise<TenantAgreement> {
  const res = await api.put<{ success: boolean; data: TenantAgreement }>(
    `/tenant/agreements/${agreementId}/sign`,
    {}, // PUT requires a body; agreement signing has no payload
  );
  return res.data;
}

// ── Razorpay Payment ──────────────────────────────────────────────────────────

export interface RazorpayOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  tenant: { name: string; email: string; phone: string | null };
}

export async function createPaymentOrder(dto: {
  rentCycleId: string;
  amount: number;
}): Promise<RazorpayOrder> {
  const res = await api.post<{ success: boolean; data: RazorpayOrder }>(
    '/tenant/pay/create-order',
    dto,
  );
  return res.data;
}

export async function verifyPayment(dto: {
  rentCycleId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<void> {
  await api.post('/tenant/pay/verify', dto);
}
