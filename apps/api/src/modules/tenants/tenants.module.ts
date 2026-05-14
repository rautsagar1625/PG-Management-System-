import { Module } from '@nestjs/common';

import { AllocationModule } from '../allocation/allocation.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantWorkflowService } from './tenant-workflow.service';

@Module({
  imports: [AllocationModule],
  controllers: [TenantsController],
  providers: [TenantsService, TenantWorkflowService],
  exports: [TenantsService],
})
export class TenantsModule {}
