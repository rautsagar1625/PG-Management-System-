import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { RequestContext } from '@pg-system/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PropertyRoles, Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RentService, RecordPaymentDto } from './rent.service';

@ApiTags('Rent')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rent')
export class RentController {
  constructor(private rentService: RentService) {}

  @Post('generate-cycles')
  @ApiOperation({ summary: 'Generate rent cycles for all active tenants in a property' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  generateCycles(@Body() body: { propertyId: string; month: number; year: number }) {
    return this.rentService.generateRentCycles(body.propertyId, body.month, body.year);
  }

  @Post('payment')
  @ApiOperation({ summary: 'Record a payment (rent, deposit, fine, etc.)' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  recordPayment(@Body() dto: Omit<RecordPaymentDto, 'recordedBy'> & { propertyId: string }, @CurrentUser() ctx: RequestContext) {
    const { propertyId: _p, ...rest } = dto;
    return this.rentService.recordPayment({ ...rest, recordedBy: ctx.userId });
  }

  @Get('tenant/:tenantId/cycles')
  @ApiOperation({ summary: 'Get rent cycles for a tenant' })
  getRentCycles(
    @Param('tenantId') tenantId: string,
    @Query() filters: { month?: number; year?: number; status?: string },
  ) {
    return this.rentService.getRentCycles(tenantId, filters);
  }

  @Get('property/:propertyId/summary')
  @ApiOperation({ summary: 'Get rent collection summary for a property/month' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  getSummary(
    @Param('propertyId') propertyId: string,
    @Query() query: { month: number; year: number },
  ) {
    return this.rentService.getPropertyRentSummary(propertyId, query.month, query.year);
  }

  @Get('collections')
  @ApiOperation({ summary: 'Collections center — paginated cycles with tenant/room info' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  getCollections(
    @Query()
    query: {
      propertyId: string;
      month: string;
      year: string;
      status?: string;
      search?: string;
      page?: string;
      limit?: string;
    },
  ) {
    return this.rentService.getCollections({
      propertyId: query.propertyId,
      month: Number(query.month),
      year: Number(query.year),
      status: query.status,
      search: query.search,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    });
  }

  @Get('receipt/:receiptNo')
  @ApiOperation({ summary: 'Get receipt details for display/print' })
  getReceipt(@Param('receiptNo') receiptNo: string) {
    return this.rentService.getReceipt(receiptNo);
  }

  @Put('mark-overdue')
  @ApiOperation({ summary: 'Internal: mark eligible cycles as overdue (called by scheduler)' })
  @Roles('SUPER_ADMIN')
  markOverdue() {
    return this.rentService.markOverdueCycles();
  }
}
