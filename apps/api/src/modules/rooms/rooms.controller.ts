import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

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
