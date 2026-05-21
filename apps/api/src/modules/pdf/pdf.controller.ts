import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PdfService } from './pdf.service';

interface FReply {
  header(name: string, value: string): this;
  send(data: Buffer): void;
}

@ApiTags('PDF')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pdf')
export class PdfController {
  constructor(private pdfService: PdfService) {}

  @Get('receipt/:receiptNo')
  @ApiOperation({ summary: 'Generate receipt PDF' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  async receipt(@Param('receiptNo') receiptNo: string, @Res() reply: FReply) {
    const buffer = await this.pdfService.generateReceipt(receiptNo);
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="receipt-${receiptNo}.pdf"`)
      .send(buffer);
  }

  @Get('settlement/:id')
  @ApiOperation({ summary: 'Generate settlement summary PDF' })
  @PropertyRoles('OWNER', 'OPERATOR')
  async settlementSummary(@Param('id') id: string, @Res() reply: FReply) {
    const buffer = await this.pdfService.generateSettlementSummary(id);
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="settlement-${id}.pdf"`)
      .send(buffer);
  }

  @Get('agreement/:id')
  @ApiOperation({ summary: 'Generate rental agreement PDF' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF')
  async agreement(@Param('id') id: string, @Res() reply: FReply) {
    const buffer = await this.pdfService.generateAgreement(id);
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="agreement-${id.slice(0, 8)}.pdf"`)
      .send(buffer);
  }
}
