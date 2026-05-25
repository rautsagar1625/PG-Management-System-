import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import type { RequestContext } from '@pg-system/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PropertyRoles, Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiAuthResponses, ApiBadRequestResponse, ApiNotFoundResponse, ApiWriteResponses } from '../../common/decorators/api-responses.decorator';
import { RentService, RecordPaymentDto } from './rent.service';

@ApiTags('Rent')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rent')
export class RentController {
  constructor(private rentService: RentService) {}

  @Post('generate-cycles')
  @ApiOperation({ summary: 'Generate rent cycles for all active tenants in a property' })
  @ApiResponse({ status: 201, description: 'Rent cycles created (skips already-existing cycles)' })
  @ApiWriteResponses()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  generateCycles(@Body() body: { propertyId: string; month: number; year: number }) {
    return this.rentService.generateRentCycles(body.propertyId, body.month, body.year);
  }

  @Post('payment')
  @ApiOperation({ summary: 'Record a payment (rent, deposit, fine, etc.)' })
  @ApiResponse({ status: 201, description: 'Payment recorded and receipt generated' })
  @ApiWriteResponses()
  @ApiNotFoundResponse()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  recordPayment(@Body() dto: RecordPaymentDto, @CurrentUser() ctx: RequestContext) {
    return this.rentService.recordPayment(dto, ctx.userId);
  }

  @Get('tenant/:tenantId/cycles')
  @ApiOperation({ summary: 'Get rent cycles for a tenant' })
  @ApiResponse({ status: 200, description: 'Filtered list of rent cycles' })
  @ApiAuthResponses()
  @ApiNotFoundResponse()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  getRentCycles(
    @Param('tenantId') tenantId: string,
    @Query() filters: { month?: number; year?: number; status?: string },
  ) {
    return this.rentService.getRentCycles(tenantId, filters);
  }

  @Get('property/:propertyId/summary')
  @ApiOperation({ summary: 'Get rent collection summary for a property/month' })
  @ApiResponse({ status: 200, description: 'Aggregated collection amounts and counts for the month' })
  @ApiAuthResponses()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  getSummary(
    @Param('propertyId') propertyId: string,
    @Query() query: { month: number; year: number },
  ) {
    return this.rentService.getPropertyRentSummary(propertyId, query.month, query.year);
  }

  @Get('collections')
  @ApiOperation({ summary: 'Collections center — paginated cycles with tenant/room info' })
  @ApiResponse({ status: 200, description: 'Paginated rent cycles with tenant and bed info' })
  @ApiAuthResponses()
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
  @ApiResponse({ status: 200, description: 'Receipt with payment, tenant, and property details' })
  @ApiAuthResponses()
  @ApiNotFoundResponse()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  getReceipt(@Param('receiptNo') receiptNo: string) {
    return this.rentService.getReceipt(receiptNo);
  }

  @Put('mark-overdue')
  @ApiOperation({ summary: 'Internal: mark eligible cycles as overdue (called by scheduler)' })
  @ApiResponse({ status: 200, description: 'Returns count of cycles marked as overdue' })
  @ApiAuthResponses()
  @Roles('SUPER_ADMIN')
  markOverdue() {
    return this.rentService.markOverdueCycles();
  }
}
