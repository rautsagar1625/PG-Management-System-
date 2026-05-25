import * as Sentry from '@sentry/node';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
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

    // ── Step 1: Collect candidate IDs (pre-update snapshot) ──────────────────
    // We read IDs first so we know which records we attempted to update.
    const candidateIds = (
      await this.prisma.rentCycle.findMany({
        where: {
          status: { in: [RentCycleStatus.PENDING, RentCycleStatus.DUE, RentCycleStatus.PARTIAL] },
          dueDate: { lt: graceCutoff },
        },
        select: { id: true },
      })
    ).map((c) => c.id);

    if (candidateIds.length === 0) {
      this.logger.log('Overdue marking: no eligible cycles found');
      return { markedOverdue: 0, runAt: graceCutoff.toISOString() };
    }

    // ── Step 2: Atomic update ─────────────────────────────────────────────────
    // The WHERE clause includes the status filter again, so any cycle that was
    // paid between Step 1 and Step 2 will be silently skipped by the DB engine.
    // This eliminates the TOCTOU window where a newly-PAID cycle could be
    // overwritten back to OVERDUE.
    const result = await this.prisma.rentCycle.updateMany({
      where: {
        id: { in: candidateIds },
        status: { in: [RentCycleStatus.PENDING, RentCycleStatus.DUE, RentCycleStatus.PARTIAL] },
        dueDate: { lt: graceCutoff },
      },
      data: { status: RentCycleStatus.OVERDUE },
    });

    // ── Step 3: Fetch only the cycles that are NOW OVERDUE ────────────────────
    // Any candidate that was paid in the race window will have status=PAID and
    // will be excluded here — preventing spurious RENT_OVERDUE event emission.
    const nowOverdueCycles = await this.prisma.rentCycle.findMany({
      where: {
        id: { in: candidateIds },
        status: RentCycleStatus.OVERDUE,
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

    // Emit one event per newly overdue cycle so notifications and other
    // listeners can react per-tenant without re-querying the DB
    for (const cycle of nowOverdueCycles) {
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

  // SP4-1: DLQ handler — logs and captures failed jobs to Sentry.
  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `[DLQ] Job ${job.name}#${job.id} failed after ${job.attemptsMade} attempt(s): ${err.message}`,
      { jobId: job.id, jobName: job.name, error: err.message, stack: err.stack },
    );
    Sentry.captureException(err, {
      tags: { queue: QUEUE_OVERDUE, jobName: job.name },
      extra: { jobId: job.id, attemptsMade: job.attemptsMade },
    });
  }
}
