import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BedsService, UpdateBedDto } from './beds.service';

@ApiTags('Beds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('beds')
export class BedsController {
  constructor(private bedsService: BedsService) {}

  @Get('available')
  @ApiOperation({ summary: 'List available beds in a property' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  getAvailable(@Query('propertyId') propertyId: string) {
    return this.bedsService.getAvailableBeds(propertyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get bed detail with current allocation' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  findOne(@Param('id') id: string) {
    return this.bedsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update bed label or status — OWNER or OPERATOR only' })
  @PropertyRoles('OWNER', 'OPERATOR')
  update(@Param('id') id: string, @Body() dto: UpdateBedDto) {
    return this.bedsService.update(id, dto);
  }
}
