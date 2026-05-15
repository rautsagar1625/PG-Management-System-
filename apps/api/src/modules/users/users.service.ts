import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        systemRole: true,
        isVerified: true,
        createdAt: true,
        propertyRoles: {
          include: { property: { select: { id: true, name: true, city: true } } },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return { success: true, data: user };
  }

  async search(query: string) {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
        ],
      },
      select: { id: true, name: true, email: true, phone: true },
      take: 10,
    });

    return { success: true, data: users };
  }
}
