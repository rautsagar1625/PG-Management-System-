import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '@pg-system/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantSelfService, CreateTenantComplaintDto } from './tenant-self.service';

@ApiTags('Tenant Self-Service')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tenant')
export class TenantSelfController {
  constructor(private tenantSelfService: TenantSelfService) {}

  @Get('dashboard')
  @ApiOperation({ summary: "Get tenant's own dashboard" })
  getDashboard(@CurrentUser() ctx: RequestContext) {
    return this.tenantSelfService.getDashboard(ctx.userId);
  }

  @Get('rent-history')
  @ApiOperation({ summary: "Get tenant's rent cycle history" })
  getRentHistory(@CurrentUser() ctx: RequestContext) {
    return this.tenantSelfService.getRentHistory(ctx.userId);
  }

  @Get('complaints')
  @ApiOperation({ summary: "Get tenant's complaints" })
  getComplaints(@CurrentUser() ctx: RequestContext) {
    return this.tenantSelfService.getComplaints(ctx.userId);
  }

  @Post('complaints')
  @ApiOperation({ summary: 'Raise a new complaint (tenant)' })
  createComplaint(
    @CurrentUser() ctx: RequestContext,
    @Body() dto: CreateTenantComplaintDto,
  ) {
    return this.tenantSelfService.createComplaint(ctx.userId, dto);
  }

  @Get('profile')
  @ApiOperation({ summary: "Get tenant's own profile and stay details" })
  getProfile(@CurrentUser() ctx: RequestContext) {
    return this.tenantSelfService.getProfile(ctx.userId);
  }
}
