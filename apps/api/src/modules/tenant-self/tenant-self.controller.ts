import { Body, Controller, Get, Post, Put, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '@pg-system/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  ApiAuthResponses,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiReadResponses,
  ApiWriteResponses,
} from '../../common/decorators/api-responses.decorator';
import { DocumentType } from '@prisma/client';
import { TenantSelfService, CreateTenantComplaintDto } from './tenant-self.service';

@ApiTags('Tenant Self-Service')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tenant')
export class TenantSelfController {
  constructor(private tenantSelfService: TenantSelfService) {}

  @Get('dashboard')
  @ApiOperation({ summary: "Get tenant's own dashboard" })
  @ApiResponse({ status: 200, description: 'Returns tenant info, active allocation, and current rent cycle' })
  @ApiReadResponses()
  getDashboard(@CurrentUser() ctx: RequestContext) {
    return this.tenantSelfService.getDashboard(ctx.userId);
  }

  @Get('rent-history')
  @ApiOperation({ summary: "Get tenant's rent cycle history (cursor-paginated)" })
  @ApiResponse({ status: 200, description: 'Paginated rent cycles — newest first. Pass nextCursor for subsequent pages.' })
  @ApiAuthResponses()
  getRentHistory(
    @CurrentUser() ctx: RequestContext,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.tenantSelfService.getRentHistory(ctx.userId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
  }

  @Get('complaints')
  @ApiOperation({ summary: "Get tenant's complaints" })
  @ApiResponse({ status: 200, description: 'List of complaints with status updates' })
  @ApiAuthResponses()
  getComplaints(@CurrentUser() ctx: RequestContext) {
    return this.tenantSelfService.getComplaints(ctx.userId);
  }

  @Post('complaints')
  @ApiOperation({ summary: 'Raise a new complaint (tenant)' })
  @ApiResponse({ status: 201, description: 'Complaint created successfully' })
  @ApiWriteResponses()
  createComplaint(
    @CurrentUser() ctx: RequestContext,
    @Body() dto: CreateTenantComplaintDto,
  ) {
    return this.tenantSelfService.createComplaint(ctx.userId, dto);
  }

  @Get('profile')
  @ApiOperation({ summary: "Get tenant's own profile and stay details" })
  @ApiResponse({ status: 200, description: 'Tenant profile with allocation, emergency contact, deposit balance' })
  @ApiReadResponses()
  getProfile(@CurrentUser() ctx: RequestContext) {
    return this.tenantSelfService.getProfile(ctx.userId);
  }

  @Get('kyc')
  @ApiOperation({ summary: "Get tenant's own KYC documents" })
  @ApiResponse({ status: 200, description: 'List of uploaded KYC documents' })
  @ApiAuthResponses()
  getKycDocuments(@CurrentUser() ctx: RequestContext) {
    return this.tenantSelfService.getKycDocuments(ctx.userId);
  }

  @Post('kyc')
  @ApiOperation({ summary: 'Upload a KYC document (tenant self-service)' })
  @ApiResponse({ status: 201, description: 'KYC document record created' })
  @ApiWriteResponses()
  uploadKycDocument(
    @CurrentUser() ctx: RequestContext,
    @Body() dto: { type: DocumentType; documentNumber: string; fileUrl?: string },
  ) {
    return this.tenantSelfService.uploadKycDocument(ctx.userId, dto);
  }

  @Get('agreements')
  @ApiOperation({ summary: "Get tenant's rental agreements" })
  @ApiResponse({ status: 200, description: 'List of rental agreements with signature status' })
  @ApiAuthResponses()
  getAgreements(@CurrentUser() ctx: RequestContext) {
    return this.tenantSelfService.getAgreements(ctx.userId);
  }

  @Put('agreements/:id/sign')
  @ApiOperation({ summary: 'Tenant signs their rental agreement' })
  @ApiResponse({ status: 200, description: 'Agreement marked as signed by tenant' })
  @ApiBadRequestResponse()
  @ApiAuthResponses()
  @ApiNotFoundResponse()
  signAgreement(@CurrentUser() ctx: RequestContext, @Param('id') id: string) {
    return this.tenantSelfService.signAgreement(ctx.userId, id);
  }

  // SP5-2: Strict throttle on payment endpoints.
  // create-order: 10 per minute — prevents order-flooding that would create
  // dangling Razorpay orders and skew reconciliation reports.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('pay/create-order')
  @ApiOperation({ summary: 'Create a Razorpay order for online rent payment' })
  @ApiResponse({ status: 201, description: 'Razorpay order created — returns orderId, amount, keyId' })
  @ApiBadRequestResponse()
  @ApiAuthResponses()
  @ApiNotFoundResponse()
  createPaymentOrder(
    @CurrentUser() ctx: RequestContext,
    @Body() dto: { rentCycleId: string; amount: number },
  ) {
    return this.tenantSelfService.createPaymentOrder(ctx.userId, dto);
  }

  // verify: 20 per minute — slightly more lenient (retries after network errors are legitimate)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('pay/verify')
  @ApiOperation({ summary: 'Verify Razorpay payment and record it' })
  @ApiResponse({ status: 201, description: 'Payment verified and recorded in rent cycle' })
  @ApiBadRequestResponse()
  @ApiAuthResponses()
  @ApiNotFoundResponse()
  verifyPayment(
    @CurrentUser() ctx: RequestContext,
    @Body() dto: {
      rentCycleId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ) {
    return this.tenantSelfService.verifyAndRecordPayment(ctx.userId, dto);
  }
}
