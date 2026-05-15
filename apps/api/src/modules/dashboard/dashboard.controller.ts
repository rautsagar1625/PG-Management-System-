import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { RequestContext } from '@pg-system/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('operator')
  @ApiOperation({ summary: 'Operator dashboard — all properties summary' })
  operatorDashboard(@CurrentUser() ctx: RequestContext) {
    return this.dashboardService.getOperatorDashboard(ctx.userId);
  }

  @Get('tenant')
  @ApiOperation({ summary: 'Tenant dashboard — current rent & payments' })
  tenantDashboard(@CurrentUser() ctx: RequestContext) {
    return this.dashboardService.getTenantDashboard(ctx.userId);
  }

  @Get('property/:propertyId/performance')
  @ApiOperation({ summary: 'Detailed operational performance for a single property' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  propertyPerformance(@Param('propertyId') propertyId: string) {
    return this.dashboardService.getPropertyPerformance(propertyId);
  }
}
