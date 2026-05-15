import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

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
  async receipt(@Param('receiptNo') receiptNo: string, @Res() reply: FReply) {
    const buffer = await this.pdfService.generateReceipt(receiptNo);
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="receipt-${receiptNo}.pdf"`)
      .send(buffer);
  }

  @Get('settlement/:id')
  @ApiOperation({ summary: 'Generate settlement summary PDF' })
  async settlementSummary(@Param('id') id: string, @Res() reply: FReply) {
    const buffer = await this.pdfService.generateSettlementSummary(id);
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="settlement-${id}.pdf"`)
      .send(buffer);
  }
}
