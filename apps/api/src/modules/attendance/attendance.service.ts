import { Injectable } from '@nestjs/common';
import { AttendanceType, TenantStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

export interface RecordAttendanceDto {
  propertyId: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  wifiSSID?: string;
  deviceInfo?: string;
}

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  private async validate(
    propertyId: string,
    wifiSSID?: string,
  ): Promise<{ isValid: boolean; invalidReason?: string }> {
    // WiFi validation: if wifiSSID is provided, check against property.wifiSSIDs
    if (wifiSSID) {
      const property = await this.prisma.property.findUnique({
        where: { id: propertyId },
        select: { wifiSSIDs: true },
      });

      if (property && property.wifiSSIDs.length > 0) {
        if (!property.wifiSSIDs.includes(wifiSSID)) {
          return {
            isValid: false,
            invalidReason: 'WiFi network not registered',
          };
        }
      }
    }

    // GPS validation skipped for now (no center lat/lng on property)
    return { isValid: true };
  }

  async checkIn(dto: RecordAttendanceDto, userId: string) {
    const { isValid, invalidReason } = await this.validate(dto.propertyId, dto.wifiSSID);

    const record = await this.prisma.attendanceRecord.create({
      data: {
        userId,
        propertyId: dto.propertyId,
        type: AttendanceType.CHECK_IN,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
        wifiSSID: dto.wifiSSID,
        deviceInfo: dto.deviceInfo,
        isValid,
        invalidReason,
      },
    });

    return { success: true, data: record };
  }

  async checkOut(dto: RecordAttendanceDto, userId: string) {
    const { isValid, invalidReason } = await this.validate(dto.propertyId, dto.wifiSSID);

    const record = await this.prisma.attendanceRecord.create({
      data: {
        userId,
        propertyId: dto.propertyId,
        type: AttendanceType.CHECK_OUT,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
        wifiSSID: dto.wifiSSID,
        deviceInfo: dto.deviceInfo,
        isValid,
        invalidReason,
      },
    });

    return { success: true, data: record };
  }

  async findByPropertyAndDate(propertyId: string, date: string) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        propertyId,
        createdAt: { gte: start, lte: end },
      },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return { success: true, data: records };
  }

  async findMine(propertyId: string, userId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        userId,
        propertyId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: records };
  }

  async summary(propertyId: string, date: string) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    // Get unique user IDs who checked in on this date
    const checkIns = await this.prisma.attendanceRecord.findMany({
      where: {
        propertyId,
        type: AttendanceType.CHECK_IN,
        createdAt: { gte: start, lte: end },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    // Total active tenants in this property
    const totalTenants = await this.prisma.tenant.count({
      where: { propertyId, status: TenantStatus.ACTIVE },
    });

    const present = checkIns.length;
    const absent = Math.max(0, totalTenants - present);

    return {
      success: true,
      data: {
        date,
        propertyId,
        present,
        absent,
        total: totalTenants,
        presentUserIds: checkIns.map((r) => r.userId),
      },
    };
  }
}
