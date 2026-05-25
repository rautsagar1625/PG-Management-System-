import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import type { RequestContext } from '@pg-system/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiAuthResponses, ApiNotFoundResponse, ApiReadResponses, ApiWriteResponses } from '../../common/decorators/api-responses.decorator';
import { AgreementsService, CreateAgreementDto } from './agreements.service';

@ApiTags('Agreements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agreements')
export class AgreementsController {
  constructor(private agreementsService: AgreementsService) {}

  @Get()
  @ApiOperation({ summary: 'List rental agreements for a property' })
  @ApiResponse({ status: 200, description: 'Agreements with signature status and terms' })
  @ApiAuthResponses()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  findByProperty(@Query('propertyId') propertyId: string) {
    return this.agreementsService.findByProperty(propertyId);
  }

  @Get('tenant/:tenantId')
  @ApiOperation({ summary: 'Get rental agreements for a tenant' })
  @ApiResponse({ status: 200, description: 'Agreements for the given tenant' })
  @ApiReadResponses()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.agreementsService.findByTenant(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new rental agreement' })
  @ApiResponse({ status: 201, description: 'Agreement created in DRAFT status' })
  @ApiWriteResponses()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  create(@Body() dto: CreateAgreementDto, @CurrentUser() ctx: RequestContext) {
    return this.agreementsService.create(dto, ctx.userId);
  }

  @Put(':id/send')
  @ApiOperation({ summary: 'Send agreement to tenant for signing' })
  @ApiResponse({ status: 200, description: 'Agreement status changed to SENT, notification dispatched' })
  @ApiAuthResponses()
  @ApiNotFoundResponse()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  send(@Param('id') id: string) {
    return this.agreementsService.send(id);
  }

  @Put(':id/sign-tenant')
  @ApiOperation({ summary: 'Mark agreement as signed by tenant' })
  @ApiResponse({ status: 200, description: 'Tenant signature recorded; if both parties signed, status becomes SIGNED' })
  @ApiAuthResponses()
  @ApiNotFoundResponse()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  signByTenant(@Param('id') id: string) {
    return this.agreementsService.signByTenant(id);
  }

  @Put(':id/sign-owner')
  @ApiOperation({ summary: 'Mark agreement as signed by owner' })
  @ApiResponse({ status: 200, description: 'Owner signature recorded; if both parties signed, status becomes SIGNED' })
  @ApiAuthResponses()
  @ApiNotFoundResponse()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  signByOwner(@Param('id') id: string) {
    return this.agreementsService.signByOwner(id);
  }

  @Put(':id/cancel')
  @ApiOperation({ summary: 'Cancel a rental agreement' })
  @ApiResponse({ status: 200, description: 'Agreement status changed to CANCELLED' })
  @ApiAuthResponses()
  @ApiNotFoundResponse()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  cancel(@Param('id') id: string) {
    return this.agreementsService.cancel(id);
  }
}
