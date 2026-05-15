import * as Sentry from '@sentry/node';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { RentCycleStatus } from '@prisma/client';
import { Job } from 'bullmq';

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Mark PENDING and DUE cycles whose dueDate has passed as OVERDUE
    const result = await this.prisma.rentCycle.updateMany({
      where: {
        status: { in: [RentCycleStatus.PENDING, RentCycleStatus.DUE] },
        dueDate: { lt: today },
      },
      data: { status: RentCycleStatus.OVERDUE },
    });

    this.logger.log(`Overdue marking complete: ${result.count} cycles updated`);
    return { markedOverdue: result.count, runAt: today.toISOString() };
  }
}
