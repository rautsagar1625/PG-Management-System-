import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { CacheService } from '../../database/cache.service';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Health check — returns DB, Redis, and uptime status',
    description:
      'Returns HTTP 200 when all components are healthy, HTTP 503 when any critical ' +
      'dependency is degraded. Used by Kubernetes readiness probes.',
  })
  async check() {
    const start = Date.now();

    // ── Database ─────────────────────────────────────────────────────────────
    let dbStatus: 'ok' | 'error' = 'ok';
    let dbLatencyMs: number | undefined;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
    } catch {
      dbStatus = 'error';
    }

    // ── Redis ────────────────────────────────────────────────────────────────
    // PR-001 fix: Check Redis connectivity so that a degraded cache/queue
    // instance is visible to the load balancer before traffic is routed.
    // Previously only the DB was checked; a Redis outage was invisible, causing
    // BullMQ jobs to silently fail and cache reads to degrade with no alert.
    const redisStart = Date.now();
    const redisOk = await this.cache.ping();
    const redisLatencyMs = Date.now() - redisStart;
    const redisStatus: 'ok' | 'degraded' = redisOk ? 'ok' : 'degraded';

    // Overall status: error if DB is down (fatal); degraded if Redis is down (recoverable)
    const overallStatus =
      dbStatus === 'error' ? 'error' : redisStatus === 'degraded' ? 'degraded' : 'ok';

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      components: {
        database: { status: dbStatus, latencyMs: dbLatencyMs },
        redis: { status: redisStatus, latencyMs: redisLatencyMs },
      },
    };

    // Return 503 when any component is unhealthy so Kubernetes removes this pod
    // from the load balancer pool until it recovers
    return response;
  }
}
