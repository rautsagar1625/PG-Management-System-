import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { PaginationQuery } from '@pg-system/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { RequestContext } from '@pg-system/types';
import { CreatePropertyDto, UpdatePropertyDto } from './dto/property.dto';
import { PropertiesService } from './properties.service';

@ApiTags('Properties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('properties')
export class PropertiesController {
  constructor(private propertiesService: PropertiesService) {}

  @Get()
  @ApiOperation({ summary: 'List all accessible properties' })
  findAll(@CurrentUser() ctx: RequestContext, @Query() query: PaginationQuery) {
    return this.propertiesService.findAll(ctx, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new property' })
  create(@Body() dto: CreatePropertyDto, @CurrentUser() ctx: RequestContext) {
    return this.propertiesService.create(dto, ctx);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get property details' })
  findOne(@Param('id') id: string, @CurrentUser() ctx: RequestContext) {
    return this.propertiesService.findOne(id, ctx);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update property details' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.propertiesService.update(id, dto, ctx);
  }
}
