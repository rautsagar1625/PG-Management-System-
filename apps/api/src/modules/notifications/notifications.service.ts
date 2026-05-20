import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async send(userId: string, title: string, body: string, type: NotificationType, data?: object) {
    return this.prisma.notification.create({
      data: { userId, title, body, type, data: data as object },
    });
  }

  async getUserNotifications(userId: string, unreadOnly = false, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { userId, ...(unreadOnly && { isRead: false }) };

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      success: true,
      data: notifications,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), unreadCount },
    };
  }

  async markRead(notificationId: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { success: true };
  }
}
