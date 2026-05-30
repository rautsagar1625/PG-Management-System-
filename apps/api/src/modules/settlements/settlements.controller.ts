import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

import type { RequestContext } from '@pg-system/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SettlementsService } from './settlements.service';

export class CalculateSettlementDto {
  @IsString()
  propertyId: string;

  @IsNumber()
  @Min(1)
  @Max(12)
  month: number;

  @IsNumber()
  @Min(2000)
  year: number;
}

export class MarkSettlementPaidDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

@ApiTags('Settlements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settlements')
export class SettlementsController {
  constructor(private settlementsService: SettlementsService) { }

  @Post('calculate')
  @ApiOperation({ summary: 'Calculate owner-operator settlement for a month' })
  @PropertyRoles('OWNER', 'OPERATOR')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  calculate(
    @Body() body: CalculateSettlementDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.settlementsService.calculateSettlement(
      body.propertyId,
      body.month,
      body.year,
      ctx.userId,
    );
  }

  // RB-001/RB-002 fix: propertyId is now required in the body so the
  // PropertyRoleGuard can extract it and verify the caller has OWNER/OPERATOR
  // access on that specific property. The service also verifies the settlement
  // belongs to that property (cross-property data leak prevention).
  @Put(':id/mark-paid')
  @ApiOperation({ summary: 'Mark settlement as paid by owner' })
  @PropertyRoles('OWNER', 'OPERATOR')
  markPaid(
    @Param('id') id: string,
    @Body() body: { propertyId: string; notes?: string },
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.settlementsService.markSettlementPaid(id, ctx.userId, body.propertyId, body.notes);
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

  // RB-001/RB-002 fix: propertyId is now required as a query param so the
  // PropertyRoleGuard can extract it. Previously the guard had no propertyId to
  // check and either blocked everyone (403) or allowed all authenticated users
  // to read any settlement by ID (financial data leak across properties).
  @Get(':id')
  @ApiOperation({ summary: 'Get settlement detail by ID — requires ?propertyId=<id>' })
  @PropertyRoles('OWNER', 'OPERATOR')
  getSettlement(
    @Param('id') id: string,
    @Query('propertyId') propertyId: string,
  ) {
    return this.settlementsService.getSettlement(id, propertyId);
  }
}
