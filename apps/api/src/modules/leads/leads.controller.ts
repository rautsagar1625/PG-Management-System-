import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { RequestContext } from '@pg-system/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  LeadsService,
  CreateLeadDto,
  UpdateLeadStatusDto,
  AssignLeadDto,
  ScheduleVisitDto,
  ConvertLeadDto,
} from './leads.service';

@ApiTags('Leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leads')
export class LeadsController {
  constructor(private leadsService: LeadsService) {}

  @Get()
  @ApiOperation({ summary: 'List leads for a property' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  findAll(
    @Query('propertyId') propertyId: string,
    @Query() filters: { status?: string },
  ) {
    return this.leadsService.findAll(propertyId, filters);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new lead' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  create(@Body() dto: CreateLeadDto, @CurrentUser() ctx: RequestContext) {
    return this.leadsService.create(dto, ctx.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lead detail' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  findOne(@Param('id') id: string) {
    return this.leadsService.findOne(id);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update lead status' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateLeadStatusDto) {
    return this.leadsService.updateStatus(id, dto);
  }

  @Put(':id/assign')
  @ApiOperation({ summary: 'Assign lead to staff member' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  assign(@Param('id') id: string, @Body() dto: AssignLeadDto) {
    return this.leadsService.assign(id, dto);
  }

  @Put(':id/schedule-visit')
  @ApiOperation({ summary: 'Schedule a site visit for the lead' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  scheduleVisit(@Param('id') id: string, @Body() dto: ScheduleVisitDto) {
    return this.leadsService.scheduleVisit(id, dto);
  }

  @Put(':id/convert')
  @ApiOperation({ summary: 'Convert lead to tenant' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  convert(@Param('id') id: string, @Body() dto: ConvertLeadDto) {
    return this.leadsService.convert(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete lead (mark as LOST)' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  softDelete(@Param('id') id: string) {
    return this.leadsService.softDelete(id);
  }
}
