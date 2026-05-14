import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AllocationService } from './allocation.service';

@ApiTags('Allocation')
@UseGuards(JwtAuthGuard)
@Controller('tenants/:tenantId')
export class AllocationController {
  constructor(private allocation: AllocationService) {}

  @Get('allocation')
  @ApiOperation({ summary: 'Get active bed allocation for a tenant' })
  getActive(@Param('tenantId') tenantId: string) {
    return this.allocation.getActiveAllocation(tenantId);
  }

  @Get('allocations')
  @ApiOperation({ summary: 'Get full allocation history for a tenant' })
  getHistory(@Param('tenantId') tenantId: string) {
    return this.allocation.getAllocationHistory(tenantId);
  }
}
