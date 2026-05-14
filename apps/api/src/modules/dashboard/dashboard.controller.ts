import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { RequestContext } from '@pg-system/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
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
}
