import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { RequestContext } from '@pg-system/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AttendanceService, RecordAttendanceDto } from './attendance.service';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Post('check-in')
  @ApiOperation({ summary: 'Record a check-in for the current user' })
  checkIn(@Body() dto: RecordAttendanceDto, @CurrentUser() ctx: RequestContext) {
    return this.attendanceService.checkIn(dto, ctx.userId);
  }

  @Post('check-out')
  @ApiOperation({ summary: 'Record a check-out for the current user' })
  checkOut(@Body() dto: RecordAttendanceDto, @CurrentUser() ctx: RequestContext) {
    return this.attendanceService.checkOut(dto, ctx.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List attendance records for a property on a specific date (operator view)' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  findByPropertyAndDate(
    @Query('propertyId') propertyId: string,
    @Query('date') date: string,
  ) {
    return this.attendanceService.findByPropertyAndDate(propertyId, date);
  }

  @Get('my')
  @ApiOperation({ summary: "Get current user's attendance history (last 30 days)" })
  findMine(
    @Query('propertyId') propertyId: string,
    @CurrentUser() ctx: RequestContext,
  ) {
    return this.attendanceService.findMine(propertyId, ctx.userId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Present/absent count for a property on a date' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  summary(
    @Query('propertyId') propertyId: string,
    @Query('date') date: string,
  ) {
    return this.attendanceService.summary(propertyId, date);
  }
}
