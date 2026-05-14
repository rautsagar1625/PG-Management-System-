import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { RequestContext } from '@pg-system/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile with property roles' })
  getProfile(@CurrentUser() ctx: RequestContext) {
    return this.usersService.getProfile(ctx.userId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users by name/email/phone (for adding to property)' })
  search(@Query('q') query: string) {
    return this.usersService.search(query);
  }
}
