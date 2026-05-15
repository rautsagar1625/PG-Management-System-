import * as Sentry from '@sentry/node';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { PrismaService } from '../../../database/prisma.service';
import { RentService } from '../../rent/rent.service';
import { JOB_GENERATE_RENT_CYCLES, QUEUE_RENT_CYCLE } from '../jobs.constants';

interface GenerateRentCyclesPayload {
  month: number;
  year: number;
  propertyId?: string; // undefined = all active properties
}

@Processor(QUEUE_RENT_CYCLE)
export class RentCycleProcessor extends WorkerHost {
  private readonly logger = new Logger(RentCycleProcessor.name);

  constructor(
    private readonly rentService: RentService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<GenerateRentCyclesPayload>) {
    if (job.name !== JOB_GENERATE_RENT_CYCLES) return;
    Sentry.withScope((scope) => scope.setTag('jobId', job.id ?? ''));

    const { month, year, propertyId } = job.data;
    this.logger.log(`Generating rent cycles for ${year}-${month} propertyId=${propertyId ?? 'ALL'}`);

    const propertyIds = propertyId
      ? [propertyId]
      : await this.getActivePropertyIds();

    let totalGenerated = 0;
    let totalSkipped = 0;

    for (const pid of propertyIds) {
      const result = await this.rentService.generateRentCycles(pid, month, year);
      totalGenerated += result.generated;
      totalSkipped += result.total - result.generated;
    }

    const summary = { month, year, properties: propertyIds.length, totalGenerated, totalSkipped };
    this.logger.log(`Rent cycle generation complete: ${JSON.stringify(summary)}`);
    return summary;
  }

  private async getActivePropertyIds(): Promise<string[]> {
    const properties = await this.prisma.property.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    return properties.map((p) => p.id);
  }
}
