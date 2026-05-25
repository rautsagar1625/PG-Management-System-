import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import type { RequestContext } from '@pg-system/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiAuthResponses, ApiNotFoundResponse, ApiReadResponses, ApiWriteResponses } from '../../common/decorators/api-responses.decorator';
import { ComplaintsService, CreateComplaintDto, UpdateComplaintDto } from './complaints.service';

@ApiTags('Complaints')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('complaints')
export class ComplaintsController {
  constructor(private complaintsService: ComplaintsService) {}

  @Get()
  @ApiOperation({ summary: 'List complaints for a property (cursor-paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of complaints with hasMore + nextCursor' })
  @ApiAuthResponses()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  findAll(
    @Query('propertyId') propertyId: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.complaintsService.findAll(propertyId, {
      status,
      category,
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Raise a complaint' })
  @ApiResponse({ status: 201, description: 'Complaint created' })
  @ApiWriteResponses()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  create(@Body() dto: CreateComplaintDto, @CurrentUser() ctx: RequestContext) {
    return this.complaintsService.create(dto, ctx.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get complaint details with comments' })
  @ApiResponse({ status: 200, description: 'Complaint with full update/comment history' })
  @ApiReadResponses()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  findOne(@Param('id') id: string) {
    return this.complaintsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update complaint status, assignment, or add comment' })
  @ApiResponse({ status: 200, description: 'Complaint updated with new status/comment' })
  @ApiAuthResponses()
  @ApiNotFoundResponse()
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateComplaintDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.complaintsService.update(id, dto, ctx.userId);
  }
}
