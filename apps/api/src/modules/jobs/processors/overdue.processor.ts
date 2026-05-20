import * as Sentry from '@sentry/node';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { RentCycleStatus } from '@prisma/client';
import { Job } from 'bullmq';

import { RENT_GRACE_PERIOD_DAYS } from '@pg-system/constants';

import { PrismaService } from '../../../database/prisma.service';
import { JOB_MARK_OVERDUE, QUEUE_OVERDUE } from '../jobs.constants';

@Processor(QUEUE_OVERDUE)
export class OverdueProcessor extends WorkerHost {
  private readonly logger = new Logger(OverdueProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job) {
    if (job.name !== JOB_MARK_OVERDUE) return;

    const graceCutoff = new Date();
    graceCutoff.setDate(graceCutoff.getDate() - RENT_GRACE_PERIOD_DAYS);
    graceCutoff.setHours(0, 0, 0, 0);

    const result = await this.prisma.rentCycle.updateMany({
      where: {
        status: { in: [RentCycleStatus.PENDING, RentCycleStatus.DUE, RentCycleStatus.PARTIAL] },
        dueDate: { lt: graceCutoff },
      },
      data: { status: RentCycleStatus.OVERDUE },
    });

    this.logger.log(`Overdue marking complete: ${result.count} cycles updated`);
    return { markedOverdue: result.count, runAt: graceCutoff.toISOString() };
  }
}
