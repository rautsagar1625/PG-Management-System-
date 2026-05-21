import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { RequestContext } from '@pg-system/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CreateFoodMenuDto,
  FoodMenuService,
  UpdateFoodMenuDto,
} from './food-menu.service';

@ApiTags('Food Menu')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('food-menu')
export class FoodMenuController {
  constructor(private foodMenuService: FoodMenuService) {}

  @Get()
  @ApiOperation({ summary: 'Get all menu entries for a property, grouped by day' })
  findAll(@Query('propertyId') propertyId: string) {
    return this.foodMenuService.findAll(propertyId);
  }

  @Get('today')
  @ApiOperation({ summary: "Get today's menu (all active meals for current day of week)" })
  findToday(@Query('propertyId') propertyId: string) {
    return this.foodMenuService.findToday(propertyId);
  }

  @Post()
  @ApiOperation({ summary: 'Create or upsert a menu entry (by propertyId + dayOfWeek + mealType)' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  upsert(@Body() dto: CreateFoodMenuDto, @CurrentUser() ctx: RequestContext) {
    return this.foodMenuService.upsert(dto, ctx.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a menu entry (items, timing, isActive)' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  update(@Param('id') id: string, @Body() dto: UpdateFoodMenuDto) {
    return this.foodMenuService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a menu entry' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  remove(@Param('id') id: string) {
    return this.foodMenuService.remove(id);
  }
}
