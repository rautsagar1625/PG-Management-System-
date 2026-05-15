import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RoomsService, CreateRoomDto } from './rooms.service';

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
}
