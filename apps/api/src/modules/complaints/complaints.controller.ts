import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { RequestContext } from '@pg-system/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ComplaintsService, CreateComplaintDto, UpdateComplaintDto } from './complaints.service';

@ApiTags('Complaints')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('complaints')
export class ComplaintsController {
  constructor(private complaintsService: ComplaintsService) {}

  @Get()
  @ApiOperation({ summary: 'List complaints for a property' })
  findAll(
    @Query('propertyId') propertyId: string,
    @Query() filters: { status?: string; category?: string },
  ) {
    return this.complaintsService.findAll(propertyId, filters);
  }

  @Post()
  @ApiOperation({ summary: 'Raise a complaint' })
  create(@Body() dto: CreateComplaintDto, @CurrentUser() ctx: RequestContext) {
    return this.complaintsService.create(dto, ctx.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get complaint details with comments' })
  findOne(@Param('id') id: string) {
    return this.complaintsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update complaint status, assignment, or add comment' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateComplaintDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.complaintsService.update(id, dto, ctx.userId);
  }
}
