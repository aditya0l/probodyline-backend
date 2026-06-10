import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { QuotationsService } from '../quotations/quotations.service';
import { PrismaService } from '../common/prisma.service';
import { renderTemplate, numberToWords } from './pdf-template-engine';
import {
  buildTableData,
  imageToDataURL,
  CANONICAL_COLUMN_ORDER,
} from './pdf-template-engine-helpers';
import { QuotationColumnId, PDFTemplateData } from './types';
import { Quotation, Customer, QuotationItem } from '@prisma/client';
import { LOGO_BASE64 } from './logo-base64';

@Injectable()
export class PdfService implements OnModuleDestroy {
  private browserInstance: Browser | null = null;
  private browserLaunchPromise: Promise<Browser> | null = null;

  constructor(
    private quotationsService: QuotationsService,
    private prisma: PrismaService,
  ) {}

  async onModuleDestroy() {
    if (this.browserInstance) {
      await this.browserInstance.close();
      this.browserInstance = null;
    }
  }

  private async getBrowser(): Promise<Browser> {
    // If we already have a healthy browser, return it
    if (this.browserInstance) {
      try {
        // Quick health check
        await this.browserInstance.version();
        return this.browserInstance;
      } catch {
        this.browserInstance = null;
        this.browserLaunchPromise = null;
      }
    }

    // If a launch is already in progress, wait for it
    if (this.browserLaunchPromise) {
      return this.browserLaunchPromise;
    }

    // Launch a new browser
    this.browserLaunchPromise = puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
    });

    this.browserInstance = await this.browserLaunchPromise;
    this.browserLaunchPromise = null;
    return this.browserInstance;
  }

  async generateQuotationPDF(
    quotationId: string,
    template: string = 'default',
    visibleClientFields?: string[],
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
    const html = await this.generateQuotationHTML(fullQuotation, template, false, visibleClientFields);

    // Reuse persistent browser instance for speed
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });

      // Determine if landscape is needed
      let activeColumnsCount = 7;
      if (quotation.visibleColumns && typeof quotation.visibleColumns === 'object') {
        activeColumnsCount = Object.values(quotation.visibleColumns).filter(Boolean).length;
      }
      const useLandscape = template === 'default' && activeColumnsCount > 8;

      // Generate PDF
      const pdf = await page.pdf({
        format: 'A4',
        landscape: useLandscape,
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: `<div style="font-size: 8px; width: 100%; text-align: center; color: #666; font-family: Arial, sans-serif; padding-top: 20px;">This is a computer Generated Quotation, Page <span class="pageNumber"></span> of <span class="totalPages"></span> for #${quotation.quoteNumber || quotation.id}, ${quotation.status === 'BOOKED' ? 'Booked' : 'Booking Pending'}</div>`,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '30mm',
          left: '10mm',
        },
      });

      console.log('PDF Generated. Size:', (pdf.length / 1024).toFixed(2), 'KB');
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }

  async generateSOSplitPDF(
    soId: string,
    splitId: string,
    template: string = 'default',
    visibleClientFields?: string[],
  ): Promise<Buffer> {
    const split = await this.prisma.dispatchSplit.findUnique({
      where: { id: splitId },
      include: {
        items: true,
        salesOrder: {
          include: {
            quotation: {
              include: {
                customer: true,
                items: {
                  orderBy: { srNo: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!split || !split.salesOrder || !split.salesOrder.quotation) {
      throw new NotFoundException('Split or Quotation not found');
    }

    const quotation = split.salesOrder.quotation;

    // Filter and update items for this split
    const filteredItems = quotation.items.map(item => {
      const splitItem = split.items.find(si => si.quotationItemId === item.id);
      const qty = splitItem ? splitItem.quantity : 0;
      if (qty <= 0) return null;

      return {
        ...item,
        quantity: qty,
        totalAmount: qty * Number(item.rate || 0),
      };
    }).filter(Boolean) as unknown as QuotationItem[];

    // Recalculate totals
    const subtotal = filteredItems.reduce((sum, item) => sum + Number(item.totalAmount), 0);
    const gstAmount = subtotal * (Number(quotation.gstRate || 18) / 100);
    const grandTotal = subtotal + gstAmount;

    const mockedQuotation = {
      ...quotation,
      items: filteredItems,
      subtotal: subtotal as any,
      gstAmount: gstAmount as any,
      grandTotal: grandTotal as any,
    };

    const html = await this.generateQuotationHTML(mockedQuotation, template, false, visibleClientFields);

    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    const browser = await this.getBrowser();

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const pdf = await page.pdf({ 
        format: 'A4', 
        printBackground: true, 
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: `<div style="font-size: 8px; width: 100%; text-align: center; color: #666; font-family: Arial, sans-serif; padding-top: 20px;">This is a computer Generated Quotation, Page <span class="pageNumber"></span> of <span class="totalPages"></span> for #${quotation.quoteNumber || quotation.id}, ${quotation.status === 'BOOKED' ? 'Booked' : 'Booking Pending'}</div>`,
        margin: { top: '10mm', right: '10mm', bottom: '30mm', left: '10mm' } 
      });
      console.log('PDF Generated (SO Split). Size:', (pdf.length / 1024).toFixed(2), 'KB');
      await page.close();
      return Buffer.from(pdf);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  async generateSOSplitHTMLPreview(
    soId: string,
    splitId: string,
    template: string = 'default',
    visibleClientFields?: string[],
  ): Promise<string> {
    const split = await this.prisma.dispatchSplit.findUnique({
      where: { id: splitId },
      include: {
        items: true,
        salesOrder: {
          include: {
            quotation: {
              include: {
                customer: true,
                items: {
                  orderBy: { srNo: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!split || !split.salesOrder || !split.salesOrder.quotation) {
      throw new NotFoundException('Split or Quotation not found');
    }

    const quotation = split.salesOrder.quotation;

    // Filter and update items for this split
    const filteredItems = quotation.items.map(item => {
      const splitItem = split.items.find(si => si.quotationItemId === item.id);
      const qty = splitItem ? splitItem.quantity : 0;
      if (qty <= 0) return null;

      return {
        ...item,
        quantity: qty,
        totalAmount: qty * Number(item.rate || 0),
      };
    }).filter(Boolean) as unknown as QuotationItem[];

    // Recalculate totals
    const subtotal = filteredItems.reduce((sum, item) => sum + Number(item.totalAmount), 0);
    const gstAmount = subtotal * (Number(quotation.gstRate || 18) / 100);
    const grandTotal = subtotal + gstAmount;

    const mockedQuotation = {
      ...quotation,
      items: filteredItems,
      subtotal: subtotal as any,
      gstAmount: gstAmount as any,
      grandTotal: grandTotal as any,
    };

    return await this.generateQuotationHTML(mockedQuotation, template, true, visibleClientFields);
  }

  async generateQuotationHTMLPreview(
    quotationId: string,
    template: string = 'default',
    visibleClientFields?: string[],
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

    return await this.generateQuotationHTML(fullQuotation, template, true, visibleClientFields);
  }

  private async generateQuotationHTML(
    quotation: Quotation & {
      customer?: Customer | null;
      items: QuotationItem[];
    },
    templateType: string,
    isPreview = false,
    visibleClientFields?: string[],
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
    const showHeader = true;
    let showClientInfo = true;
    const showGymName = true;
    const showDeliveryDate = true;
    let showDisclaimer = false; // Only show in price-list template
    let showTotals = true;
    let showBankDetails = true;
    let showGSTBreakdown = false;
    let showSubtotalLabel = true; // Most templates show subtotal label, except wholesale
    let titleText = 'PROFORMA INVOICE';

    // Adjustments based on template type
    switch (templateType) {
      case 'wholesale':
        titleText = 'WHOLESALE INVOICE';
        showSubtotalLabel = false; // Don't show separate subtotal label for wholesale
        showGSTBreakdown = true; // Wholesale uses breakdown format (3-row table)
        showDisclaimer = true; // Show disclaimer in totals for wholesale
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
        showSubtotalLabel = false; // Retail uses simplified format (no subtotal label)
        showGSTBreakdown = false; // No breakdown for retail (simple 2-line format)
        showDisclaimer = false; // No disclaimer for retail
        // Retail: always use predefined columns (ignore saved visibleColumns)
        visibleColumns = [
          'srNo',
          'productName',
          'productImage',
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
          'productName',
          'productImage',
          'modelNumber',
          'quantity',
        ];
        break;
      case 'price-list':
        titleText = 'PRICE LIST';
        showDisclaimer = true; // ONLY price-list shows disclaimer
        showClientInfo = false;
        showTotals = false;
        showBankDetails = true; // Show bank details in price-list
        // Price list: always use predefined columns (ignore saved visibleColumns)
        visibleColumns = [
          'srNo',
          'productName',
          'productImage',
          'modelNumber',
          'rate',
        ];
        break;
      case 'default':
      default: {
        titleText = 'PROFORMA INVOICE';
        // ONLY for default template: use user's saved columns if available
        let userSelectedColumns: QuotationColumnId[] | null = null;
        if (quotation.visibleColumns) {
          const customVisibleColumns = Object.entries(quotation.visibleColumns)
            .filter(([, isVisible]) => isVisible)
            .map(([columnId]) => columnId as QuotationColumnId);
          if (customVisibleColumns.length > 0) {
            // Sort columns according to canonical order to ensure consistent left-to-right sequence
            userSelectedColumns = CANONICAL_COLUMN_ORDER.filter((col) =>
              customVisibleColumns.includes(col),
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
        useLandscape = templateType === 'default' && visibleColumns.length > 8;
        break;
      }
    }

    const { headers: tableHeaders, rows: productsTableRows } =
      await buildTableData(
        quotation.items,
        visibleColumns,
        visibleColumns.length,
        !isPreview,
        templateType,
      );

    // Use hardcoded base64 for reliable layout
    let companyLogoBase64 = LOGO_BASE64;
    
    // Map visibleClientFields to boolean flags. If visibleClientFields is not provided, default all to true.
    const showField = (field: string) => visibleClientFields ? visibleClientFields.includes(field) : true;

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
      quoteDate: this.formatDateWithTime(quotation.createdAt),
      deliveryDate: quotation.deliveryDate
        ? this.formatDateFriendly(quotation.deliveryDate)
        : undefined,
      bookingDate: quotation.bookingDate
        ? this.formatDateFriendly(quotation.bookingDate)
        : undefined,
      dispatchDate: quotation.dispatchDate
        ? this.formatDateFriendly(quotation.dispatchDate)
        : undefined,
      installationDate: quotation.installationDate
        ? this.formatDateFriendly(quotation.installationDate)
        : undefined,
      inaugurationDate: quotation.inaugurationDate
        ? this.formatDateFriendly(quotation.inaugurationDate)
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
      leadName: quotation.leadName || undefined,
      status: quotation.status || 'DRAFT',
      
      // Client Info visibility flags
      showClientNameField: showField('clientName'),
      showAddressLine1Field: showField('addressLine1'),
      showAddressLine2Field: showField('addressLine2'),
      showCityField: showField('city'),
      showGstNoField: showField('gstNo'),
      showBookingDateField: showField('bookingDate'),
      showDispatchDateField: showField('dispatchDate'),
      showPanCardField: showField('panCard'),
      showAadharCardField: showField('aadharCard'),
      showGymAreaField: showField('gymArea'),
      showGymNameField: showField('gymName'),

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
      colSpanMinusOne: visibleColumns.length - 1,
      colSpanMinusTwo: Math.max(1, visibleColumns.length - 2),
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
      isWholesale: templateType === 'wholesale',
      isRetail: templateType === 'retail',
      isPriceList: templateType === 'price-list',
      isLoadingSlip: templateType === 'loading',
      bankDetails: quotation.bankDetails || undefined,
      termsAndConditions: quotation.termsAndConditions || undefined,
      warrantyInfo: quotation.warrantyInfo || undefined,
      computerGeneratedText: `This is a computer Generated Quotation, Page 1 of 1 for #${quotation.quoteNumber || quotation.id}, ${quotation.status === 'BOOKED' ? 'Booked' : 'Booking Pending'}`,

      // CSS content (will be injected)
      CSS_CONTENT: '',
    };

    // Load the base HTML template
    const templatePath = path.join(
      __dirname,
      'templates',
      'quotation-template.html',
    );
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

  /**
   * Format date with time as yyyy-mm-dd/hh:mm
   */
  private formatDateWithTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}/${hours}:${minutes}`;
  }

  /**
   * Format date only as yyyy-mm-dd
   */
  private formatDateOnly(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format date as dd/mm/yyyy
   */
  private formatDateFriendly(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
  }
}
