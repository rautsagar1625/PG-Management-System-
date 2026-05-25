import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PropertyRoleGuard } from './common/guards/property-role.guard';
import { SystemRoleGuard } from './common/guards/system-role.guard';

import { DatabaseModule } from './database/database.module';
import { CacheModule } from './database/cache.module';
import { EmailModule } from './modules/email/email.module';
import { PushModule } from './modules/push/push.module';
import { ExportModule } from './modules/export/export.module';
import { PdfModule } from './modules/pdf/pdf.module';
import { AllocationModule } from './modules/allocation/allocation.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BedsModule } from './modules/beds/beds.module';
import { AgreementsModule } from './modules/agreements/agreements.module';
import { AutopayModule } from './modules/autopay/autopay.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { LeadsModule } from './modules/leads/leads.module';
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
import { AttendanceModule } from './modules/attendance/attendance.module';
import { FoodMenuModule } from './modules/food-menu/food-menu.module';
import { KycModule } from './modules/kyc/kyc.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().default('15m'),
        JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
        CORS_ORIGIN: Joi.string().required(),
        REDIS_URL: Joi.string().optional(),
        SENTRY_DSN: Joi.string().uri().optional(),
        RESEND_API_KEY: Joi.string().optional(),
        EMAIL_FROM: Joi.string().optional(),
        APP_URL: Joi.string().uri().optional(),
        S3_BUCKET: Joi.string().optional(),
        S3_REGION: Joi.string().optional(),
        S3_ENDPOINT: Joi.string().uri().optional(),
        S3_ACCESS_KEY_ID: Joi.string().optional(),
        S3_SECRET_ACCESS_KEY: Joi.string().optional(),
      }),
      validationOptions: { abortEarly: false },
    }),
    EventEmitterModule.forRoot({ wildcard: false, maxListeners: 20 }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    DatabaseModule,
    CacheModule,
    EmailModule,
    PushModule,
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
    LeadsModule,
    AutopayModule,
    AgreementsModule,
    NotificationsModule,
    DashboardModule,
    ExportModule,
    PdfModule,
    JobsModule,
    FoodMenuModule,
    AttendanceModule,
    KycModule,
    WhatsAppModule,
  ],
  providers: [
    // Global guard chain — order matters: auth → system role → property role
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: SystemRoleGuard },
    { provide: APP_GUARD, useClass: PropertyRoleGuard },
  ],
})
export class AppModule {}
