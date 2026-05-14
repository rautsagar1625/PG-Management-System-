import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BedsService } from './beds.service';

@ApiTags('Beds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('beds')
export class BedsController {
  constructor(private bedsService: BedsService) {}

  @Get('available')
  @ApiOperation({ summary: 'List available beds in a property' })
  getAvailable(@Query('propertyId') propertyId: string) {
    return this.bedsService.getAvailableBeds(propertyId);
  }
}
