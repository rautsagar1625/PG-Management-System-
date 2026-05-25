import { apiClient } from './api';

export type SettlementStatus = 'CALCULATED' | 'PAID';
export type FinancialModelType = 'FIXED_PAYOUT' | 'REVENUE_SHARE' | 'OWNER_OPERATED';

export interface Settlement {
  id: string;
  propertyId: string;
  month: number;
  year: number;
  totalCollected: number;
  ownerPayout: number;
  operatorProfit: number;
  status: SettlementStatus;
  settledAt: string | null;
  settledBy: string | null;
  notes: string | null;
  breakdown: {
    financialModelType: FinancialModelType;
    totalCollected: number;
    calculatedAt: string;
  };
  financialModel: {
    type: FinancialModelType;
    fixedOwnerPayout: number | null;
    ownerSharePercent: number | null;
    operatorSharePercent: number | null;
  };
  createdAt: string;
}

export async function calculateSettlement(
  propertyId: string,
  month: number,
  year: number,
): Promise<Settlement> {
  const { data } = await apiClient.post<{ success: boolean; data: Settlement }>(
    '/settlements/calculate',
    { propertyId, month, year },
  );
  return data.data;
}

export async function markSettlementPaid(
  settlementId: string,
  notes?: string,
): Promise<Settlement> {
  const { data } = await apiClient.put<{ success: boolean; data: Settlement }>(
    `/settlements/${settlementId}/mark-paid`,
    { notes },
  );
  return data.data;
}

export async function getSettlement(id: string): Promise<Settlement & { property: { id: string; name: string; city: string } }> {
  const { data } = await apiClient.get<{ success: boolean; data: Settlement & { property: { id: string; name: string; city: string } } }>(
    `/settlements/${id}`,
  );
  return data.data;
}

export async function getSettlements(propertyId: string, year?: number): Promise<Settlement[]> {
  const { data } = await apiClient.get<{ success: boolean; data: Settlement[] }>(
    `/settlements/property/${propertyId}`,
    { params: year ? { year } : {} },
  );
  return data.data;
}
