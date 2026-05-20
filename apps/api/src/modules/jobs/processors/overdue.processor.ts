import * as Sentry from '@sentry/node';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RentCycleStatus } from '@prisma/client';
import { Job } from 'bullmq';

import { RENT_GRACE_PERIOD_DAYS } from '@pg-system/constants';

import { PrismaService } from '../../../database/prisma.service';
import { DOMAIN_EVENTS, RentOverdueEvent } from '../../../events/domain-events';
import { JOB_MARK_OVERDUE, QUEUE_OVERDUE } from '../jobs.constants';

@Processor(QUEUE_OVERDUE)
export class OverdueProcessor extends WorkerHost {
  private readonly logger = new Logger(OverdueProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job) {
    if (job.name !== JOB_MARK_OVERDUE) return;

    const graceCutoff = new Date();
    graceCutoff.setDate(graceCutoff.getDate() - RENT_GRACE_PERIOD_DAYS);
    graceCutoff.setHours(0, 0, 0, 0);

    // Load cycles before updating so we have tenant data for events
    const cyclesAboutToOverdue = await this.prisma.rentCycle.findMany({
      where: {
        status: { in: [RentCycleStatus.PENDING, RentCycleStatus.DUE, RentCycleStatus.PARTIAL] },
        dueDate: { lt: graceCutoff },
      },
      select: {
        id: true,
        tenantId: true,
        month: true,
        year: true,
        remainingAmount: true,
        tenant: { select: { userId: true, propertyId: true } },
      },
    });

    const result = await this.prisma.rentCycle.updateMany({
      where: {
        status: { in: [RentCycleStatus.PENDING, RentCycleStatus.DUE, RentCycleStatus.PARTIAL] },
        dueDate: { lt: graceCutoff },
      },
      data: { status: RentCycleStatus.OVERDUE },
    });

    // Emit one event per newly overdue cycle so notifications and other
    // listeners can react per-tenant without re-querying the DB
    for (const cycle of cyclesAboutToOverdue) {
      this.eventEmitter.emit(DOMAIN_EVENTS.RENT_OVERDUE, {
        tenantId: cycle.tenantId,
        tenantUserId: cycle.tenant.userId,
        propertyId: cycle.tenant.propertyId,
        cycleId: cycle.id,
        amount: Number(cycle.remainingAmount),
        month: cycle.month,
        year: cycle.year,
      } satisfies RentOverdueEvent);
    }

    this.logger.log(`Overdue marking complete: ${result.count} cycles updated`);
    return { markedOverdue: result.count, runAt: graceCutoff.toISOString() };
  }
}
