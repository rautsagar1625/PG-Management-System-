import { Injectable, NotFoundException } from '@nestjs/common';
import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';

import { PrismaService } from '../../database/prisma.service';

// Load Roboto fonts from pdfmake's bundled VFS (base64 → Buffer)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vfsFonts = require('pdfmake/build/vfs_fonts') as { pdfMake?: { vfs: Record<string, string> } };
const vfs: Record<string, string> = vfsFonts.pdfMake?.vfs ?? {};

const fonts = {
  Roboto: {
    normal:      Buffer.from(vfs['Roboto-Regular.ttf']    ?? '', 'base64'),
    bold:        Buffer.from(vfs['Roboto-Medium.ttf']     ?? '', 'base64'),
    italics:     Buffer.from(vfs['Roboto-Italic.ttf']     ?? '', 'base64'),
    bolditalics: Buffer.from(vfs['Roboto-MediumItalic.ttf'] ?? '', 'base64'),
  },
};

@Injectable()
export class PdfService {
  private printer: PdfPrinter;

  constructor(private prisma: PrismaService) {
    this.printer = new PdfPrinter(fonts);
  }

  // ── Receipt PDF ───────────────────────────────────────────────────────────

  async generateReceipt(receiptNo: string): Promise<Buffer> {
    const receipt = await this.prisma.receipt.findUnique({
      where: { receiptNo },
      include: {
        payment: {
          include: {
            recorder: { select: { name: true } },
          },
        },
        tenant: {
          include: {
            user: { select: { name: true, phone: true, email: true } },
            property: { select: { name: true, address: true, city: true } },
            allocations: {
              where: { isActive: true },
              include: { bed: { include: { room: { select: { number: true } } } } },
            },
          },
        },
      },
    });

    if (!receipt) throw new NotFoundException(`Receipt ${receiptNo} not found`);

    const { payment, tenant } = receipt;
    const prop = tenant.property;
    const room = tenant.allocations[0]?.bed?.room?.number ?? 'N/A';
    const bedLabel = tenant.allocations[0]?.bed?.label ?? '';

    const docDef: TDocumentDefinitions = {
      pageSize: 'A5',
      pageMargins: [40, 40, 40, 40],
      content: [
        this.header(prop.name, `${prop.address}, ${prop.city}`),
        { text: 'PAYMENT RECEIPT', style: 'docTitle', margin: [0, 16, 0, 8] },
        this.divider(),
        this.twoCol('Receipt No', receiptNo, 'Date', payment.paidAt.toLocaleDateString('en-IN')),
        this.twoCol('Tenant Code', tenant.tenantCode, 'Room/Bed', `${room}-${bedLabel}`),
        this.divider(),
        { text: 'Tenant Details', style: 'sectionHeader', margin: [0, 8, 0, 4] },
        this.twoCol('Name', tenant.user.name, 'Phone', tenant.user.phone ?? '—'),
        { text: 'Payment Details', style: 'sectionHeader', margin: [0, 12, 0, 4] },
        this.twoCol('Amount', `₹${Number(payment.amount).toLocaleString('en-IN')}`, 'Method', payment.method),
        this.twoCol('Type', payment.type, 'Reference', payment.referenceNo ?? '—'),
        payment.notes ? { text: `Note: ${payment.notes}`, style: 'note', margin: [0, 4, 0, 0] } : '' as unknown as Content,
        this.divider(),
        { text: `Recorded by: ${payment.recorder.name}`, style: 'note', margin: [0, 4, 0, 0] },
        { text: 'This is a computer-generated receipt.', style: 'note', margin: [0, 16, 0, 0], alignment: 'center' },
      ],
      styles: {
        docTitle: { fontSize: 16, bold: true, alignment: 'center', color: '#1e40af' },
        sectionHeader: { fontSize: 11, bold: true, color: '#374151' },
        label: { fontSize: 9, color: '#6b7280' },
        value: { fontSize: 10, bold: true },
        note: { fontSize: 8, color: '#9ca3af', italics: true },
        dividerLine: { fontSize: 1, color: '#e5e7eb' },
      },
      defaultStyle: { font: 'Roboto', fontSize: 10 },
    };

    return this.buildPdf(docDef);
  }

