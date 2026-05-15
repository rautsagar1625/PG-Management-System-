import { Module } from '@nestjs/common';
import { TenantSelfController } from './tenant-self.controller';
import { TenantSelfService } from './tenant-self.service';

@Module({
  controllers: [TenantSelfController],
  providers: [TenantSelfService],
})
export class TenantSelfModule {}
