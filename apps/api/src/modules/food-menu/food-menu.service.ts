import { Injectable, NotFoundException } from '@nestjs/common';
import { MealType } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

export interface CreateFoodMenuDto {
  propertyId: string;
  dayOfWeek: number; // 0=Sunday … 6=Saturday
  mealType: MealType;
  items: string[];
  timing?: string;
}

export interface UpdateFoodMenuDto {
  items?: string[];
  timing?: string;
  isActive?: boolean;
}

@Injectable()
export class FoodMenuService {
  constructor(private prisma: PrismaService) {}

  async findAll(propertyId: string) {
    const entries = await this.prisma.foodMenu.findMany({
      where: { propertyId },
      orderBy: [{ dayOfWeek: 'asc' }, { mealType: 'asc' }],
    });

    // Group by dayOfWeek
    const grouped: Record<number, typeof entries> = {};
    for (const entry of entries) {
      if (!grouped[entry.dayOfWeek]) grouped[entry.dayOfWeek] = [];
      (grouped[entry.dayOfWeek] as typeof entries).push(entry);
    }

    return { success: true, data: { entries, grouped } };
  }

  async findToday(propertyId: string) {
    const dayOfWeek = new Date().getDay(); // 0=Sunday
    const entries = await this.prisma.foodMenu.findMany({
      where: { propertyId, dayOfWeek, isActive: true },
      orderBy: { mealType: 'asc' },
    });

    return { success: true, data: entries };
  }

  async upsert(dto: CreateFoodMenuDto, createdBy: string) {
    const entry = await this.prisma.foodMenu.upsert({
      where: {
        propertyId_dayOfWeek_mealType: {
          propertyId: dto.propertyId,
          dayOfWeek: dto.dayOfWeek,
          mealType: dto.mealType,
        },
      },
      create: {
        propertyId: dto.propertyId,
        dayOfWeek: dto.dayOfWeek,
        mealType: dto.mealType,
        items: dto.items,
        timing: dto.timing,
        createdBy,
      },
      update: {
        items: dto.items,
        timing: dto.timing,
        isActive: true,
      },
    });

    return { success: true, data: entry };
  }

  async update(id: string, dto: UpdateFoodMenuDto) {
    const existing = await this.prisma.foodMenu.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Food menu entry not found');

    const updated = await this.prisma.foodMenu.update({
      where: { id },
      data: {
        ...(dto.items !== undefined && { items: dto.items }),
        ...(dto.timing !== undefined && { timing: dto.timing }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return { success: true, data: updated };
  }

  async remove(id: string) {
    const existing = await this.prisma.foodMenu.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Food menu entry not found');

    await this.prisma.foodMenu.delete({ where: { id } });
    return { success: true };
  }
}
