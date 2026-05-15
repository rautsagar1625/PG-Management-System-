import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ExportFormat, ExportService } from './export.service';

// Inline reply interface to avoid importing from 'fastify' directly
interface FReply {
  header(name: string, value: string): this;
  send(data: Buffer): void;
}

@ApiTags('Export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@PropertyRoles('OWNER', 'OPERATOR')
@Controller('export')
export class ExportController {
  constructor(private exportService: ExportService) {}

  @Get('collections')
  @ApiOperation({ summary: 'Export rent collections as CSV or XLSX' })
  @ApiQuery({ name: 'propertyId', required: true })
  @ApiQuery({ name: 'month', required: true })
  @ApiQuery({ name: 'year', required: true })
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx'], required: false })
  async exportCollections(
    @Query('propertyId') propertyId: string,
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('format') format: ExportFormat = 'xlsx',
    @Res() reply: FReply,
  ) {
    const result = await this.exportService.exportCollections(
      propertyId,
      Number(month),
      Number(year),
      format,
    );
    reply
      .header('Content-Type', result.mimeType)
      .header('Content-Disposition', `attachment; filename="${result.filename}"`)
      .send(result.buffer);
  }

  @Get('overdue')
  @ApiOperation({ summary: 'Export overdue rent cycles as CSV or XLSX' })
  @ApiQuery({ name: 'propertyId', required: true })
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx'], required: false })
  async exportOverdue(
    @Query('propertyId') propertyId: string,
    @Query('format') format: ExportFormat = 'xlsx',
    @Res() reply: FReply,
  ) {
    const result = await this.exportService.exportOverdue(propertyId, format);
    reply
      .header('Content-Type', result.mimeType)
      .header('Content-Disposition', `attachment; filename="${result.filename}"`)
      .send(result.buffer);
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Export tenant roster as CSV or XLSX' })
  @ApiQuery({ name: 'propertyId', required: true })
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx'], required: false })
  async exportTenants(
    @Query('propertyId') propertyId: string,
    @Query('format') format: ExportFormat = 'xlsx',
    @Res() reply: FReply,
  ) {
    const result = await this.exportService.exportTenants(propertyId, format);
    reply
      .header('Content-Type', result.mimeType)
      .header('Content-Disposition', `attachment; filename="${result.filename}"`)
      .send(result.buffer);
  }

  @Get('settlements')
  @ApiOperation({ summary: 'Export settlements as CSV or XLSX' })
  @ApiQuery({ name: 'propertyId', required: true })
  @ApiQuery({ name: 'year', required: true })
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx'], required: false })
  async exportSettlements(
    @Query('propertyId') propertyId: string,
    @Query('year') year: string,
    @Query('format') format: ExportFormat = 'xlsx',
    @Res() reply: FReply,
  ) {
    const result = await this.exportService.exportSettlements(
      propertyId,
      Number(year),
      format,
    );
    reply
      .header('Content-Type', result.mimeType)
      .header('Content-Disposition', `attachment; filename="${result.filename}"`)
      .send(result.buffer);
  }
}
