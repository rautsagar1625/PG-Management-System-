import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import type { RequestContext } from '@pg-system/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  ApiAuthResponses,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiReadResponses,
  ApiWriteResponses,
} from '../../common/decorators/api-responses.decorator';
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
  @ApiResponse({ status: 200, description: 'Paginated tenant list with user and allocation info' })
  @ApiAuthResponses()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  findAll(
    @CurrentUser() ctx: RequestContext,
    @Query() query: { page?: number; limit?: number; search?: string; propertyId?: string; status?: string },
  ) {
    return this.tenantsService.findAll(ctx, query);
  }

  @Post()
  @ApiOperation({ summary: 'Add a new lead/tenant' })
  @ApiResponse({ status: 201, description: 'Tenant/lead created, user account set up, welcome email sent' })
  @ApiWriteResponses()
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant details' })
  @ApiResponse({ status: 200, description: 'Full tenant profile with documents, payments, and allocations' })
  @ApiReadResponses()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  findOne(@Param('id') id: string, @CurrentUser() ctx: RequestContext) {
    return this.tenantsService.findOne(id, ctx);
  }

  // ── Workflow transitions ───────────────────────────

  @Put(':id/schedule-visit')
  @ApiOperation({ summary: 'Schedule a property visit for a lead' })
  @ApiResponse({ status: 200, description: 'Visit scheduled, tenant status updated' })
  @ApiAuthResponses()
  @ApiNotFoundResponse()
  @ApiBadRequestResponse()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  scheduleVisit(
    @Param('id') id: string,
    @Body() dto: ScheduleVisitDto,
  ) {
    return this.workflowService.scheduleVisit(id, dto.visitDate, dto.notes);
  }

  @Put(':id/mark-visited')
  @ApiOperation({ summary: 'Mark visit as completed' })
  @ApiResponse({ status: 200, description: 'Tenant status moved to VISITED' })
  @ApiAuthResponses()
  @ApiNotFoundResponse()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  markVisited(@Param('id') id: string) {
    return this.workflowService.markVisited(id);
  }

  @Put(':id/finalize-room')
  @ApiOperation({ summary: 'Finalize room/bed selection and reserve the bed' })
  @ApiResponse({ status: 200, description: 'Bed reserved, deposit payment recorded' })
  @ApiAuthResponses()
  @ApiNotFoundResponse()
  @ApiBadRequestResponse()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  finalizeRoom(
    @Param('id') id: string,
    @Body() body: { bedId: string; depositAmount: number },
  ) {
    return this.workflowService.finalizeRoom(id, body.bedId, body.depositAmount);
  }

  @Put(':id/move-in')
  @ApiOperation({ summary: 'Complete move-in — activates tenant' })
  @ApiResponse({ status: 200, description: 'Tenant activated, bed marked OCCUPIED, first rent cycle generated' })
  @ApiAuthResponses()
  @ApiNotFoundResponse()
  @ApiBadRequestResponse()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  moveIn(@Param('id') id: string, @Body() dto: MoveInDto) {
    return this.workflowService.moveIn(id, dto);
  }

  @Put(':id/initiate-notice')
  @ApiOperation({ summary: 'Start notice period' })
  @ApiResponse({ status: 200, description: 'Notice period started, tenant status set to NOTICE_PERIOD' })
  @ApiAuthResponses()
  @ApiNotFoundResponse()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  initiateNotice(@Param('id') id: string) {
    return this.workflowService.initiateNotice(id);
  }

  @Put(':id/move-out')
  @ApiOperation({ summary: 'Complete move-out and release bed' })
  @ApiResponse({ status: 200, description: 'Tenant moved out, bed released, deposit settlement created' })
  @ApiAuthResponses()
  @ApiNotFoundResponse()
  @ApiBadRequestResponse()
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
  @ApiResponse({ status: 200, description: 'Old bed released, new bed occupied, allocation history updated' })
  @ApiAuthResponses()
  @ApiNotFoundResponse()
  @ApiBadRequestResponse()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  roomTransfer(@Param('id') id: string, @Body() dto: RoomTransferDto) {
    return this.workflowService.roomTransfer(id, dto);
  }

  @Get(':id/move-out-preview')
  @ApiOperation({ summary: 'Preview move-out settlement: pending dues and deposit balance' })
  @ApiResponse({ status: 200, description: 'Settlement preview with dues, deposit, and net refund/due amounts' })
  @ApiReadResponses()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  getMoveOutPreview(@Param('id') id: string) {
    return this.workflowService.getMoveOutPreview(id);
  }

  @Put(':id/cancel-notice')
  @ApiOperation({ summary: 'Cancel notice period and reinstate tenant as active' })
  @ApiResponse({ status: 200, description: 'Notice cancelled, tenant reactivated' })
  @ApiAuthResponses()
  @ApiNotFoundResponse()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  cancelNotice(@Param('id') id: string) {
    return this.workflowService.cancelNotice(id);
  }

  @Put(':id/archive')
  @ApiOperation({ summary: 'Archive a moved-out tenant record' })
  @ApiResponse({ status: 200, description: 'Tenant record archived' })
  @ApiAuthResponses()
  @ApiNotFoundResponse()
  @PropertyRoles('OWNER', 'OPERATOR')
  archive(@Param('id') id: string) {
    return this.workflowService.archive(id);
  }
}
