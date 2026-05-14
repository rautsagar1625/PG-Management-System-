import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FinancialService, SetFinancialModelDto } from './financial.service';

@ApiTags('Financial Models')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('properties/:propertyId/financial-model')
export class FinancialController {
  constructor(private financialService: FinancialService) {}

  @Get()
  @ApiOperation({ summary: 'Get active financial model for a property' })
  getActive(@Param('propertyId') propertyId: string) {
    return this.financialService.getActiveModel(propertyId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get financial model history' })
  getHistory(@Param('propertyId') propertyId: string) {
    return this.financialService.getModelHistory(propertyId);
  }

  @Post()
  @ApiOperation({ summary: 'Set/update financial model (deactivates previous)' })
  set(@Param('propertyId') propertyId: string, @Body() dto: SetFinancialModelDto) {
    return this.financialService.setFinancialModel(propertyId, dto);
  }
}
