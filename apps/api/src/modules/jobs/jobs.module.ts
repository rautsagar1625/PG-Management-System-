import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { FilesModule } from '../files/files.module';
import { RentModule } from '../rent/rent.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { QUEUE_NOTIFICATIONS, QUEUE_OVERDUE, QUEUE_RENT_CYCLE } from './jobs.constants';
import { OverdueProcessor } from './processors/overdue.processor';
import { RentCycleProcessor } from './processors/rent-cycle.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
        defaultJobOptions: {
          removeOnComplete: { count: 100 },
          // SP4-1: keep 500 failed jobs so ops can inspect them via /jobs/failed
          // without needing direct Redis access. DLQ handler logs + Sentry captures each.
          removeOnFail: { count: 500 },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: QUEUE_RENT_CYCLE },
      { name: QUEUE_OVERDUE },
      { name: QUEUE_NOTIFICATIONS },
    ),
    RentModule,
    FilesModule,
  ],
  controllers: [JobsController],
  providers: [JobsService, RentCycleProcessor, OverdueProcessor],
  exports: [JobsService, BullModule],
})
export class JobsModule {}
