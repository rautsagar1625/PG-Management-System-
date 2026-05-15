import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';

import { FilesService } from '../files/files.service';

import {
  JOB_GENERATE_RENT_CYCLES,
  JOB_MARK_OVERDUE,
  QUEUE_OVERDUE,
  QUEUE_RENT_CYCLE,
} from './jobs.constants';

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue(QUEUE_RENT_CYCLE) private readonly rentCycleQueue: Queue,
    @InjectQueue(QUEUE_OVERDUE) private readonly overdueQueue: Queue,
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

  /** Every 30 minutes — expire PENDING upload records whose presigned URL has lapsed. */
  @Cron('*/30 * * * *', { name: 'expire-stale-uploads' })
  async expireStalePendingUploads() {
    await this.filesService.expireStalePendingUploads();
  }
}
