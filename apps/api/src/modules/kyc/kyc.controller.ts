import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '@pg-system/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { KycService, CreateDocumentDto } from './kyc.service';

@ApiTags('KYC')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('kyc')
export class KycController {
  constructor(private kycService: KycService) {}

  @Get('tenant/:tenantId')
  @ApiOperation({ summary: 'Get all KYC documents for a tenant (access is audit-logged)' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  getDocuments(@Param('tenantId') tenantId: string, @CurrentUser() ctx: RequestContext) {
    // ER-004: pass the actor userId so the audit log records who viewed the documents
    return this.kycService.getDocuments(tenantId, ctx.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a KYC document for a tenant' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  addDocument(@Body() dto: CreateDocumentDto) {
    return this.kycService.addDocument(dto);
  }

  @Put(':id/verify')
  @ApiOperation({ summary: 'Verify a KYC document' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  verifyDocument(@Param('id') id: string, @CurrentUser() ctx: RequestContext) {
    return this.kycService.verifyDocument(id, ctx.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a KYC document' })
  @PropertyRoles('OWNER', 'OPERATOR')
  deleteDocument(@Param('id') id: string) {
    return this.kycService.deleteDocument(id);
  }
}
