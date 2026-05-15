import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { RequestContext } from '@pg-system/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantWorkflowService, MoveInDto, MoveOutDto, RoomTransferDto } from './tenant-workflow.service';
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
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant details' })
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  // ── Workflow transitions ───────────────────────────

  @Put(':id/schedule-visit')
  @ApiOperation({ summary: 'Schedule a property visit for a lead' })
  scheduleVisit(
    @Param('id') id: string,
    @Body() body: { visitDate: string; notes?: string },
  ) {
    return this.workflowService.scheduleVisit(id, body.visitDate, body.notes);
  }

  @Put(':id/mark-visited')
  @ApiOperation({ summary: 'Mark visit as completed' })
  markVisited(@Param('id') id: string) {
    return this.workflowService.markVisited(id);
  }

  @Put(':id/finalize-room')
  @ApiOperation({ summary: 'Finalize room/bed selection and reserve the bed' })
  finalizeRoom(
    @Param('id') id: string,
    @Body() body: { bedId: string; depositAmount: number },
  ) {
    return this.workflowService.finalizeRoom(id, body.bedId, body.depositAmount);
  }

  @Put(':id/move-in')
  @ApiOperation({ summary: 'Complete move-in — activates tenant' })
  moveIn(@Param('id') id: string, @Body() dto: MoveInDto) {
    return this.workflowService.moveIn(id, dto);
  }

  @Put(':id/initiate-notice')
  @ApiOperation({ summary: 'Start notice period' })
  initiateNotice(@Param('id') id: string) {
    return this.workflowService.initiateNotice(id);
  }

  @Put(':id/move-out')
  @ApiOperation({ summary: 'Complete move-out and release bed' })
  moveOut(@Param('id') id: string, @Body() dto: MoveOutDto) {
    return this.workflowService.moveOut(id, dto);
  }

  @Put(':id/transfer-room')
  @ApiOperation({ summary: 'Transfer tenant to a different bed' })
  roomTransfer(@Param('id') id: string, @Body() dto: RoomTransferDto) {
    return this.workflowService.roomTransfer(id, dto);
  }
}
