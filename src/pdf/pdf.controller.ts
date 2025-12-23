import { Controller, Get, Post, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PdfService } from './pdf.service';
import type { Response } from 'express';

@ApiTags('pdf')
@Controller('pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Post('quotations/:id/generate')
  @ApiOperation({ summary: 'Generate PDF for a quotation' })
  @ApiParam({ name: 'id', description: 'Quotation UUID' })
  @ApiQuery({ name: 'template', required: false, description: 'Template type (default, wholesale, retail, loading, price-list)', enum: ['default', 'wholesale', 'retail', 'loading', 'price-list'] })
  @ApiResponse({ status: 200, description: 'PDF file generated successfully', content: { 'application/pdf': {} } })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  async generatePDF(
    @Param('id') quotationId: string,
    @Query('template') template: string = 'default',
    @Res() res: Response,
  ) {
    try {
      console.log('[PdfController.generatePDF] Request received:', {
        quotationId,
        template,
        route: 'POST /api/pdf/quotations/:id/generate',
        timestamp: new Date().toISOString(),
      });

      const pdfBuffer = await this.pdfService.generateQuotationPDF(
        quotationId,
        template,
      );

      console.log('[PdfController.generatePDF] PDF generated successfully:', {
        quotationId,
        template,
        pdfSize: pdfBuffer.length,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="quotation-${quotationId}.pdf"`,
      );
      res.send(pdfBuffer);
    } catch (error: any) {
      throw error;
    }
  }

  @Get('quotations/:id/preview')
  @ApiOperation({ summary: 'Preview HTML for a quotation PDF' })
  @ApiParam({ name: 'id', description: 'Quotation UUID' })
  @ApiQuery({ name: 'template', required: false, description: 'Template type (default, wholesale, retail, loading, price-list)', enum: ['default', 'wholesale', 'retail', 'loading', 'price-list'] })
  @ApiResponse({ status: 200, description: 'HTML preview generated successfully', content: { 'text/html': {} } })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  async previewHTML(
    @Param('id') quotationId: string,
    @Query('template') template: string = 'default',
    @Res() res: Response,
  ) {
    const html = await this.pdfService.generateQuotationHTMLPreview(
      quotationId,
      template,
    );

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}

