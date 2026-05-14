import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { DatabaseModule } from './database/database.module';
import { AllocationModule } from './modules/allocation/allocation.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BedsModule } from './modules/beds/beds.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FinancialModule } from './modules/financial/financial.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { RentModule } from './modules/rent/rent.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { SettlementsModule } from './modules/settlements/settlements.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    DatabaseModule,
    AllocationModule,
    AuditModule,
    AuthModule,
    UsersModule,
    PropertiesModule,
    RoomsModule,
    BedsModule,
    TenantsModule,
    RentModule,
    FinancialModule,
    SettlementsModule,
    ComplaintsModule,
    NotificationsModule,
    DashboardModule,
  ],
})
export class AppModule {}
