import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from './cache.service';

/**
 * Global module — import once in AppModule, available everywhere.
 * Wraps ioredis with a simple get/set/del/wrap API for cache-aside caching.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [CacheService],
  exports:   [CacheService],
})
export class CacheModule {}
