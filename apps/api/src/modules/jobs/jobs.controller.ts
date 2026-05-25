import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { JobsService } from './jobs.service';

@ApiTags('Jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles('SUPER_ADMIN') // job management is platform-level only
@Controller('jobs')
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Get('queues')
  @ApiOperation({
    summary: 'Queue depth metrics — waiting/active/failed/delayed/completed counts per queue',
    description:
      'Returns a real-time snapshot of all managed BullMQ queue depths. ' +
      'Use this to spot backlogs, failed-job spikes, or stalled workers without ' +
      'needing direct Redis access. Restricted to SUPER_ADMIN.',
  })
  getQueueMetrics() {
    return this.jobsService.getQueueMetrics();
  }

  @Get('failed')
  @ApiOperation({
    summary: 'Inspect failed background jobs — DLQ view for ops',
    description:
      'Returns the most recent failed jobs across all managed queues. ' +
      'Jobs are retained for up to 500 entries each. Use this to investigate ' +
      'without needing direct Redis access.',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (default 20, max 100)' })
  getFailedJobs(@Query('limit') limit?: string) {
    const parsedLimit = Math.min(Number(limit ?? 20), 100);
    return this.jobsService.getFailedJobs(parsedLimit);
  }

  @Post('trigger/rent-cycles')
  @ApiOperation({ summary: 'Manually trigger rent cycle generation for current month (all properties)' })
  @ApiQuery({ name: 'propertyId', required: false })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'year', required: false })
  triggerRentCycles(
    @Query('propertyId') propertyId?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const now = new Date();
    return this.jobsService.triggerRentCycleGeneration(
      propertyId ?? '',
      month ? Number(month) : now.getMonth() + 1,
      year ? Number(year) : now.getFullYear(),
    );
  }

  @Post('trigger/overdue-marking')
  @ApiOperation({ summary: 'Manually trigger overdue rent cycle marking' })
  triggerOverdue() {
    return this.jobsService.triggerOverdueMarking();
  }
}
