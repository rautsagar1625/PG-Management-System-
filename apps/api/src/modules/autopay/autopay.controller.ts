import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  AutopayService,
  CreateAutopayMandateDto,
  UpdateMandateStatusDto,
} from './autopay.service';

@ApiTags('Autopay')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('autopay')
export class AutopayController {
  constructor(private autopayService: AutopayService) {}

  @Get()
  @ApiOperation({ summary: 'List autopay mandates for a property' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  findByProperty(@Query('propertyId') propertyId: string) {
    return this.autopayService.findByProperty(propertyId);
  }

  @Get('tenant/:tenantId')
  @ApiOperation({ summary: 'Get autopay mandates for a tenant' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.autopayService.findByTenant(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create / initiate an autopay mandate' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  create(@Body() dto: CreateAutopayMandateDto) {
    return this.autopayService.create(dto);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update mandate status (Razorpay webhook or manual)' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateMandateStatusDto) {
    return this.autopayService.updateStatus(id, dto);
  }

  @Put(':id/cancel')
  @ApiOperation({ summary: 'Cancel an autopay mandate' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  cancel(@Param('id') id: string) {
    return this.autopayService.cancel(id);
  }

  /**
   * Razorpay webhook endpoint.
   * Must remain public (no JWT) — Razorpay POSTs here directly.
   * Signature is verified via HMAC-SHA256 using RAZORPAY_WEBHOOK_SECRET.
   */
  @Post('webhook')
  @Public()
  @ApiOperation({ summary: 'Razorpay webhook — not protected by auth guard' })
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const rawBody = req.rawBody?.toString() ?? JSON.stringify(req.body);
    await this.autopayService.verifyWebhook(rawBody, signature);
    await this.autopayService.handleWebhook(req.body as Record<string, unknown>);
    return { success: true };
  }

  @Post('payment-order')
  @ApiOperation({ summary: 'Create a Razorpay order for one-time rent payment' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  createPaymentOrder(
    @Body() body: { tenantId: string; amount: number; propertyId: string },
  ) {
    return this.autopayService.createPaymentOrder(body.tenantId, body.amount, body.propertyId);
  }
}
