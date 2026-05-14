import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { RequestContext } from '@pg-system/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
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
  generateCycles(@Body() body: { propertyId: string; month: number; year: number }) {
    return this.rentService.generateRentCycles(body.propertyId, body.month, body.year);
  }

  @Post('payment')
  @ApiOperation({ summary: 'Record a payment (rent, deposit, fine, etc.)' })
  recordPayment(@Body() dto: Omit<RecordPaymentDto, 'recordedBy'>, @CurrentUser() ctx: RequestContext) {
    return this.rentService.recordPayment({ ...dto, recordedBy: ctx.userId });
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
  getSummary(
    @Param('propertyId') propertyId: string,
    @Query() query: { month: number; year: number },
  ) {
    return this.rentService.getPropertyRentSummary(propertyId, query.month, query.year);
  }

  @Put('mark-overdue')
  @ApiOperation({ summary: 'Internal: mark eligible cycles as overdue (called by scheduler)' })
  markOverdue() {
    return this.rentService.markOverdueCycles();
  }
}
