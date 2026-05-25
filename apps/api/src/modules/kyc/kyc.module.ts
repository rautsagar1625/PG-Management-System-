import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Module({
  imports: [AuditModule],
  controllers: [KycController],
  providers: [KycService],
})
export class KycModule {}
