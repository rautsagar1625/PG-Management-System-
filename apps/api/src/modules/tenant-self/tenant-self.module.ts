import { Module } from '@nestjs/common';
import { TenantSelfController } from './tenant-self.controller';
import { TenantSelfService } from './tenant-self.service';
import { PaymentCheckoutController } from './payment-checkout.controller';

@Module({
  controllers: [TenantSelfController, PaymentCheckoutController],
  providers: [TenantSelfService],
})
export class TenantSelfModule {}
