import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check — returns DB connectivity and uptime' })
  async check() {
    const start = Date.now();
    let dbStatus: 'ok' | 'error' = 'ok';
    let dbLatencyMs: number | undefined;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
    } catch {
      dbStatus = 'error';
    }

    return {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      components: {
        database: { status: dbStatus, latencyMs: dbLatencyMs },
      },
    };
  }
}