  // ── Settlement Summary PDF ────────────────────────────────────────────────

  async generateSettlementSummary(settlementId: string): Promise<Buffer> {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
      include: {
        property: { select: { name: true, address: true, city: true } },
        financialModel: true,
      },
    });

    if (!settlement) throw new NotFoundException(`Settlement ${settlementId} not found`);

    const { property, financialModel } = settlement;
    const breakdown = settlement.breakdown as Record<string, number>;

    const docDef: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [50, 50, 50, 50],
      content: [
        this.header(property.name, `${property.address}, ${property.city}`),
        { text: 'MONTHLY SETTLEMENT SUMMARY', style: 'docTitle', margin: [0, 20, 0, 8] },
        this.divider(),
        this.twoCol('Period', `${this.monthName(settlement.month)} ${settlement.year}`, 'Status', settlement.status),
        this.twoCol('Financial Model', financialModel.type, 'Settlement ID', settlement.id.slice(0, 12) + '...'),
        { text: 'Collection Summary', style: 'sectionHeader', margin: [0, 16, 0, 8] },
        {
          table: {
            widths: ['*', 'auto'],
            body: [
              [{ text: 'Description', style: 'tableHeader' }, { text: 'Amount', style: 'tableHeader' }],
              ['Total Rent Collected', `₹${Number(settlement.totalCollected).toLocaleString('en-IN')}`],
              ['Owner Payout', `₹${Number(settlement.ownerPayout).toLocaleString('en-IN')}`],
              ['Operator Profit', `₹${Number(settlement.operatorProfit).toLocaleString('en-IN')}`],
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 16],
        },
        { text: 'Occupancy Breakdown', style: 'sectionHeader', margin: [0, 0, 0, 8] },
        {
          table: {
            widths: ['*', 'auto'],
            body: [
              [{ text: 'Category', style: 'tableHeader' }, { text: 'Count', style: 'tableHeader' }],
              ['Total Tenants', String(breakdown.tenantCount ?? 0)],
              ['Fully Paid', String(breakdown.paidCount ?? 0)],
              ['Partially Paid', String(breakdown.partialCount ?? 0)],
              ['Overdue', String(breakdown.overdueCount ?? 0)],
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 16],
        },
        this.divider(),
        settlement.settledAt
          ? { text: `Settled on: ${settlement.settledAt.toLocaleDateString('en-IN')}`, style: 'note', margin: [0, 8, 0, 0] }
          : '' as unknown as Content,
        { text: 'This is a computer-generated settlement summary.', style: 'note', margin: [0, 16, 0, 0], alignment: 'center' },
      ],
      styles: {
        docTitle: { fontSize: 18, bold: true, alignment: 'center', color: '#1e40af' },
        sectionHeader: { fontSize: 12, bold: true, color: '#374151' },
        tableHeader: { bold: true, fillColor: '#f3f4f6' },
        label: { fontSize: 9, color: '#6b7280' },
        value: { fontSize: 10, bold: true },
        note: { fontSize: 8, color: '#9ca3af', italics: true },
      },
      defaultStyle: { font: 'Roboto', fontSize: 10 },
    };

    return this.buildPdf(docDef);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private header(propertyName: string, address: string): Content {
    return {
      stack: [
        { text: propertyName, fontSize: 18, bold: true, color: '#1e40af' },
        { text: address, fontSize: 9, color: '#6b7280', margin: [0, 2, 0, 0] },
      ],
      margin: [0, 0, 0, 8],
    };
  }

  private divider(): Content {
    return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }], margin: [0, 4, 0, 4] };
  }

  private twoCol(label1: string, val1: string, label2: string, val2: string): Content {
    return {
      columns: [
        { stack: [{ text: label1, style: 'label' }, { text: val1, style: 'value' }], width: '50%' },
        { stack: [{ text: label2, style: 'label' }, { text: val2, style: 'value' }], width: '50%' },
      ],
      margin: [0, 4, 0, 0],
    };
  }

  private monthName(month: number): string {
    return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month - 1] ?? String(month);
  }

  private buildPdf(docDef: TDocumentDefinitions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = this.printer.createPdfKitDocument(docDef, { tableLayouts: {} });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }
}
