import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PropertyRoleGuard } from './common/guards/property-role.guard';
import { SystemRoleGuard } from './common/guards/system-role.guard';

import { DatabaseModule } from './database/database.module';
import { ExportModule } from './modules/export/export.module';
import { PdfModule } from './modules/pdf/pdf.module';
import { AllocationModule } from './modules/allocation/allocation.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BedsModule } from './modules/beds/beds.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FinancialModule } from './modules/financial/financial.module';
import { FilesModule } from './modules/files/files.module';
import { HealthModule } from './modules/health/health.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { RentModule } from './modules/rent/rent.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { SettlementsModule } from './modules/settlements/settlements.module';
import { TenantSelfModule } from './modules/tenant-self/tenant-self.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    DatabaseModule,
    HealthModule,
    FilesModule,
    AllocationModule,
    AuditModule,
    AuthModule,
    UsersModule,
    PropertiesModule,
    RoomsModule,
    BedsModule,
    TenantsModule,
    TenantSelfModule,
    RentModule,
    FinancialModule,
    SettlementsModule,
    ComplaintsModule,
    NotificationsModule,
    DashboardModule,
    ExportModule,
    PdfModule,
    JobsModule,
  ],
  providers: [
    // Global guard chain — order matters: auth → system role → property role
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: SystemRoleGuard },
    { provide: APP_GUARD, useClass: PropertyRoleGuard },
  ],
})
export class AppModule {}
