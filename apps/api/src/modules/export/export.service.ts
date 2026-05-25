import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

import { PrismaService } from '../../database/prisma.service';

export type ExportFormat = 'csv' | 'xlsx';

// EP-001 fix (Sprint 1 guard): Cap synchronous exports to prevent a single export
// request from blocking the Node.js event loop and causing timeouts for all other
// users on the same server instance. The full async/BullMQ export (Sprint 2) will
// remove this ceiling entirely via background job + S3 signed URL delivery.
//
// Rationale for 2_000: p99 export time < 3s on a 2-core API pod.
// 10_000 records (old value) consumed ~800 MB of memory and took 30+ seconds.
const EXPORT_MAX_RECORDS = 2_000;

type Row = Record<string, string | number>;

function toDate(d: Date | null | undefined): string {
  return d?.toISOString().slice(0, 10) ?? '';
}

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  // ── Collections ───────────────────────────────────────────────────────────
  //
  // EP-003 fix: date filtering is now explicit via `dateFilter`.
  //
  //   mode: 'cycle-month'  (default) — returns all rent cycles whose rent
  //         period matches month/year, regardless of when payment arrived.
  //         Use for "what was owed in May?"
  //
  //   mode: 'payment-date' — returns cycles that received at least one payment
  //         in the given calendar date range (from/to). Use for "what cash
  //         actually arrived between May 1–31?" (cash-basis reporting).
  //
  // Both modes emit a 'Last Paid At' column so the two views are reconcilable.

  async exportCollections(
    propertyId: string,
    month: number,
    year: number,
    format: ExportFormat,
    dateFilter: { mode: 'cycle-month' } | { mode: 'payment-date'; from: Date; to: Date } = { mode: 'cycle-month' },
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string; truncated: boolean; rowCount: number }> {
    // Build the Prisma where clause based on which date mode is requested
    const baseWhere = dateFilter.mode === 'cycle-month'
      ? { propertyId, month, year }
      : {
          propertyId,
          payments: {
            some: {
              paidAt: { gte: dateFilter.from, lte: dateFilter.to },
            },
          },
        };

    const cycles = await this.prisma.rentCycle.findMany({
      where: baseWhere,
      take: EXPORT_MAX_RECORDS,
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
        // Include latest payment date for the 'Last Paid At' reconciliation column
        payments: {
          orderBy: { paidAt: 'desc' },
          take: 1,
          select: { paidAt: true },
        },
      },
      orderBy: { tenant: { tenantCode: 'asc' } },
    });

    const filterLabel = dateFilter.mode === 'cycle-month'
      ? `${year}-${month}`
      : `paid-${toDate(dateFilter.from)}-to-${toDate(dateFilter.to)}`;

    const rows: Row[] = cycles.map((c) => ({
      'Tenant Code': c.tenant.tenantCode,
      'Tenant Name': c.tenant.user.name,
      Phone: c.tenant.user.phone ?? '',
      Room: c.tenant.allocations[0]?.bed.room.number ?? '',
      Bed: c.tenant.allocations[0]?.bed.label ?? '',
      'Rent Period': `${c.month}/${c.year}`,
      'Rent Amount': Number(c.rentAmount),
      'Paid Amount': Number(c.paidAmount),
      Remaining: Number(c.remainingAmount),
      'Late Fee': Number(c.lateFee),
      Status: String(c.status),
      'Due Date': toDate(c.dueDate),
      // EP-003: explicit last payment date so operators can reconcile
      // cycle-month view against cash-basis bank statements
      'Last Paid At': toDate(c.payments[0]?.paidAt),
    }));

    return this.toOutput(rows, `collections-${filterLabel}`, format);
  }

  // ── Overdue ───────────────────────────────────────────────────────────────

  async exportOverdue(
    propertyId: string,
    format: ExportFormat,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string; truncated: boolean; rowCount: number }> {
    const cycles = await this.prisma.rentCycle.findMany({
      where: { propertyId, status: 'OVERDUE' },
      take: EXPORT_MAX_RECORDS,
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
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string; truncated: boolean; rowCount: number }> {
    const tenants = await this.prisma.tenant.findMany({
      where: { propertyId },
      take: EXPORT_MAX_RECORDS,
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
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string; truncated: boolean; rowCount: number }> {
    const settlements = await this.prisma.settlement.findMany({
      where: { propertyId, year },
      take: EXPORT_MAX_RECORDS,
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
  ): { buffer: Buffer; filename: string; mimeType: string; truncated: boolean; rowCount: number } {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    const truncated = rows.length >= EXPORT_MAX_RECORDS;
    const rowCount = rows.length;

    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws);
      return {
        buffer: Buffer.from(csv, 'utf-8'),
        filename: `${baseName}.csv`,
        mimeType: 'text/csv',
        truncated,
        rowCount,
      };
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return {
      buffer: buf,
      filename: `${baseName}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      truncated,
      rowCount,
    };
  }
}
