import { Controller, Get, Post, All, Param, Query, Res, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PdfService } from './pdf.service';
import type { Response } from 'express';

@ApiTags('pdf')
@Controller('pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @All('quotations/:id/generate')
  @ApiOperation({ summary: 'Generate PDF for a quotation' })
  @ApiParam({ name: 'id', description: 'Quotation UUID' })
  @ApiQuery({
    name: 'template',
    required: false,
    description:
      'Template type (default, wholesale, retail, loading, price-list)',
    enum: ['default', 'wholesale', 'retail', 'loading', 'price-list'],
  })
  @ApiResponse({
    status: 200,
    description: 'PDF file generated successfully',
    content: { 'application/pdf': {} },
  })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  async generatePDF(
    @Param('id') quotationId: string,
    @Query('template') template: string = 'default',
    @Query('visibleClientFields') visibleClientFields: string | undefined,
    @Query('bankQuote') bankQuote: string | undefined,
    @Query('bankQuoteData') bankQuoteData: string | undefined,
    @Res() res: Response,
  ) {
    const parsedFields = visibleClientFields !== undefined ? (visibleClientFields === '' ? [] : visibleClientFields.split(',')) : undefined;
    const isBankQuote = bankQuote === 'true';
    const parsedBankQuoteData = bankQuoteData ? JSON.parse(bankQuoteData) : undefined;
    
    console.log('[PdfController.generatePDF] Request received:', {
      quotationId,
      template,
      isBankQuote,
      route: 'POST /api/pdf/quotations/:id/generate',
      timestamp: new Date().toISOString(),
    });

    const pdfBuffer = await this.pdfService.generateQuotationPDF(
      quotationId,
      template,
      parsedFields,
      isBankQuote,
      parsedBankQuoteData
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
  }

  @All('sales-orders/:id/generate')
  @ApiOperation({ summary: 'Generate PDF for a sales order' })
  @ApiParam({ name: 'id', description: 'Sales Order UUID' })
  @ApiQuery({
    name: 'template',
    required: false,
    description: 'Template type (default, wholesale, retail, loading, price-list)',
    enum: ['default', 'wholesale', 'retail', 'loading', 'price-list'],
  })
  @ApiResponse({
    status: 200,
    description: 'PDF file generated successfully',
    content: { 'application/pdf': {} },
  })
  @ApiResponse({ status: 404, description: 'Sales Order not found' })
  async generateSalesOrderPDF(
    @Param('id') soId: string,
    @Query('template') template: string = 'default',
    @Query('visibleClientFields') visibleClientFields: string | undefined,
    @Query('bankQuote') bankQuote: string | undefined,
    @Query('bankQuoteData') bankQuoteData: string | undefined,
    @Res() res: Response,
  ) {
    console.log('[PdfController.generateSalesOrderPDF] Request received:', {
      soId,
      timestamp: new Date().toISOString(),
    });

    const parsedFields = visibleClientFields !== undefined ? (visibleClientFields === '' ? [] : visibleClientFields.split(',')) : undefined;
    const isBankQuote = bankQuote === 'true';
    const parsedBankQuoteData = bankQuoteData ? JSON.parse(bankQuoteData) : undefined;

    const pdfBuffer = await this.pdfService.generateSalesOrderPDF(soId, template, parsedFields, isBankQuote, parsedBankQuoteData);

    console.log('[PdfController.generateSalesOrderPDF] PDF generated successfully:', {
      soId,
      pdfSize: pdfBuffer.length,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sales-order-${soId}.pdf"`,
    );
    res.send(pdfBuffer);
  }

  @Get('sales-orders/:id/preview')
  @ApiOperation({ summary: 'Preview HTML for a sales order PDF' })
  @ApiParam({ name: 'id', description: 'Sales Order UUID' })
  @ApiQuery({
    name: 'template',
    required: false,
    description: 'Template type (default, wholesale, retail, loading, price-list)',
    enum: ['default', 'wholesale', 'retail', 'loading', 'price-list'],
  })
  @ApiResponse({
    status: 200,
    description: 'HTML preview generated successfully',
    content: { 'text/html': {} },
  })
  @ApiResponse({ status: 404, description: 'Sales Order not found' })
  async previewSalesOrderHTML(
    @Param('id') soId: string,
    @Query('template') template: string = 'default',
    @Query('visibleClientFields') visibleClientFields: string | undefined,
    @Query('bankQuote') bankQuote: string | undefined,
    @Query('bankQuoteData') bankQuoteData: string | undefined,
    @Res() res: Response,
  ) {
    const parsedFields = visibleClientFields !== undefined ? (visibleClientFields === '' ? [] : visibleClientFields.split(',')) : undefined;
    const isBankQuote = bankQuote === 'true';
    const parsedBankQuoteData = bankQuoteData ? JSON.parse(bankQuoteData) : undefined;

    const html = await this.pdfService.generateSalesOrderHTMLPreview(
      soId,
      template,
      parsedFields,
      isBankQuote,
      parsedBankQuoteData
    );

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('quotations/:id/preview')
  @ApiOperation({ summary: 'Preview HTML for a quotation PDF' })
  @ApiParam({ name: 'id', description: 'Quotation UUID' })
  @ApiQuery({
    name: 'template',
    required: false,
    description:
      'Template type (default, wholesale, retail, loading, price-list)',
    enum: ['default', 'wholesale', 'retail', 'loading', 'price-list'],
  })
  @ApiResponse({
    status: 200,
    description: 'HTML preview generated successfully',
    content: { 'text/html': {} },
  })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  async previewHTML(
    @Param('id') quotationId: string,
    @Query('template') template: string = 'default',
    @Query('visibleClientFields') visibleClientFields: string | undefined,
    @Query('bankQuote') bankQuote: string | undefined,
    @Query('bankQuoteData') bankQuoteData: string | undefined,
    @Res() res: Response,
  ) {
    const parsedFields = visibleClientFields !== undefined ? (visibleClientFields === '' ? [] : visibleClientFields.split(',')) : undefined;
    const isBankQuote = bankQuote === 'true';
    const parsedBankQuoteData = bankQuoteData ? JSON.parse(bankQuoteData) : undefined;

    const html = await this.pdfService.generateQuotationHTMLPreview(
      quotationId,
      template,
      parsedFields,
      isBankQuote,
      parsedBankQuoteData
    );

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @All('sales-orders/:soId/splits/:splitId/generate')
  @ApiOperation({ summary: 'Generate PDF for a Sales Order Split' })
  @ApiParam({ name: 'soId', description: 'Sales Order UUID' })
  @ApiParam({ name: 'splitId', description: 'Dispatch Split UUID' })
  @ApiQuery({
    name: 'template',
    required: false,
    description: 'Template type (default, wholesale, retail, loading, price-list)',
    enum: ['default', 'wholesale', 'retail', 'loading', 'price-list'],
  })
  @ApiResponse({
    status: 200,
    description: 'PDF file generated successfully',
    content: { 'application/pdf': {} },
  })
  async generateSOSplitPDF(
    @Param('soId') soId: string,
    @Param('splitId') splitId: string,
    @Query('template') template: string = 'default',
    @Query('visibleClientFields') visibleClientFields: string | undefined,
    @Query('bankQuote') bankQuote: string | undefined,
    @Query('bankQuoteData') bankQuoteData: string | undefined,
    @Res() res: Response,
  ) {
    const parsedFields = visibleClientFields !== undefined ? (visibleClientFields === '' ? [] : visibleClientFields.split(',')) : undefined;
    const isBankQuote = bankQuote === 'true';
    const parsedBankQuoteData = bankQuoteData ? JSON.parse(bankQuoteData) : undefined;

    const pdfBuffer = await this.pdfService.generateSOSplitPDF(
      soId,
      splitId,
      template,
      parsedFields,
      isBankQuote,
      parsedBankQuoteData
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="split-${splitId}.pdf"`,
    );
    res.send(pdfBuffer);
  }

  @Get('sales-orders/:soId/splits/:splitId/preview')
  @ApiOperation({ summary: 'Preview HTML for a Sales Order Split PDF' })
  @ApiParam({ name: 'soId', description: 'Sales Order UUID' })
  @ApiParam({ name: 'splitId', description: 'Dispatch Split UUID' })
  @ApiQuery({
    name: 'template',
    required: false,
    description: 'Template type',
  })
  @ApiResponse({
    status: 200,
    description: 'HTML preview generated successfully',
    content: { 'text/html': {} },
  })
  async previewSOSplitHTML(
    @Param('soId') soId: string,
    @Param('splitId') splitId: string,
    @Query('template') template: string = 'default',
    @Query('visibleClientFields') visibleClientFields: string | undefined,
    @Query('bankQuote') bankQuote: string | undefined,
    @Query('bankQuoteData') bankQuoteData: string | undefined,
    @Res() res: Response,
  ) {
    const parsedFields = visibleClientFields !== undefined ? (visibleClientFields === '' ? [] : visibleClientFields.split(',')) : undefined;
    const isBankQuote = bankQuote === 'true';
    const parsedBankQuoteData = bankQuoteData ? JSON.parse(bankQuoteData) : undefined;

    const html = await this.pdfService.generateSOSplitHTMLPreview(
      soId,
      splitId,
      template,
      parsedFields,
      isBankQuote,
      parsedBankQuoteData
    );

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Post('shorten')
  @ApiOperation({ summary: 'Create a short link for sharing' })
  async createShortLink(@Body() body: { url: string }) {
    if (!body.url) throw new import('@nestjs/common').BadRequestException('url is required');
    const link = await this.pdfService.createShortLink(body.url);
    return { id: link.id };
  }

  @Get('s/:id')
  @ApiOperation({ summary: 'Redirect to a short link' })
  async redirectShortLink(@Param('id') id: string, @Res() res: Response) {
    const link = await this.pdfService.getShortLink(id);
    if (!link) throw new import('@nestjs/common').NotFoundException('Link not found');
    res.redirect(302, link.url);
  }
}
