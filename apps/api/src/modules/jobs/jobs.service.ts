import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';

import { FilesService } from '../files/files.service';

import {
  JOB_GENERATE_RENT_CYCLES,
  JOB_MARK_OVERDUE,
  QUEUE_NOTIFICATIONS,
  QUEUE_OVERDUE,
  QUEUE_RENT_CYCLE,
} from './jobs.constants';

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue(QUEUE_RENT_CYCLE) private readonly rentCycleQueue: Queue,
    @InjectQueue(QUEUE_OVERDUE) private readonly overdueQueue: Queue,
    @InjectQueue(QUEUE_NOTIFICATIONS) private readonly notificationsQueue: Queue,
    private readonly filesService: FilesService,
  ) {}

  async onModuleInit() {
    // Drain any stale jobs left from previous deploys to avoid double-processing
    await this.rentCycleQueue.drain();
    await this.overdueQueue.drain();
    this.logger.log('Job queues initialised');
  }

  /**
   * Fires at 00:05 on the 1st of every month.
   * Generates rent cycles for all active properties for the current month.
   */
  @Cron('5 0 1 * *', { name: 'generate-rent-cycles', timeZone: 'Asia/Kolkata' })
  async scheduleRentCycleGeneration() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    this.logger.log(`Enqueuing rent cycle generation for ${year}-${month}`);
    await this.rentCycleQueue.add(
      JOB_GENERATE_RENT_CYCLES,
      { month, year },
      { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
    );
  }

  /**
   * Fires every day at 01:00 — marks past-due cycles as OVERDUE.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'mark-overdue', timeZone: 'Asia/Kolkata' })
  async scheduleOverdueMarking() {
    this.logger.log('Enqueuing overdue-marking job');
    await this.overdueQueue.add(
      JOB_MARK_OVERDUE,
      {},
      { attempts: 3, backoff: { type: 'exponential', delay: 30_000 } },
    );
  }

  /** Manual trigger — enqueue rent cycle generation for a specific property/month. */
  async triggerRentCycleGeneration(propertyId: string, month: number, year: number) {
    return this.rentCycleQueue.add(
      JOB_GENERATE_RENT_CYCLES,
      { month, year, propertyId },
      { attempts: 3, backoff: { type: 'exponential', delay: 30_000 } },
    );
  }

  /** Manual trigger — enqueue overdue marking immediately. */
  async triggerOverdueMarking() {
    return this.overdueQueue.add(JOB_MARK_OVERDUE, {}, { attempts: 3 });
  }

  /**
   * SP4-1: Failed job inspection endpoint.
   * Returns up to 100 most recent failed jobs across all managed queues so
   * operators can investigate without needing direct Redis access.
   * Jobs are retained for up to 500 entries (removeOnFail in module config).
   */
  async getFailedJobs(limit = 20) {
    const [rentFailed, overdueFailed] = await Promise.all([
      this.rentCycleQueue.getFailed(0, limit - 1),
      this.overdueQueue.getFailed(0, limit - 1),
    ]);

    const toSummary = (job: Awaited<ReturnType<Queue['getFailed']>>[number], queue: string) => ({
      queue,
      jobId: job.id,
      jobName: job.name,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      payload: job.data,
      failedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    });

    return {
      success: true,
      data: [
        ...rentFailed.map((j) => toSummary(j, QUEUE_RENT_CYCLE)),
        ...overdueFailed.map((j) => toSummary(j, QUEUE_OVERDUE)),
      ].sort((a, b) => (b.failedAt ?? '').localeCompare(a.failedAt ?? '')).slice(0, limit),
    };
  }

  /**
   * OB-6: Queue depth snapshot for ops visibility.
   * Returns waiting / active / failed / delayed / completed counts for each
   * managed queue so platform admins can spot backlogs without Redis access.
   * Counts are fetched in parallel to keep latency minimal.
   */
  async getQueueMetrics() {
    const [rentCounts, overdueCounts, notificationCounts] = await Promise.all([
      this.rentCycleQueue.getJobCounts('waiting', 'active', 'failed', 'delayed', 'completed'),
      this.overdueQueue.getJobCounts('waiting', 'active', 'failed', 'delayed', 'completed'),
      this.notificationsQueue.getJobCounts('waiting', 'active', 'failed', 'delayed', 'completed'),
    ]);

    return {
      success: true,
      data: {
        queues: [
          { name: QUEUE_RENT_CYCLE, ...rentCounts },
          { name: QUEUE_OVERDUE, ...overdueCounts },
          { name: QUEUE_NOTIFICATIONS, ...notificationCounts },
        ],
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  /** Every 30 minutes — expire PENDING upload records whose presigned URL has lapsed. */
  @Cron('*/30 * * * *', { name: 'expire-stale-uploads' })
  async expireStalePendingUploads() {
    await this.filesService.expireStalePendingUploads();
  }
}
