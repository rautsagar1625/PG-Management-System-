import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import type { RequestContext } from '@pg-system/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantWorkflowService, MoveInDto, MoveOutDto, RoomTransferDto, ScheduleVisitDto } from './tenant-workflow.service';
import { TenantsService, CreateTenantDto } from './tenants.service';

@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantsController {
  constructor(
    private tenantsService: TenantsService,
    private workflowService: TenantWorkflowService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List tenants with optional filters' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  findAll(
    @CurrentUser() ctx: RequestContext,
    @Query() query: { page?: number; limit?: number; search?: string; propertyId?: string; status?: string },
  ) {
    return this.tenantsService.findAll(ctx, query);
  }

  @Post()
  @ApiOperation({ summary: 'Add a new lead/tenant' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant details' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  findOne(@Param('id') id: string, @CurrentUser() ctx: RequestContext) {
    return this.tenantsService.findOne(id, ctx);
  }

  // ── Workflow transitions ───────────────────────────

  @Put(':id/schedule-visit')
  @ApiOperation({ summary: 'Schedule a property visit for a lead' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  scheduleVisit(
    @Param('id') id: string,
    @Body() dto: ScheduleVisitDto,
  ) {
    return this.workflowService.scheduleVisit(id, dto.visitDate, dto.notes);
  }

  @Put(':id/mark-visited')
  @ApiOperation({ summary: 'Mark visit as completed' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  markVisited(@Param('id') id: string) {
    return this.workflowService.markVisited(id);
  }

  @Put(':id/finalize-room')
  @ApiOperation({ summary: 'Finalize room/bed selection and reserve the bed' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  finalizeRoom(
    @Param('id') id: string,
    @Body() body: { bedId: string; depositAmount: number },
  ) {
    return this.workflowService.finalizeRoom(id, body.bedId, body.depositAmount);
  }

  @Put(':id/move-in')
  @ApiOperation({ summary: 'Complete move-in — activates tenant' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  moveIn(@Param('id') id: string, @Body() dto: MoveInDto) {
    return this.workflowService.moveIn(id, dto);
  }

  @Put(':id/initiate-notice')
  @ApiOperation({ summary: 'Start notice period' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  initiateNotice(@Param('id') id: string) {
    return this.workflowService.initiateNotice(id);
  }

  @Put(':id/move-out')
  @ApiOperation({ summary: 'Complete move-out and release bed' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  moveOut(
    @Param('id') id: string,
    @Body() dto: MoveOutDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.workflowService.moveOut(id, dto, ctx.userId);
  }

  @Put(':id/transfer-room')
  @ApiOperation({ summary: 'Transfer tenant to a different bed' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  roomTransfer(@Param('id') id: string, @Body() dto: RoomTransferDto) {
    return this.workflowService.roomTransfer(id, dto);
  }

  @Get(':id/move-out-preview')
  @ApiOperation({ summary: 'Preview move-out settlement: pending dues and deposit balance' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  getMoveOutPreview(@Param('id') id: string) {
    return this.workflowService.getMoveOutPreview(id);
  }

  @Put(':id/cancel-notice')
  @ApiOperation({ summary: 'Cancel notice period and reinstate tenant as active' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  cancelNotice(@Param('id') id: string) {
    return this.workflowService.cancelNotice(id);
  }

  @Put(':id/archive')
  @ApiOperation({ summary: 'Archive a moved-out tenant record' })
  @PropertyRoles('OWNER', 'OPERATOR')
  archive(@Param('id') id: string) {
    return this.workflowService.archive(id);
  }
}
