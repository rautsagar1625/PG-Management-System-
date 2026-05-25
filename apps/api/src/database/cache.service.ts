import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Lightweight Redis-backed cache service.
 *
 * Supports `REDIS_URL` (preferred, e.g. `redis://host:6379`) or the
 * legacy `REDIS_HOST` + `REDIS_PORT` pair used by the BullMQ module.
 *
 * All cache values are JSON-serialised.  A TTL must always be provided
 * to avoid unbounded memory growth in Redis.
 *
 * Key naming convention:
 *   <namespace>:<discriminator>   e.g.  dashboard:operator:<userId>:2025-05
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis | null = null;
  private readonly isEnabled: boolean;

  constructor(private readonly config: ConfigService) {
    const redisUrl = config.get<string>('REDIS_URL');
    const host     = config.get<string>('REDIS_HOST', 'localhost');
    const port     = config.get<number>('REDIS_PORT', 6379);
    const password = config.get<string>('REDIS_PASSWORD');

    try {
      this.client = redisUrl
        ? new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 })
        : new Redis({ host, port, password, lazyConnect: true, maxRetriesPerRequest: 2 });

      this.client.on('error', (err) => {
        this.logger.warn(`Redis error (caching degraded): ${err.message}`);
      });

      this.isEnabled = true;
    } catch (err) {
      this.logger.warn('Could not create Redis client — caching disabled');
      this.isEnabled = false;
    }
  }

  async onModuleInit() {
    if (!this.client) return;
    try {
      await this.client.connect();
      this.logger.log('Cache connected to Redis');
    } catch {
      this.logger.warn('Redis not reachable — cache will be a no-op');
    }
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => undefined);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Returns the cached value for `key` or `null` if absent / not available.
   * Never throws — cache misses are always silent.
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client || !this.isEnabled) return null;
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  /**
   * Stores `value` under `key` with a TTL in seconds.
   * Never throws — cache writes are always best-effort.
   */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.client || !this.isEnabled) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      /* ignore */
    }
  }

  /**
   * Deletes one or more keys by exact name.
   */
  async del(...keys: string[]): Promise<void> {
    if (!this.client || !this.isEnabled || keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch {
      /* ignore */
    }
  }

  /**
   * Deletes all keys matching a Redis SCAN pattern, e.g. `dashboard:operator:*`.
   * Uses SCAN to avoid blocking — safe in production.
   */
  async delPattern(pattern: string): Promise<void> {
    if (!this.client || !this.isEnabled) return;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = next;
        if (keys.length > 0) await this.client.del(...keys);
      } while (cursor !== '0');
    } catch {
      /* ignore */
    }
  }

  // ── Health ──────────────────────────────────────────────────────────────────

  /**
   * PR-001 fix: Returns true when the Redis connection is alive.
   * Used by the health controller so Kubernetes readiness probes detect
   * Redis outages before routing traffic to a degraded instance.
   */
  async ping(): Promise<boolean> {
    if (!this.client || !this.isEnabled) return false;
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  // ── Convenience wrapper ─────────────────────────────────────────────────────

  /**
   * Cache-aside helper.  Tries the cache first; on miss, calls `fetchFn`,
   * stores the result, and returns it.  On any Redis error the `fetchFn`
   * result is returned directly (graceful degradation).
   */
  async wrap<T>(key: string, ttlSeconds: number, fetchFn: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const fresh = await fetchFn();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }
}
