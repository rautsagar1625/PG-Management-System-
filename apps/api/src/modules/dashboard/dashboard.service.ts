import { Injectable } from '@nestjs/common';

import { calculateCollectionRate, calculateOccupancyRate } from '@pg-system/utils';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getOperatorDashboard(userId: string) {
    const propertyRoles = await this.prisma.propertyRole.findMany({
      where: { userId },
      include: { property: true },
    });

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const cards = await Promise.all(
      propertyRoles.map(async ({ property }) => {
        const [beds, rentSummary, openComplaints] = await Promise.all([
          this.prisma.bed.groupBy({
            by: ['status'],
            where: { room: { propertyId: property.id } },
            _count: { _all: true },
          }),
          this.prisma.rentCycle.aggregate({
            where: { propertyId: property.id, month, year },
            _sum: { rentAmount: true, paidAmount: true, remainingAmount: true },
          }),
          this.prisma.complaint.count({
            where: {
              propertyId: property.id,
              status: { notIn: ['CLOSED', 'REJECTED'] },
            },
          }),
        ]);

        const totalBeds = beds.reduce((s, g) => s + g._count._all, 0);
        const occupiedBeds =
          beds.find((g) => g.status === 'OCCUPIED')?._count._all ?? 0;
        const totalExpected = Number(rentSummary._sum.rentAmount ?? 0);
        const totalCollected = Number(rentSummary._sum.paidAmount ?? 0);

        return {
          propertyId: property.id,
          propertyName: property.name,
          city: property.city,
          occupancyRate: calculateOccupancyRate(occupiedBeds, totalBeds),
          totalBeds,
          occupiedBeds,
          availableBeds: totalBeds - occupiedBeds,
          rentCollectionRate: calculateCollectionRate(totalCollected, totalExpected),
          totalExpectedRent: totalExpected,
          totalCollectedRent: totalCollected,
          pendingRent: Number(rentSummary._sum.remainingAmount ?? 0),
          openComplaints,
        };
      }),
    );

    return {
      properties: cards,
      globalSummary: {
        totalProperties: cards.length,
        totalMonthlyRevenue: cards.reduce((s, c) => s + c.totalCollectedRent, 0),
        totalPendingRent: cards.reduce((s, c) => s + c.pendingRent, 0),
        totalOpenComplaints: cards.reduce((s, c) => s + c.openComplaints, 0),
      },
    };
  }

  async getTenantDashboard(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId },
      include: {
        user: { select: { name: true } },
        property: { select: { name: true } },
        allocations: {
          where: { isActive: true },
          include: {
            bed: {
              include: { room: { select: { number: true, floor: true } } },
            },
          },
        },
        payments: {
          orderBy: { paidAt: 'desc' },
          take: 5,
          include: { receipt: true },
        },
      },
    });

    if (!tenant) return null;

    const now = new Date();
    const currentCycle = await this.prisma.rentCycle.findUnique({
      where: {
        tenantId_month_year: {
          tenantId: tenant.id,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        },
      },
    });

    const allocation = tenant.allocations[0];

    return {
      name: tenant.user.name,
      tenantCode: tenant.tenantCode,
      propertyName: tenant.property.name,
      roomNumber: allocation?.bed.room.number ?? '',
      bedLabel: allocation?.bed.label ?? '',
      monthlyRent: Number(allocation?.monthlyRent ?? 0),
      moveInDate: tenant.moveInDate?.toISOString(),
      currentRent: currentCycle
        ? {
            month: currentCycle.month,
            year: currentCycle.year,
            dueDate: currentCycle.dueDate.toISOString(),
            rentAmount: Number(currentCycle.rentAmount),
            paidAmount: Number(currentCycle.paidAmount),
            remainingAmount: Number(currentCycle.remainingAmount),
            status: currentCycle.status,
            isOverdue: currentCycle.status === 'OVERDUE',
          }
        : null,
      recentPayments: tenant.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        type: p.type,
        method: p.method,
        paidAt: p.paidAt.toISOString(),
        receiptNo: p.receipt?.receiptNo,
      })),
    };
  }
}
