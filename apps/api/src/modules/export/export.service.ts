import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

import { PrismaService } from '../../database/prisma.service';

export type ExportFormat = 'csv' | 'xlsx';

type Row = Record<string, string | number>;

function toDate(d: Date | null | undefined): string {
  return d?.toISOString().slice(0, 10) ?? '';
}

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  // ── Collections ───────────────────────────────────────────────────────────

  async exportCollections(
    propertyId: string,
    month: number,
    year: number,
    format: ExportFormat,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const cycles = await this.prisma.rentCycle.findMany({
      where: { propertyId, month, year },
      include: {
        tenant: {
          include: {
            user: { select: { name: true, phone: true } },
            allocations: {
              where: { isActive: true },
              include: { bed: { include: { room: { select: { number: true } } } } },
            },
          },
        },
      },
      orderBy: { tenant: { tenantCode: 'asc' } },
    });

    const rows: Row[] = cycles.map((c) => ({
      'Tenant Code': c.tenant.tenantCode,
      'Tenant Name': c.tenant.user.name,
      Phone: c.tenant.user.phone ?? '',
      Room: c.tenant.allocations[0]?.bed.room.number ?? '',
      Bed: c.tenant.allocations[0]?.bed.label ?? '',
      'Rent Amount': Number(c.rentAmount),
      'Paid Amount': Number(c.paidAmount),
      Remaining: Number(c.remainingAmount),
      'Late Fee': Number(c.lateFee),
      Status: String(c.status),
      'Due Date': toDate(c.dueDate),
    }));

    return this.toOutput(rows, `collections-${year}-${month}`, format);
  }

  // ── Overdue ───────────────────────────────────────────────────────────────

  async exportOverdue(
    propertyId: string,
    format: ExportFormat,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const cycles = await this.prisma.rentCycle.findMany({
      where: { propertyId, status: 'OVERDUE' },
      include: {
        tenant: {
          include: {
            user: { select: { name: true, phone: true } },
            allocations: {
              where: { isActive: true },
              include: { bed: { include: { room: { select: { number: true } } } } },
            },
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    const rows: Row[] = cycles.map((c) => ({
      'Tenant Code': c.tenant.tenantCode,
      'Tenant Name': c.tenant.user.name,
      Phone: c.tenant.user.phone ?? '',
      Room: c.tenant.allocations[0]?.bed.room.number ?? '',
      Month: `${c.month}/${c.year}`,
      'Rent Amount': Number(c.rentAmount),
      'Paid Amount': Number(c.paidAmount),
      Outstanding: Number(c.remainingAmount),
      'Late Fee': Number(c.lateFee),
      'Due Date': toDate(c.dueDate),
      'Days Overdue': Math.floor((Date.now() - c.dueDate.getTime()) / 86400000),
    }));

    return this.toOutput(rows, `overdue-${toDate(new Date())}`, format);
  }

  // ── Tenants ───────────────────────────────────────────────────────────────

  async exportTenants(
    propertyId: string,
    format: ExportFormat,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const tenants = await this.prisma.tenant.findMany({
      where: { propertyId },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        allocations: {
          where: { isActive: true },
          include: { bed: { include: { room: { select: { number: true } } } } },
        },
      },
      orderBy: { tenantCode: 'asc' },
    });

    const rows: Row[] = tenants.map((t) => ({
      'Tenant Code': t.tenantCode,
      Name: t.user.name,
      Email: t.user.email,
      Phone: t.user.phone ?? '',
      Room: t.allocations[0]?.bed.room.number ?? '',
      Bed: t.allocations[0]?.bed.label ?? '',
      'Monthly Rent': Number(t.allocations[0]?.monthlyRent ?? 0),
      Status: String(t.status),
      'KYC Status': String(t.kycStatus),
      'Move-in Date': toDate(t.moveInDate),
      'Move-out Date': toDate(t.moveOutDate),
      'Deposit Amount': Number(t.depositAmount),
      'Deposit Balance': Number(t.depositBalance),
      'Deposit Status': String(t.depositStatus),
    }));

    return this.toOutput(rows, `tenants-${propertyId}`, format);
  }

  // ── Settlements ───────────────────────────────────────────────────────────

  async exportSettlements(
    propertyId: string,
    year: number,
    format: ExportFormat,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const settlements = await this.prisma.settlement.findMany({
      where: { propertyId, year },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    const rows: Row[] = settlements.map((s) => ({
      Month: `${s.month}/${s.year}`,
      'Total Collected': Number(s.totalCollected),
      'Owner Payout': Number(s.ownerPayout),
      'Operator Profit': Number(s.operatorProfit),
      Status: String(s.status),
      'Settled At': toDate(s.settledAt),
      Notes: s.notes ?? '',
    }));

    return this.toOutput(rows, `settlements-${propertyId}-${year}`, format);
  }

  // ── Internal: convert rows to buffer ────────────────────────────────────

  private toOutput(
    rows: Row[],
    baseName: string,
    format: ExportFormat,
  ): { buffer: Buffer; filename: string; mimeType: string } {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws);
      return {
        buffer: Buffer.from(csv, 'utf-8'),
        filename: `${baseName}.csv`,
        mimeType: 'text/csv',
      };
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return {
      buffer: buf,
      filename: `${baseName}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
}
