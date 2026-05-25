import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TenantStatus } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { IsEmail, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { PaginationQuery, RequestContext } from '@pg-system/types';
import { buildPaginationMeta, buildPrismaSkipTake, generateTenantCode } from '@pg-system/utils';

import { CacheService } from '../../database/cache.service';
import { PrismaService } from '../../database/prisma.service';

// SP5-5: 30-second cache for the tenant list.
// Short enough that operators see fresh data after a status change;
// long enough to absorb repeated page loads and filter changes.
const TTL_TENANT_LIST = 30;

export class CreateTenantDto {
  @ApiProperty({ example: 'Rahul Sharma' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'rahul@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '9876543210' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'uuid-of-property' })
  @IsUUID()
  propertyId: string;

  @ApiPropertyOptional({ example: 'Walk-in', enum: ['Walk-in', 'Website', 'Referral', 'Facebook', 'Instagram', 'JustDial', 'Other'] })
  @IsString()
  @IsOptional()
  leadSource?: string;

  @ApiProperty({ example: 5000, description: 'Security deposit amount in INR' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  depositAmount: number;
}

@Injectable()
export class TenantsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async findAll(
    ctx: RequestContext,
    query: PaginationQuery & { propertyId?: string; status?: string },
  ) {
    const { page = 1, limit = 20, search, propertyId, status } = query;
    const { skip, take } = buildPrismaSkipTake(page, limit);

    const validStatuses = Object.values(TenantStatus) as string[];
    if (status && !validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }

    // SP5-5: Cache tenant list for 30 s.
    // Skip caching when a search term is present — search results are too
    // variable to cache usefully and would balloon memory with one key per query.
    const isCacheable = !search && !!propertyId;
    const cacheKey = isCacheable
      ? `tenants:list:${propertyId}:${ctx.userId}:${status ?? 'ALL'}:${page}:${limit}`
      : null;

    if (cacheKey) {
      const hit = await this.cache.get<ReturnType<typeof buildPaginationMeta>>(cacheKey);
      if (hit) return hit;
    }

    const where: Prisma.TenantWhereInput = {
      ...(propertyId && { propertyId }),
      ...(status && { status: status as TenantStatus }),
      ...(search && {
        OR: [
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { user: { phone: { contains: search, mode: 'insensitive' } } },
          { tenantCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(ctx.systemRole !== 'SUPER_ADMIN' && {
        property: { roles: { some: { userId: ctx.userId } } },
      }),
    };

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          allocations: {
            where: { isActive: true },
            include: {
              bed: { include: { room: { select: { number: true, floor: true } } } },
            },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    const result = { success: true, data: tenants, meta: buildPaginationMeta(total, page, limit) };

    if (cacheKey) {
      await this.cache.set(cacheKey, result, TTL_TENANT_LIST);
    }

    return result;
  }

  async findOne(id: string, ctx: RequestContext) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        allocations: {
          include: {
            bed: { include: { room: { select: { number: true, floor: true } } } },
          },
          orderBy: { startDate: 'desc' },
        },
        emergencyContacts: true,
        documents: true,
        rentCycles: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 6 },
        payments: { orderBy: { paidAt: 'desc' }, take: 10 },
        complaints: { where: { status: { notIn: ['CLOSED', 'REJECTED'] } } },
      },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    if (ctx.systemRole !== 'SUPER_ADMIN') {
      const role = await this.prisma.propertyRole.findUnique({
        where: { propertyId_userId: { propertyId: tenant.propertyId, userId: ctx.userId } },
        select: { id: true },
      });
      if (!role) throw new ForbiddenException('Access denied to this tenant');
    }

    return tenant;
  }

  async create(dto: CreateTenantDto) {
    // Handle concurrent requests for the same email: findUnique + create + P2002 catch
    let user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      try {
        user = await this.prisma.user.create({
          data: { name: dto.name, email: dto.email, phone: dto.phone, passwordHash: '' },
        });
      } catch (e: unknown) {
        if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
          // Another concurrent request created this user — re-fetch
          user = await this.prisma.user.findUnique({ where: { email: dto.email } });
          if (!user) throw e;
        } else {
          throw e;
        }
      }
    }

    // Unique constraint on tenantCode is the final safety net; retry up to 5 times
    for (let attempt = 0; attempt < 5; attempt++) {
      const tenantCode = generateTenantCode();
      try {
        return await this.prisma.tenant.create({
          data: {
            userId: user.id,
            propertyId: dto.propertyId,
            tenantCode,
            depositAmount: new Prisma.Decimal(dto.depositAmount),
            leadSource: dto.leadSource,
          },
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        });
      } catch (e: unknown) {
        const isCodeConflict =
          e instanceof PrismaClientKnownRequestError &&
          e.code === 'P2002' &&
          (e.meta?.target as string[] | undefined)?.includes('tenantCode');
        if (isCodeConflict && attempt < 4) continue;
        throw e;
      }
    }

    throw new Error('Failed to generate a unique tenant code after 5 attempts');
  }

  /**
   * UX-001 — Onboarding progress summary for the operator dashboard / mobile app.
   *
   * Returns a structured view of where a tenant is in the onboarding lifecycle,
   * what steps are done, and the immediate next action. This prevents operators
   * from having to infer progress from raw status flags scattered across the record.
   */
  async getOnboardingStatus(tenantId: string, ctx: RequestContext) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        status: true,
        depositCompleted: true,
        kycCompleted: true,
        agreementSigned: true,
        visitScheduledAt: true,
        visitedAt: true,
        moveInDate: true,
        depositAmount: true,
        depositBalance: true,
        kycStatus: true,
        propertyId: true,
        allocations: {
          where: { isActive: true },
          take: 1,
          select: { id: true, bed: { select: { label: true, room: { select: { number: true } } } } },
        },
        documents: {
          select: { id: true, type: true, verifiedAt: true },
        },
      },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    // Property-scoped access check
    if (ctx.systemRole !== 'SUPER_ADMIN') {
      const role = await this.prisma.propertyRole.findUnique({
        where: { propertyId_userId: { propertyId: tenant.propertyId, userId: ctx.userId } },
        select: { id: true },
      });
      if (!role) throw new ForbiddenException('Access denied to this tenant');
    }

    // ── Step completion logic ─────────────────────────────────────────────────
    // Steps are ordered; a step is "completed" once its condition is satisfied
    // regardless of whether later steps are done.
    const statusOrder = [
      'LEAD', 'VISIT_SCHEDULED', 'VISITED', 'ROOM_FINALIZED',
      'PENDING_COMPLIANCE', 'DEPOSIT_PENDING', 'KYC_PENDING',
      'ACTIVE', 'NOTICE_PERIOD', 'MOVED_OUT', 'ARCHIVED',
    ];
    const statusRank = (s: string) => {
      const idx = statusOrder.indexOf(s);
      return idx === -1 ? 0 : idx;
    };
    const rank = statusRank(tenant.status);

    const steps = {
      LEAD_CREATED:       true,
      VISIT_SCHEDULED:    !!tenant.visitScheduledAt || rank >= statusRank('VISIT_SCHEDULED'),
      VISIT_COMPLETED:    !!tenant.visitedAt         || rank >= statusRank('VISITED'),
      ROOM_FINALIZED:     rank >= statusRank('ROOM_FINALIZED'),
      DEPOSIT_PAID:       tenant.depositCompleted,
      KYC_VERIFIED:       tenant.kycCompleted,
      AGREEMENT_SIGNED:   tenant.agreementSigned,
      MOVED_IN:           !!tenant.moveInDate,
    };

    const completedSteps = (Object.keys(steps) as (keyof typeof steps)[]).filter((k) => steps[k]);

    // ── Current step ─────────────────────────────────────────────────────────
    const orderedKeys = Object.keys(steps) as (keyof typeof steps)[];
    const currentStep = orderedKeys.find((k) => !steps[k]) ?? 'COMPLETED';

    // ── Pending actions (compliance gate — all three must be cleared for ACTIVE) ──
    const pendingActions: string[] = [];
    if (rank >= statusRank('ROOM_FINALIZED') && !steps.MOVED_IN) {
      if (!tenant.depositCompleted) {
        const remaining = Number(tenant.depositAmount) - Number(tenant.depositBalance);
        pendingActions.push(
          remaining > 0
            ? `Collect deposit — ₹${remaining.toLocaleString('en-IN')} remaining`
            : 'Mark deposit as completed',
        );
      }
      if (!tenant.kycCompleted) {
        const docCount = tenant.documents.length;
        pendingActions.push(
          docCount === 0
            ? 'Request KYC documents from tenant'
            : `Verify KYC documents (${docCount} uploaded, status: ${tenant.kycStatus})`,
        );
      }
      if (!tenant.agreementSigned) {
        pendingActions.push('Get rental agreement signed by both parties');
      }
    }

    // ── Next action ───────────────────────────────────────────────────────────
    let nextAction: string | null = null;
    if (currentStep !== 'COMPLETED') {
      const nextActionMap: Record<string, string> = {
        VISIT_SCHEDULED:  'Schedule a property visit',
        VISIT_COMPLETED:  'Mark visit as completed',
        ROOM_FINALIZED:   'Select and finalise a bed for the tenant',
        DEPOSIT_PAID:     pendingActions[0] ?? 'Record deposit payment',
        KYC_VERIFIED:     'Complete KYC verification',
        AGREEMENT_SIGNED: 'Get agreement signed',
        MOVED_IN:         'Complete move-in to activate the tenant',
      };
      nextAction = nextActionMap[currentStep] ?? null;
    }

    return {
      success: true,
      data: {
        tenantId: tenant.id,
        status: tenant.status,
        currentStep,
        completedSteps,
        pendingActions,
        nextAction,
        compliance: {
          depositPaid:      tenant.depositCompleted,
          kycVerified:      tenant.kycCompleted,
          agreementSigned:  tenant.agreementSigned,
        },
        allocation: tenant.allocations[0] ?? null,
      },
    };
  }
}
