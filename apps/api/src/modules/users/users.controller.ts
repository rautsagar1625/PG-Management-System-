import { BadRequestException, Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

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

  @Post('push-token')
  @ApiOperation({ summary: 'Register or clear the Expo push token for this device' })
  registerPushToken(
    @CurrentUser() ctx: RequestContext,
    @Body('token') token: string | null,
  ) {
    return this.usersService.registerPushToken(ctx.userId, token ?? null);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile (name, phone)' })
  updateProfile(
    @CurrentUser() ctx: RequestContext,
    @Body() dto: { name?: string; phone?: string },
  ) {
    return this.usersService.updateProfile(ctx.userId, dto);
  }

  @Post('me/change-password')
  @ApiOperation({ summary: 'Change current user password' })
  changePassword(
    @CurrentUser() ctx: RequestContext,
    @Body() dto: { currentPassword: string; newPassword: string },
  ) {
    return this.usersService.changePassword(ctx.userId, dto.currentPassword, dto.newPassword);
  }

  @Get('me/notification-preferences')
  @ApiOperation({
    summary: 'Get notification preferences for the current user',
    description: 'Returns the stored per-event email/push toggle map. Null means all notifications are on (default).',
  })
  getNotificationPreferences(@CurrentUser() ctx: RequestContext) {
    return this.usersService.getNotificationPreferences(ctx.userId);
  }

  @Patch('me/notification-preferences')
  @ApiOperation({
    summary: 'Update notification preferences',
    description: 'Persists a map of {eventKey: {email: boolean, push: boolean}}. Overwrites any previous value.',
  })
  updateNotificationPreferences(
    @CurrentUser() ctx: RequestContext,
    @Body() body: { preferences: Record<string, { email: boolean; push: boolean }> },
  ) {
    return this.usersService.updateNotificationPreferences(ctx.userId, body.preferences);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users by name/email/phone (for adding to property)' })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  search(@Query('q') query: string) {
    if (!query || query.trim().length < 2) {
      throw new BadRequestException('Search query must be at least 2 characters');
    }
    return this.usersService.search(query.trim());
  }
}
