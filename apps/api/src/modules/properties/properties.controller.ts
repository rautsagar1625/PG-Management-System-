import {
  Body,
  Controller,
  Delete,
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
import { PropertyRolesService, AddRoleDto } from './property-roles.service';

@ApiTags('Properties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('properties')
export class PropertiesController {
  constructor(
    private propertiesService: PropertiesService,
    private propertyRolesService: PropertyRolesService,
  ) {}

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

  // ── Property Role Management ────────────────────────────────────────────────

  @Get(':id/roles')
  @ApiOperation({ summary: 'List all users with roles on this property' })
  listRoles(@Param('id') id: string, @CurrentUser() ctx: RequestContext) {
    return this.propertyRolesService.listRoles(id, ctx);
  }

  @Post(':id/roles')
  @ApiOperation({ summary: 'Assign or update a role for a user on this property' })
  addRole(
    @Param('id') id: string,
    @Body() dto: AddRoleDto,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.propertyRolesService.addRole(id, dto, ctx);
  }

  @Delete(':id/roles/:roleId')
  @ApiOperation({ summary: 'Remove a user role from this property' })
  removeRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.propertyRolesService.removeRole(id, roleId, ctx);
  }

  @Get(':id/roles/lookup')
  @ApiOperation({ summary: 'Look up a user by email (to assign a role)' })
  lookupUser(@Query('email') email: string) {
    return this.propertyRolesService.findUserByEmail(email);
  }
}
