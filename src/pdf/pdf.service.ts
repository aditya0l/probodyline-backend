import { Injectable, NotFoundException } from '@nestjs/common';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { QuotationsService } from '../quotations/quotations.service';
import { PrismaService } from '../common/prisma.service';
import { renderTemplate, numberToWords } from './pdf-template-engine';
import { buildTableData, imageToDataURL, CANONICAL_COLUMN_ORDER } from './pdf-template-engine-helpers';
import { QuotationColumnId, PDFTemplateData } from './types';
import { Quotation, Customer, QuotationItem } from '@prisma/client';

@Injectable()
export class PdfService {
  constructor(
    private quotationsService: QuotationsService,
    private prisma: PrismaService,
  ) {}

  async generateQuotationPDF(
    quotationId: string,
    template: string = 'default',
  ): Promise<Buffer> {
    // Get quotation data with full organization details
    const quotation = await this.quotationsService.findOne(quotationId);
    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    // Fetch full quotation details
    const fullQuotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        customer: true,
        items: {
          orderBy: { srNo: 'asc' },
        },
      },
    });

    if (!fullQuotation) {
      throw new NotFoundException('Quotation not found');
    }

    // Generate HTML from quotation data
    const html = await this.generateQuotationHTML(fullQuotation, template);

    // Launch Puppeteer with optimized settings for faster PDF generation
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Overcome limited resource problems
        '--disable-gpu', // Disable GPU hardware acceleration
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
    });

    try {
      const page = await browser.newPage();
      // Use 'domcontentloaded' instead of 'networkidle0' for faster loading
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });

      // Determine if landscape is needed
      const useLandscape = (quotation.visibleColumns && 
        Object.values(quotation.visibleColumns).filter(Boolean).length >= 13) || false;

      // Generate PDF
      const pdf = await page.pdf({
        format: 'A4',
        landscape: useLandscape,
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  async generateQuotationHTMLPreview(
    quotationId: string,
    template: string = 'default',
  ): Promise<string> {
    // Fetch full quotation with all details
    const fullQuotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        customer: true,
        items: {
          orderBy: { srNo: 'asc' },
        },
      },
    });

    if (!fullQuotation) {
      throw new NotFoundException('Quotation not found');
    }

    return await this.generateQuotationHTML(fullQuotation, template);
  }

  private async generateQuotationHTML(
    quotation: Quotation & {
      customer?: Customer | null;
      items: QuotationItem[];
    },
    templateType: string,
  ): Promise<string> {
    const customer = quotation.customer;

    // Helper to convert Prisma Decimal to number
    const toNumber = (value: number | { toNumber?: () => number }): number => {
      if (typeof value === 'number') return value;
      return value.toNumber ? value.toNumber() : Number(value);
    };

    // Determine visible columns based on template type and quotation settings
    let visibleColumns: QuotationColumnId[] = [];
    let useLandscape = false;
    let showHeader = true;
    let showClientInfo = true;
    let showGymName = true;
    let showDeliveryDate = true;
    let showDisclaimer = false;  // Only show in price-list template
    let showTotals = true;
    let showBankDetails = true;
    let showGSTBreakdown = false;
    let showSubtotalLabel = true;  // Most templates show subtotal label, except wholesale
    let titleText = 'PROFORMA INVOICE';

    // Adjustments based on template type
    switch (templateType) {
      case 'wholesale':
        titleText = 'WHOLESALE INVOICE';
        showSubtotalLabel = false;  // Don't show separate subtotal label for wholesale
        showGSTBreakdown = true;    // Wholesale uses breakdown format (3-row table)
        showDisclaimer = true;      // Show disclaimer in totals for wholesale
        // Wholesale: 7 columns matching the template design (ignore saved visibleColumns)
        visibleColumns = [
          'srNo',
          'productName',
          'productImage',
          'modelNumber',
          'quantity',
          'rate',
          'totalAmount',
        ];
        useLandscape = false; // Use portrait like other templates
        break;
      case 'retail':
        titleText = 'RETAIL INVOICE';
        showSubtotalLabel = false;  // Retail uses simplified format (no subtotal label)
        showGSTBreakdown = false;   // No breakdown for retail (simple 2-line format)
        showDisclaimer = false;     // No disclaimer for retail
        // Retail: always use predefined columns (ignore saved visibleColumns)
        visibleColumns = [
          'srNo',
          'productImage',
          'productName',
          'modelNumber',
          'quantity',
        ];
        useLandscape = false; // Portrait mode for minimal columns
        break;
      case 'loading':
        titleText = 'LOADING SLIP';
        showClientInfo = false;
        showTotals = false;
        showBankDetails = false;
        showDisclaimer = false;
        // Loading slip: always use predefined columns (ignore saved visibleColumns)
        visibleColumns = [
          'srNo',
          'productImage',
          'productName',
          'modelNumber',
          'quantity',
        ];
        break;
      case 'price-list':
        titleText = 'PRICE LIST';
        showDisclaimer = true;      // ONLY price-list shows disclaimer
        showClientInfo = false;
        showTotals = false;
        showBankDetails = true;     // Show bank details in price-list
        // Price list: always use predefined columns (ignore saved visibleColumns)
        visibleColumns = [
          'srNo',
          'productImage',
          'productName',
          'modelNumber',
          'rate',
        ];
        break;
      case 'default':
      default:
        titleText = 'PROFORMA INVOICE';
        // ONLY for default template: use user's saved columns if available
        let userSelectedColumns: QuotationColumnId[] | null = null;
        if (quotation.visibleColumns) {
          const customVisibleColumns = Object.entries(quotation.visibleColumns)
            .filter(([, isVisible]) => isVisible)
            .map(([columnId]) => columnId as QuotationColumnId);
          if (customVisibleColumns.length > 0) {
            // Sort columns according to canonical order to ensure consistent left-to-right sequence
            userSelectedColumns = CANONICAL_COLUMN_ORDER.filter(col => 
              customVisibleColumns.includes(col)
            );
          }
        }
        visibleColumns = userSelectedColumns || [
          'srNo',
          'productImage',
          'productName',
          'modelNumber',
          'quantity',
          'rate',
          'totalAmount',
        ];
        useLandscape = visibleColumns.length >= 13;
        break;
    }

    const { headers: tableHeaders, rows: productsTableRows } = await buildTableData(
      quotation.items,
      visibleColumns,
      visibleColumns.length,
    );

    // Convert company logo to base64
    let companyLogoBase64 = '';
    if (quotation.companyLogo) {
      try {
        companyLogoBase64 = await imageToDataURL(quotation.companyLogo);
      } catch (error) {
        console.error('Failed to load company logo:', error);
      }
    }

    const data: PDFTemplateData = {
      // Company Info (denormalized from quotation)
      companyName: quotation.companyName,
      companyAddress: quotation.companyAddress,
      companyGST: quotation.companyGST,
      companyPhone: quotation.companyPhone,
      companyEmail: quotation.companyEmail,
      companyWebsite: quotation.companyWebsite,
      companyContactPerson: quotation.companyContactPerson,
      companyLogo: companyLogoBase64 || undefined,

      // Quotation Info
      quoteNumber: quotation.quoteNumber,
      quoteDate: new Date(quotation.createdAt).toLocaleDateString('en-IN'),
      deliveryDate: quotation.deliveryDate
        ? new Date(quotation.deliveryDate).toLocaleDateString('en-IN')
        : undefined,
      templateType: templateType,
      isDefaultTemplate: templateType === 'default',
      titleText: titleText,

      // Client Info
      clientName: customer?.name || quotation.clientName || undefined,
      clientAddress: customer?.address || quotation.clientAddress || undefined,
      clientCity: customer?.city || quotation.clientCity || undefined,
      gymName: customer?.gymName || quotation.gymName || undefined,
      gymArea: customer?.area || quotation.gymArea || undefined,
      clientGST: customer?.gst || quotation.clientGST || undefined,

      // Totals
      subtotal: toNumber(quotation.subtotal).toLocaleString('en-IN'),
      gstRate: toNumber(quotation.gstRate),
      gstAmount: toNumber(quotation.gstAmount).toLocaleString('en-IN'),
      grandTotal: toNumber(quotation.grandTotal).toLocaleString('en-IN'),
      amountInWords: numberToWords(toNumber(quotation.grandTotal)),

      // Table Data
      tableHeaders: tableHeaders,
      products: productsTableRows,
      columnCount: visibleColumns.length,
      useLandscape: useLandscape,

      // Conditional Flags
      showHeader: showHeader,
      showClientInfo: showClientInfo,
      showGymName: showGymName,
      showDeliveryDate: showDeliveryDate,
      showDisclaimer: showDisclaimer,
      showTotals: showTotals,
      showBankDetails: showBankDetails,
      showGSTBreakdown: showGSTBreakdown,
      showSubtotalLabel: showSubtotalLabel,
      bankDetails: quotation.bankDetails || undefined,
      termsAndConditions: quotation.termsAndConditions || undefined,
      warrantyInfo: quotation.warrantyInfo || undefined,

      // CSS content (will be injected)
      CSS_CONTENT: '',
    };

    // Load the base HTML template
    const templatePath = path.join(__dirname, 'templates', 'quotation-template.html');
    const cssPath = path.join(__dirname, 'templates', 'quotation-styles.css');

    let htmlTemplate = '';
    let styles = '';

    try {
      htmlTemplate = fs.readFileSync(templatePath, 'utf8');
      styles = fs.readFileSync(cssPath, 'utf8');
    } catch (error) {
      console.error('Error loading PDF template or CSS:', error);
      throw new NotFoundException('PDF template or CSS file not found.');
    }

    // Inject CSS into the HTML template
    htmlTemplate = htmlTemplate.replace('/* CSS_CONTENT */', styles);
    data.CSS_CONTENT = styles; // Also set in data for reference

    return renderTemplate(htmlTemplate, data);
  }
}

