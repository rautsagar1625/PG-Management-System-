import * as Sentry from '@sentry/node';
import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { PrismaService } from '../../../database/prisma.service';
import { RentService } from '../../rent/rent.service';
import {
  JOB_GENERATE_RENT_CYCLES,
  JOB_GENERATE_RENT_CYCLES_PROPERTY,
  QUEUE_RENT_CYCLE,
} from '../jobs.constants';

interface GenerateRentCyclesPayload {
  month: number;
  year: number;
  propertyId?: string; // undefined → orchestrate fan-out; defined → leaf job for one property
}

// FS-007: Fan-out architecture for rent cycle generation.
//
// OLD (serial): one job iterates through all 500+ properties one by one — a single
// slow property (network hiccup, index miss) blocks all subsequent properties.
// If the worker crashes mid-loop, partially-processed properties are not retried.
//
// NEW (fan-out):
//   1. The cron enqueues ONE orchestrator job (propertyId = undefined).
//   2. The orchestrator fetches all active property IDs and enqueues one
//      leaf job (JOB_GENERATE_RENT_CYCLES_PROPERTY) per property.
//   3. BullMQ's worker concurrency setting (e.g. concurrency=5) processes
//      up to N properties in parallel.
//   4. Each leaf job is independently retried on failure — a crash on property
//      A does not affect property B.

@Processor(QUEUE_RENT_CYCLE)
export class RentCycleProcessor extends WorkerHost {
  private readonly logger = new Logger(RentCycleProcessor.name);

  constructor(
    private readonly rentService: RentService,
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_RENT_CYCLE) private readonly rentCycleQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<GenerateRentCyclesPayload>) {
    Sentry.withScope((scope) => scope.setTag('jobId', job.id ?? ''));

    // ── Leaf job: generate cycles for one specific property ───────────────────
    if (job.name === JOB_GENERATE_RENT_CYCLES_PROPERTY) {
      const { month, year, propertyId } = job.data;
      if (!propertyId) return; // should never happen — safety guard

      this.logger.debug(`Generating rent cycles for property ${propertyId} ${year}-${month}`);
      const result = await this.rentService.generateRentCycles(propertyId, month, year);
      return { propertyId, month, year, generated: result.generated, total: result.total };
    }

    // ── Orchestrator job: fan out to per-property leaf jobs ───────────────────
    if (job.name === JOB_GENERATE_RENT_CYCLES) {
      const { month, year, propertyId } = job.data;
      this.logger.log(`Orchestrating rent cycle generation for ${year}-${month} propertyId=${propertyId ?? 'ALL'}`);

      const propertyIds = propertyId
        ? [propertyId]
        : await this.getActivePropertyIds();

      if (propertyIds.length === 0) {
        this.logger.warn('No active properties found — nothing to generate');
        return { month, year, properties: 0 };
      }

      // Enqueue one leaf job per property — BullMQ processes them in parallel
      // according to the worker's concurrency setting.
      const leafJobs = propertyIds.map((pid) => ({
        name: JOB_GENERATE_RENT_CYCLES_PROPERTY,
        data: { month, year, propertyId: pid } satisfies GenerateRentCyclesPayload,
        opts: { attempts: 3, backoff: { type: 'exponential' as const, delay: 30_000 } },
      }));
      await this.rentCycleQueue.addBulk(leafJobs);

      this.logger.log(`Enqueued ${propertyIds.length} per-property leaf jobs for ${year}-${month}`);
      return { month, year, propertiesEnqueued: propertyIds.length };
    }
  }

  // SP4-1: DLQ handler — called after all retry attempts are exhausted.
  // Logs structured failure data and captures to Sentry so ops can investigate
  // without tailing raw Redis keys. The job stays in the 'failed' set
  // (removeOnFail: { count: 500 } in jobs.module.ts) for manual inspection.
  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `[DLQ] Job ${job.name}#${job.id} failed after ${job.attemptsMade} attempt(s): ${err.message}`,
      { jobId: job.id, jobName: job.name, payload: job.data, error: err.message, stack: err.stack },
    );
    Sentry.captureException(err, {
      tags: { queue: QUEUE_RENT_CYCLE, jobName: job.name },
      extra: { jobId: job.id, payload: job.data, attemptsMade: job.attemptsMade },
    });
  }

  private async getActivePropertyIds(): Promise<string[]> {
    const properties = await this.prisma.property.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    return properties.map((p) => p.id);
  }
}
