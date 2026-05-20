import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AllocationService } from './allocation.service';

@ApiTags('Allocation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tenants/:tenantId')
export class AllocationController {
  constructor(private allocation: AllocationService) {}

  @Get('allocation')
  @ApiOperation({ summary: 'Get active bed allocation for a tenant' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  getActive(@Param('tenantId') tenantId: string) {
    return this.allocation.getActiveAllocation(tenantId);
  }

  @Get('allocations')
  @ApiOperation({ summary: 'Get full allocation history for a tenant' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  getHistory(@Param('tenantId') tenantId: string) {
    return this.allocation.getAllocationHistory(tenantId);
  }
}
