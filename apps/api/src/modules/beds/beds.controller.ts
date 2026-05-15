import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PropertyRoles } from '../../common/decorators/roles.decorator';
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
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  getAvailable(@Query('propertyId') propertyId: string) {
    return this.bedsService.getAvailableBeds(propertyId);
  }
}
