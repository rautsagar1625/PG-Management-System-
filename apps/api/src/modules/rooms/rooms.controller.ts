import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RoomsService, CreateRoomDto, UpdateRoomDto } from './rooms.service';

@ApiTags('Rooms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
@Controller('properties/:propertyId/rooms')
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  @Get()
  @ApiOperation({ summary: 'List all rooms in a property' })
  findAll(@Param('propertyId') propertyId: string) {
    return this.roomsService.findByProperty(propertyId);
  }

  @Get('available-beds')
  @ApiOperation({
    summary: 'List available beds for room transfer — returns bedId + human-readable label',
    description:
      'Use this endpoint to populate the room-transfer dropdown. ' +
      'Pass excludeTenantId to omit the bed the tenant currently occupies.',
  })
  @ApiQuery({ name: 'floor', required: false, description: 'Restrict to a specific floor number' })
  @ApiQuery({ name: 'excludeTenantId', required: false, description: "Exclude this tenant's current bed" })
  getAvailableBeds(
    @Param('propertyId') propertyId: string,
    @Query('floor') floor?: string,
    @Query('excludeTenantId') excludeTenantId?: string,
  ) {
    return this.roomsService.getAvailableBeds(propertyId, {
      floorFilter: floor !== undefined ? Number(floor) : undefined,
      excludeTenantId,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Add a room (auto-creates beds) — OWNER or OPERATOR only' })
  @PropertyRoles('OWNER', 'OPERATOR')
  create(@Param('propertyId') propertyId: string, @Body() dto: CreateRoomDto) {
    return this.roomsService.create(propertyId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get room detail with beds and active allocations' })
  findOne(@Param('propertyId') propertyId: string, @Param('id') id: string) {
    return this.roomsService.findOne(propertyId, id);
  }

  @Get(':id/allocations')
  @ApiOperation({ summary: 'Get full allocation history for a room' })
  getAllocationHistory(@Param('propertyId') propertyId: string, @Param('id') id: string) {
    return this.roomsService.findOneAllocationHistory(propertyId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update room details — OWNER or OPERATOR only' })
  @PropertyRoles('OWNER', 'OPERATOR')
  update(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.roomsService.update(propertyId, id, dto);
  }
}
