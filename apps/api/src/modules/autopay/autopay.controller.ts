import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  AutopayService,
  CreateAutopayMandateDto,
  UpdateMandateStatusDto,
} from './autopay.service';

@ApiTags('Autopay')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('autopay')
export class AutopayController {
  constructor(private autopayService: AutopayService) {}

  @Get()
  @ApiOperation({ summary: 'List autopay mandates for a property' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  findByProperty(@Query('propertyId') propertyId: string) {
    return this.autopayService.findByProperty(propertyId);
  }

  @Get('tenant/:tenantId')
  @ApiOperation({ summary: 'Get autopay mandates for a tenant' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.autopayService.findByTenant(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create / initiate an autopay mandate' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  create(@Body() dto: CreateAutopayMandateDto) {
    return this.autopayService.create(dto);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update mandate status (Razorpay webhook or manual)' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateMandateStatusDto) {
    return this.autopayService.updateStatus(id, dto);
  }

  @Put(':id/cancel')
  @ApiOperation({ summary: 'Cancel an autopay mandate' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  cancel(@Param('id') id: string) {
    return this.autopayService.cancel(id);
  }
}
