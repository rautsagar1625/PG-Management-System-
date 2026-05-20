import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import type { RequestContext } from '@pg-system/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SettlementsService } from './settlements.service';

@ApiTags('Settlements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settlements')
export class SettlementsController {
  constructor(private settlementsService: SettlementsService) {}

  @Post('calculate')
  @ApiOperation({ summary: 'Calculate owner-operator settlement for a month' })
  @PropertyRoles('OWNER', 'OPERATOR')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  calculate(
    @Body() body: { propertyId: string; month: number; year: number },
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.settlementsService.calculateSettlement(
      body.propertyId,
      body.month,
      body.year,
      ctx.userId,
    );
  }

  @Put(':id/mark-paid')
  @ApiOperation({ summary: 'Mark settlement as paid by owner' })
  @PropertyRoles('OWNER', 'OPERATOR')
  markPaid(
    @Param('id') id: string,
    @Body() body: { notes?: string },
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.settlementsService.markSettlementPaid(id, ctx.userId, body.notes);
  }

  @Get('property/:propertyId')
  @ApiOperation({ summary: 'Get all settlements for a property' })
  @PropertyRoles('OWNER', 'OPERATOR')
  getSettlements(
    @Param('propertyId') propertyId: string,
    @Query('year') year?: number,
  ) {
    return this.settlementsService.getSettlements(propertyId, year);
  }
}
