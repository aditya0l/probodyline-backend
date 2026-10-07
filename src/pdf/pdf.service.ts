import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { QuotationsService } from '../quotations/quotations.service';
import { PrismaService } from '../common/prisma.service';
import { PDFDocument } from 'pdf-lib';
import axios from 'axios';
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
    isBankQuote?: boolean,
    bankQuoteData?: any
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
        clients: true,
        items: {
          orderBy: { srNo: 'asc' },
        },
      },
    });

    if (!fullQuotation) {
      throw new NotFoundException('Quotation not found');
    }

    // Generate HTML from quotation data
    const html = await this.generateQuotationHTML(fullQuotation, template, false, visibleClientFields, isBankQuote, bankQuoteData);

    // Reuse persistent browser instance for speed
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, {
        waitUntil: 'networkidle0',
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
        footerTemplate: '<div style="width: 100%; font-size: 8px; font-family: Helvetica, Arial, sans-serif; color: #111; text-align: center; padding-top: 5px;">  <div style="width: 96%; border-top: 2px solid #000; margin: 0 auto 5px auto;"></div>  <div style="margin-bottom: 5px; font-weight: bold; display: flex; justify-content: center; align-items: center; gap: 15px;">    <span style="display: flex; align-items: center;">      <img src="data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZmlsbD0iIzMzMyI+PHBhdGggZD0iTTcuNzUgMmg4LjVjMy4xNyAwIDUuNzUgMi41OCA1Ljc1IDUuNzV2OC41YzAgMy4xNy0yLjU4IDUuNzUtNS43NSA1Ljc1aC04LjVDNC41OCAyMiAyIDE5LjQyIDIgMTYuMjV2LTguNUMyIDQuNTggNC41OCAyIDcuNzUgMnptOC41IDEuNWgtOC41Yy0yLjM0IDAtNC4yNSAxLjkxLTQuMjUgNC4yNXY4LjVjMCAyLjM0IDEuOTEgNC4yNSA0LjI1IDQuMjVoOC41YzIuMzQgMCA0LjI1LTEuOTEgNC4yNS00LjI1di04LjVjMC0yLjM0LTEuOTEtNC4yNS00LjI1LTQuMjV6bS00LjI1IDRjMi40OCAwIDQuNSAyLjAyIDQuNSA0LjVzLTIuMDIgNC41LTQuNSA0LjUtNC41LTIuMDItNC41LTQuNSAyLjAyLTQuNSA0LjUtNC41em0wIDEuNWMtMS42NSAwLTMgMS4zNS0zIDNzMS4zNSAzIDMgMyAzLTEuMzUgMy0zLTEuMzUtMy0zLTN6bTUuMy0yLjhhMS4yIDEuMiAwIDExMCAyLjQgMS4yIDEuMiAwIDAxMC0yLjR6Ii8+PC9zdmc+" style="width: 12px; height: 12px; margin-right: 4px;" />      probodyline    </span>    <span style="display: flex; align-items: center;">      <img src="data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZmlsbD0iIzMzMyI+PHBhdGggZD0iTTIxLjU4IDcuMTljLS4yMy0uODYtLjkxLTEuNTQtMS43Ny0xLjc3QzE4LjI1IDUgMTIgNSAxMiA1cy02LjI1IDAtNy44MS40MmMtLjg2LjIzLTEuNTQuOTEtMS43NyAxLjc3QzIgOC43NSAyIDEyIDIgMTJzMCAzLjI1LjQyIDQuODFjLjIzLjg2LjkxIDEuNTQgMS43NyAxLjc3QzUuNzUgMTkgMTIgMTkgMTIgMTlzNi4yNSAwIDcuODEtLjQyYy44Ni0uMjMgMS41NC0uOTEgMS43Ny0xLjc3QzIyIDE1LjI1IDIyIDEyIDIyIDEyczAtMy4yNS0uNDItNC44MXpNMTAgMTVWOWw1LjIgMy01LjIgM3oiLz48L3N2Zz4=" style="width: 12px; height: 12px; margin-right: 4px;" />      probodyline.    </span>    <span style="display: flex; align-items: center;">      <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiBmaWxsPSIjMzMzIj48cGF0aCBkPSJNMzUyIDI1NmMwIDIyLjItMS4yIDQzLjYtMy4zIDY0SDE2My4zYy0yLjItMjAuNC0zLjMtNDEuOC0zLjMtNjRzMS4yLTQzLjYgMy4zLTY0aDE4NS40YzIuMiAyMC40IDMuMyA0MS44IDMuMyA2NHptMjguOC02NEg1MDMuOWM1LjMgMjAuNSA4LjEgNDEuOSA4LjEgNjRzLTIuOCA0My41LTguMSA2NEgzODAuOGMyLjEtMjAuNiAzLjItNDIgMy4yLTY0cy0xLjEtNDMuNC0zLjItNjR6bTExMi42LTMySDM3Ni43Yy0xMC02My45LTI5LjgtMTE3LjQtNTUuMy0xNTEuNmM3OC4zIDIwLjcgMTQyIDc3LjUgMTcxLjkgMTUxLjZ6bS0xNDkuMSAwSDE2Ny43YzYuMS0zNi40IDE1LjUtNjguNiAyNy05NC43YzEwLjUtMjMuNiAyMi4yLTQwLjcgMzMuNS01MS41QzIzOS40IDMuMiAyNDguNyAwIDI1NiAwczE2LjYgMy4yIDI3LjggMTMuOGMxMS4zIDEwLjggMjMgMjcuOSAzMy41IDUxLjVjMTEuNiAyNiAyMC45IDU4LjIgMjcgOTQuN3ptLTIwOSAwSDE4LjZDNDguNiA4NS45IDExMi4zIDI5LjEgMTkwLjYgOC40QzE2NS4xIDQyLjYgMTQ1LjMgOTYuMSAxMzUuMyAxNjB6TTguMSAxOTJIMTMxLjJjLTIuMSAyMC42LTMuMiA0Mi0zLjIgNjRzMS4xIDQzLjQgMy4yIDY0SDguMUMyLjggMjk5LjUgMCAyNzguMSAwIDI1NnMyLjgtNDMuNSA4LjEtNjR6TTE5NC43IDQ0Ni42Yy0xMS42LTI2LTIwLjktNTguMi0yNy05NC42SDM0NC4zYy02LjEgMzYuNC0xNS41IDY4LjYtMjcgOTQuNmMtMTAuNSAyMy42LTIyLjIgNDAuNy0zMy41IDUxLjVDMjcyLjYgNTA4LjggMjYzLjMgNTEyIDI1NiA1MTJzLTE2LjYtMy4yLTI3LjgtMTMuOGMtMTEuMy0xMC44LTIzLTI3LjktMzMuNS01MS41ek0xMzUuMyAzNTJjMTAgNjMuOSAyOS44IDExNy40IDU1LjMgMTUxLjZDMTEyLjMgNDgyLjkgNDguNiA0MjYuMSAxOC42IDM1MkgxMzUuM3ptMzU4LjEgMGMtMzAgNzQuMS05My42IDEzMC45LTE3MS45IDE1MS42YzI1LjUtMzQuMiA0NS4yLTg3LjcgNTUuMy0xNTEuNkg0OTMuNHoiLz48L3N2Zz4=" style="width: 12px; height: 12px; margin-right: 4px;" />      www.probodyline.com    </span>  </div>  <div style="font-weight: bold; margin-top: 3px;">This is a computer Generated Quotation, Page <span class="pageNumber"></span> of <span class="totalPages"></span></div></div>',
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '30mm',
          left: '10mm',
        },
      });

      console.log('PDF Generated. Size:', (pdf.length / 1024).toFixed(2), 'KB');
      return await this.mergeBankQuoteDocuments(Buffer.from(pdf), isBankQuote ? bankQuoteData?.documentUrls : undefined);
    } finally {
      await page.close();
    }
  }

  async generateSalesOrderPDF(
    soId: string,
    template: string = 'default',
    visibleClientFields?: string[],
    isBankQuote?: boolean,
    bankQuoteData?: any
  ): Promise<Buffer> {
    const html = await this.generateSalesOrderHTMLPreview(soId, template, visibleClientFields, isBankQuote, bankQuoteData);

    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 15000,
      });

      const pdf = await page.pdf({
        format: 'A4',
        landscape: template === 'default',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: '<div style="width: 100%; font-size: 8px; font-family: Helvetica, Arial, sans-serif; color: #111; text-align: center; padding-top: 5px;">  <div style="width: 96%; border-top: 2px solid #000; margin: 0 auto 5px auto;"></div>  <div style="margin-bottom: 5px; font-weight: bold; display: flex; justify-content: center; align-items: center; gap: 15px;">    <span style="display: flex; align-items: center;">      <img src="data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZmlsbD0iIzMzMyI+PHBhdGggZD0iTTcuNzUgMmg4LjVjMy4xNyAwIDUuNzUgMi41OCA1Ljc1IDUuNzV2OC41YzAgMy4xNy0yLjU4IDUuNzUtNS43NSA1Ljc1aC04LjVDNC41OCAyMiAyIDE5LjQyIDIgMTYuMjV2LTguNUMyIDQuNTggNC41OCAyIDcuNzUgMnptOC41IDEuNWgtOC41Yy0yLjM0IDAtNC4yNSAxLjkxLTQuMjUgNC4yNXY4LjVjMCAyLjM0IDEuOTEgNC4yNSA0LjI1IDQuMjVoOC41YzIuMzQgMCA0LjI1LTEuOTEgNC4yNS00LjI1di04LjVjMC0yLjM0LTEuOTEtNC4yNS00LjI1LTQuMjV6bS00LjI1IDRjMi40OCAwIDQuNSAyLjAyIDQuNSA0LjVzLTIuMDIgNC41LTQuNSA0LjUtNC41LTIuMDItNC41LTQuNSAyLjAyLTQuNSA0LjUtNC41em0wIDEuNWMtMS42NSAwLTMgMS4zNS0zIDNzMS4zNSAzIDMgMyAzLTEuMzUgMy0zLTEuMzUtMy0zLTN6bTUuMy0yLjhhMS4yIDEuMiAwIDExMCAyLjQgMS4yIDEuMiAwIDAxMC0yLjR6Ii8+PC9zdmc+" style="width: 12px; height: 12px; margin-right: 4px;" />      probodyline    </span>    <span style="display: flex; align-items: center;">      <img src="data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZmlsbD0iIzMzMyI+PHBhdGggZD0iTTIxLjU4IDcuMTljLS4yMy0uODYtLjkxLTEuNTQtMS43Ny0xLjc3QzE4LjI1IDUgMTIgNSAxMiA1cy02LjI1IDAtNy44MS40MmMtLjg2LjIzLTEuNTQuOTEtMS43NyAxLjc3QzIgOC43NSAyIDEyIDIgMTJzMCAzLjI1LjQyIDQuODFjLjIzLjg2LjkxIDEuNTQgMS43NyAxLjc3QzUuNzUgMTkgMTIgMTkgMTIgMTlzNi4yNSAwIDcuODEtLjQyYy44Ni0uMjMgMS41NC0uOTEgMS43Ny0xLjc3QzIyIDE1LjI1IDIyIDEyIDIyIDEyczAtMy4yNS0uNDItNC44MXpNMTAgMTVWOWw1LjIgMy01LjIgM3oiLz48L3N2Zz4=" style="width: 12px; height: 12px; margin-right: 4px;" />      probodyline.    </span>    <span style="display: flex; align-items: center;">      <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiBmaWxsPSIjMzMzIj48cGF0aCBkPSJNMzUyIDI1NmMwIDIyLjItMS4yIDQzLjYtMy4zIDY0SDE2My4zYy0yLjItMjAuNC0zLjMtNDEuOC0zLjMtNjRzMS4yLTQzLjYgMy4zLTY0aDE4NS40YzIuMiAyMC40IDMuMyA0MS44IDMuMyA2NHptMjguOC02NEg1MDMuOWM1LjMgMjAuNSA4LjEgNDEuOSA4LjEgNjRzLTIuOCA0My41LTguMSA2NEgzODAuOGMyLjEtMjAuNiAzLjItNDIgMy4yLTY0cy0xLjEtNDMuNC0zLjItNjR6bTExMi42LTMySDM3Ni43Yy0xMC02My45LTI5LjgtMTE3LjQtNTUuMy0xNTEuNmM3OC4zIDIwLjcgMTQyIDc3LjUgMTcxLjkgMTUxLjZ6bS0xNDkuMSAwSDE2Ny43YzYuMS0zNi40IDE1LjUtNjguNiAyNy05NC43YzEwLjUtMjMuNiAyMi4yLTQwLjcgMzMuNS01MS41QzIzOS40IDMuMiAyNDguNyAwIDI1NiAwczE2LjYgMy4yIDI3LjggMTMuOGMxMS4zIDEwLjggMjMgMjcuOSAzMy41IDUxLjVjMTEuNiAyNiAyMC45IDU4LjIgMjcgOTQuN3ptLTIwOSAwSDE4LjZDNDguNiA4NS45IDExMi4zIDI5LjEgMTkwLjYgOC40QzE2NS4xIDQyLjYgMTQ1LjMgOTYuMSAxMzUuMyAxNjB6TTguMSAxOTJIMTMxLjJjLTIuMSAyMC42LTMuMiA0Mi0zLjIgNjRzMS4xIDQzLjQgMy4yIDY0SDguMUMyLjggMjk5LjUgMCAyNzguMSAwIDI1NnMyLjgtNDMuNSA4LjEtNjR6TTE5NC43IDQ0Ni42Yy0xMS42LTI2LTIwLjktNTguMi0yNy05NC42SDM0NC4zYy02LjEgMzYuNC0xNS41IDY4LjYtMjcgOTQuNmMtMTAuNSAyMy42LTIyLjIgNDAuNy0zMy41IDUxLjVDMjcyLjYgNTA4LjggMjYzLjMgNTEyIDI1NiA1MTJzLTE2LjYtMy4yLTI3LjgtMTMuOGMtMTEuMy0xMC44LTIzLTI3LjktMzMuNS01MS41ek0xMzUuMyAzNTJjMTAgNjMuOSAyOS44IDExNy40IDU1LjMgMTUxLjZDMTEyLjMgNDgyLjkgNDguNiA0MjYuMSAxOC42IDM1MkgxMzUuM3ptMzU4LjEgMGMtMzAgNzQuMS05My42IDEzMC45LTE3MS45IDE1MS42YzI1LjUtMzQuMiA0NS4yLTg3LjcgNTUuMy0xNTEuNkg0OTMuNHoiLz48L3N2Zz4=" style="width: 12px; height: 12px; margin-right: 4px;" />      www.probodyline.com    </span>  </div>  <div style="font-weight: bold; margin-top: 3px;">This is a computer Generated Quotation, Page <span class="pageNumber"></span> of <span class="totalPages"></span></div></div>',
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '30mm',
          left: '10mm',
        },
      });

      console.log('PDF Generated (Sales Order). Size:', (pdf.length / 1024).toFixed(2), 'KB');
      return await this.mergeBankQuoteDocuments(Buffer.from(pdf), isBankQuote ? bankQuoteData?.documentUrls : undefined);
    } finally {
      await page.close();
    }
  }

  async generateSalesOrderHTMLPreview(
    soId: string,
    template: string = 'default',
    visibleClientFields?: string[],
    isBankQuote?: boolean,
    bankQuoteData?: any
  ): Promise<string> {
    const so = await this.prisma.salesOrder.findUnique({
      where: { id: soId },
      include: {
        quotation: {
          include: {
            customer: true,
            clients: true,
          },
        },
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            quotationItem: true,
            product: true,
          },
        },
      },
    });

    if (!so || !so.quotation) {
      throw new NotFoundException('Sales Order not found');
    }

    // Map SalesOrderItems to QuotationItems format
    const mappedItems = so.items.map((item, index) => ({
      ...item,
      srNo: index + 1,
      productImage: item.quotationItem?.productImage || item.product?.images?.[0] || item.product?.image || null,
      mrp: item.mrp || item.product?.price || null,
      // Pass through other product fields if needed by template (like price list)
      category: item.product?.productType || null,
      brand: null,
      warranty: null,
    })) as unknown as QuotationItem[];

    // Replace the quote number with the SO number
    const mockedQuotation = {
      ...so.quotation,
      quoteNumber: so.soNumber,
      items: mappedItems,
      // Map SO dates to Quotation dates for the template
      bookingDate: so.quotation.bookingDate,
      dispatchDate: so.quotation.dispatchDate,
    };

    return await this.generateQuotationHTML(mockedQuotation, template, true, visibleClientFields, isBankQuote, bankQuoteData);
  }

  async getSplitDataForPDF(soId: string, splitId: string) {
    if (splitId === 'pending') {
      const so = await this.prisma.salesOrder.findUnique({
        where: { id: soId },
        include: {
          quotation: {
            include: {
              customer: true,
              clients: true,
              items: { orderBy: { srNo: 'asc' } },
            },
          },
          splits: { include: { items: true } },
        },
      });

      if (!so || !so.quotation) {
        throw new NotFoundException('Sales Order or Quotation not found');
      }

      const pendingItems = so.quotation.items.map((qItem) => {
        const allocated = so.splits.reduce((acc, s) => {
          const sItem = s.items.find((si) => si.quotationItemId === qItem.id);
          return acc + (sItem?.quantity || 0);
        }, 0);
        return {
          id: 'pending-' + qItem.id,
          dispatchSplitId: 'pending',
          quotationItemId: qItem.id,
          quantity: Math.max(0, qItem.quantity - allocated),
        };
      }).filter(item => item.quantity > 0);

      return {
        id: 'pending',
        salesOrderId: so.id,
        splitNumber: 1,
        label: 'A/A',
        dispatchDate: so.createdAt || new Date(),
        items: pendingItems,
        salesOrder: so,
      };
    }

    const split = await this.prisma.dispatchSplit.findFirst({
      where: { id: splitId, salesOrderId: soId },
      include: {
        items: true,
        salesOrder: {
          include: {
            quotation: {
              include: {
                customer: true,
                clients: true,
                items: { orderBy: { srNo: 'asc' } },
              },
            },
          },
        },
      },
    });

    if (!split || !split.salesOrder || !split.salesOrder.quotation) {
      throw new NotFoundException('Split or Quotation not found');
    }

    return split;
  }

  async generateSOSplitPDF(
    soId: string,
    splitId: string,
    template: string = 'default',
    visibleClientFields?: string[],
    isBankQuote?: boolean,
    bankQuoteData?: any
  ): Promise<Buffer> {
    const split = await this.getSplitDataForPDF(soId, splitId);
    
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
      quoteNumber: `${split.salesOrder.soNumber} Split ${split.label || ''}`,
      items: filteredItems,
      subtotal: subtotal as any,
      gstAmount: gstAmount as any,
      grandTotal: grandTotal as any,
      dispatchDate: split.dispatchDate,
    };

    const html = await this.generateQuotationHTML(mockedQuotation, template, false, visibleClientFields, isBankQuote, bankQuoteData);

    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    const browser = await this.getBrowser();

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
      const pdf = await page.pdf({ 
        format: 'A4', 
        printBackground: true, 
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: '<div style="width: 100%; font-size: 8px; font-family: Helvetica, Arial, sans-serif; color: #111; text-align: center; padding-top: 5px;">  <div style="width: 96%; border-top: 2px solid #000; margin: 0 auto 5px auto;"></div>  <div style="margin-bottom: 5px; font-weight: bold; display: flex; justify-content: center; align-items: center; gap: 15px;">    <span style="display: flex; align-items: center;">      <img src="data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZmlsbD0iIzMzMyI+PHBhdGggZD0iTTcuNzUgMmg4LjVjMy4xNyAwIDUuNzUgMi41OCA1Ljc1IDUuNzV2OC41YzAgMy4xNy0yLjU4IDUuNzUtNS43NSA1Ljc1aC04LjVDNC41OCAyMiAyIDE5LjQyIDIgMTYuMjV2LTguNUMyIDQuNTggNC41OCAyIDcuNzUgMnptOC41IDEuNWgtOC41Yy0yLjM0IDAtNC4yNSAxLjkxLTQuMjUgNC4yNXY4LjVjMCAyLjM0IDEuOTEgNC4yNSA0LjI1IDQuMjVoOC41YzIuMzQgMCA0LjI1LTEuOTEgNC4yNS00LjI1di04LjVjMC0yLjM0LTEuOTEtNC4yNS00LjI1LTQuMjV6bS00LjI1IDRjMi40OCAwIDQuNSAyLjAyIDQuNSA0LjVzLTIuMDIgNC41LTQuNSA0LjUtNC41LTIuMDItNC41LTQuNSAyLjAyLTQuNSA0LjUtNC41em0wIDEuNWMtMS42NSAwLTMgMS4zNS0zIDNzMS4zNSAzIDMgMyAzLTEuMzUgMy0zLTEuMzUtMy0zLTN6bTUuMy0yLjhhMS4yIDEuMiAwIDExMCAyLjQgMS4yIDEuMiAwIDAxMC0yLjR6Ii8+PC9zdmc+" style="width: 12px; height: 12px; margin-right: 4px;" />      probodyline    </span>    <span style="display: flex; align-items: center;">      <img src="data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZmlsbD0iIzMzMyI+PHBhdGggZD0iTTIxLjU4IDcuMTljLS4yMy0uODYtLjkxLTEuNTQtMS43Ny0xLjc3QzE4LjI1IDUgMTIgNSAxMiA1cy02LjI1IDAtNy44MS40MmMtLjg2LjIzLTEuNTQuOTEtMS43NyAxLjc3QzIgOC43NSAyIDEyIDIgMTJzMCAzLjI1LjQyIDQuODFjLjIzLjg2LjkxIDEuNTQgMS43NyAxLjc3QzUuNzUgMTkgMTIgMTkgMTIgMTlzNi4yNSAwIDcuODEtLjQyYy44Ni0uMjMgMS41NC0uOTEgMS43Ny0xLjc3QzIyIDE1LjI1IDIyIDEyIDIyIDEyczAtMy4yNS0uNDItNC44MXpNMTAgMTVWOWw1LjIgMy01LjIgM3oiLz48L3N2Zz4=" style="width: 12px; height: 12px; margin-right: 4px;" />      probodyline.    </span>    <span style="display: flex; align-items: center;">      <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiBmaWxsPSIjMzMzIj48cGF0aCBkPSJNMzUyIDI1NmMwIDIyLjItMS4yIDQzLjYtMy4zIDY0SDE2My4zYy0yLjItMjAuNC0zLjMtNDEuOC0zLjMtNjRzMS4yLTQzLjYgMy4zLTY0aDE4NS40YzIuMiAyMC40IDMuMyA0MS44IDMuMyA2NHptMjguOC02NEg1MDMuOWM1LjMgMjAuNSA4LjEgNDEuOSA4LjEgNjRzLTIuOCA0My41LTguMSA2NEgzODAuOGMyLjEtMjAuNiAzLjItNDIgMy4yLTY0cy0xLjEtNDMuNC0zLjItNjR6bTExMi42LTMySDM3Ni43Yy0xMC02My45LTI5LjgtMTE3LjQtNTUuMy0xNTEuNmM3OC4zIDIwLjcgMTQyIDc3LjUgMTcxLjkgMTUxLjZ6bS0xNDkuMSAwSDE2Ny43YzYuMS0zNi40IDE1LjUtNjguNiAyNy05NC43YzEwLjUtMjMuNiAyMi4yLTQwLjcgMzMuNS01MS41QzIzOS40IDMuMiAyNDguNyAwIDI1NiAwczE2LjYgMy4yIDI3LjggMTMuOGMxMS4zIDEwLjggMjMgMjcuOSAzMy41IDUxLjVjMTEuNiAyNiAyMC45IDU4LjIgMjcgOTQuN3ptLTIwOSAwSDE4LjZDNDguNiA4NS45IDExMi4zIDI5LjEgMTkwLjYgOC40QzE2NS4xIDQyLjYgMTQ1LjMgOTYuMSAxMzUuMyAxNjB6TTguMSAxOTJIMTMxLjJjLTIuMSAyMC42LTMuMiA0Mi0zLjIgNjRzMS4xIDQzLjQgMy4yIDY0SDguMUMyLjggMjk5LjUgMCAyNzguMSAwIDI1NnMyLjgtNDMuNSA4LjEtNjR6TTE5NC43IDQ0Ni42Yy0xMS42LTI2LTIwLjktNTguMi0yNy05NC42SDM0NC4zYy02LjEgMzYuNC0xNS41IDY4LjYtMjcgOTQuNmMtMTAuNSAyMy42LTIyLjIgNDAuNy0zMy41IDUxLjVDMjcyLjYgNTA4LjggMjYzLjMgNTEyIDI1NiA1MTJzLTE2LjYtMy4yLTI3LjgtMTMuOGMtMTEuMy0xMC44LTIzLTI3LjktMzMuNS01MS41ek0xMzUuMyAzNTJjMTAgNjMuOSAyOS44IDExNy40IDU1LjMgMTUxLjZDMTEyLjMgNDgyLjkgNDguNiA0MjYuMSAxOC42IDM1MkgxMzUuM3ptMzU4LjEgMGMtMzAgNzQuMS05My42IDEzMC45LTE3MS45IDE1MS42YzI1LjUtMzQuMiA0NS4yLTg3LjcgNTUuMy0xNTEuNkg0OTMuNHoiLz48L3N2Zz4=" style="width: 12px; height: 12px; margin-right: 4px;" />      www.probodyline.com    </span>  </div>  <div style="font-weight: bold; margin-top: 3px;">This is a computer Generated Quotation, Page <span class="pageNumber"></span> of <span class="totalPages"></span></div></div>',
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
    isBankQuote?: boolean,
    bankQuoteData?: any
  ): Promise<string> {
    const split = await this.getSplitDataForPDF(soId, splitId);

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
      quoteNumber: `${split.salesOrder.soNumber} Split ${split.label || ''}`,
      items: filteredItems,
      subtotal: subtotal as any,
      gstAmount: gstAmount as any,
      grandTotal: grandTotal as any,
      dispatchDate: split.dispatchDate,
    };

    return await this.generateQuotationHTML(mockedQuotation, template, true, visibleClientFields, isBankQuote, bankQuoteData);
  }


  async generateQuotationHTMLPreview(
    quotationId: string,
    template: string = 'default',
    visibleClientFields?: string[],
    isBankQuote?: boolean,
    bankQuoteData?: any
  ): Promise<string> {
    // Fetch full quotation with all details
    const fullQuotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        customer: true,
        clients: true,
        items: {
          orderBy: { srNo: 'asc' },
        },
      },
    });

    if (!fullQuotation) {
      throw new NotFoundException('Quotation not found');
    }

    return await this.generateQuotationHTML(fullQuotation, template, true, visibleClientFields, isBankQuote, bankQuoteData);
  }

  private async generateQuotationHTML(
    quotation: Quotation & {
      customer?: Customer | null;
      clients?: Customer[];
      items: QuotationItem[];
    },
    templateType: string,
    isPreview = false,
    visibleClientFields?: string[],
    isBankQuote?: boolean,
    bankQuoteData?: any
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
        titleText = isBankQuote ? 'GYM EQUIPMENT QUOTATION' : 'PROFORMA INVOICE';
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

    const hasMultipleClients = Boolean(quotation.clients && quotation.clients.length > 1);

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
      quoteDate: this.formatDateAbbrev(quotation.createdAt),
      currentDate: `Date - ${this.formatDateAbbrev(new Date())}`,
      deliveryDate: quotation.deliveryDate
        ? this.formatDateAbbrev(quotation.deliveryDate)
        : undefined,
      bookingDate: quotation.bookingDate
        ? this.formatDateAbbrev(quotation.bookingDate)
        : undefined,
      dispatchDate: quotation.dispatchDate
        ? this.formatDateAbbrev(quotation.dispatchDate)
        : undefined,
      installationDate: quotation.installationDate
        ? this.formatDateAbbrev(quotation.installationDate)
        : undefined,
      inaugurationDate: quotation.inaugurationDate
        ? this.formatDateAbbrev(quotation.inaugurationDate)
        : undefined,
      templateType: templateType,
      isDefaultTemplate: templateType === 'default',
      titleText: titleText,

      // Multiple Clients Logic
      hasMultipleClients: hasMultipleClients,
      isSingleClient: !hasMultipleClients,
      client1Name: quotation.clients && quotation.clients.length > 0 ? (quotation.clients[0].name || undefined) : (customer?.name || quotation.clientName || undefined),
      client1Address: quotation.clients && quotation.clients.length > 0 ? (quotation.clients[0].address || undefined) : (customer?.address || quotation.clientAddress || undefined),
      client1AddressLine2: quotation.clients && quotation.clients.length > 0 ? (quotation.clients[0].addressLine2 || undefined) : (customer?.addressLine2 || quotation.clientAddressLine2 || undefined),
      client1City: quotation.clients && quotation.clients.length > 0 ? (quotation.clients[0].city || undefined) : (customer?.city || quotation.clientCity || undefined),
      client1GST: quotation.clients && quotation.clients.length > 0 ? (quotation.clients[0].gst || undefined) : (customer?.gst || quotation.clientGST || undefined),
      client1PanCard: quotation.clients && quotation.clients.length > 0 ? (quotation.clients[0].panCard || undefined) : (customer?.panCard || quotation.clientPanCard || undefined),
      client1AadharCard: quotation.clients && quotation.clients.length > 0 ? (quotation.clients[0].aadharCard || undefined) : (customer?.aadharCard || quotation.clientAadharCard || undefined),

      client2Name: quotation.clients && quotation.clients.length > 1 ? (quotation.clients[1].name || undefined) : undefined,
      client2Address: quotation.clients && quotation.clients.length > 1 ? (quotation.clients[1].address || undefined) : undefined,
      client2AddressLine2: quotation.clients && quotation.clients.length > 1 ? (quotation.clients[1].addressLine2 || undefined) : undefined,
      client2City: quotation.clients && quotation.clients.length > 1 ? (quotation.clients[1].city || undefined) : undefined,
      client2GST: quotation.clients && quotation.clients.length > 1 ? (quotation.clients[1].gst || undefined) : undefined,
      client2PanCard: quotation.clients && quotation.clients.length > 1 ? (quotation.clients[1].panCard || undefined) : undefined,
      client2AadharCard: quotation.clients && quotation.clients.length > 1 ? (quotation.clients[1].aadharCard || undefined) : undefined,

      // Client Info (Default)
            clientName: await (async () => {
        if (isBankQuote && bankQuoteData?.clientAadharName) return bankQuoteData.clientAadharName;
        let code = quotation.clients && quotation.clients.length > 0 ? (quotation.clients[0].name || undefined) : (customer?.name || quotation.clientName || undefined);
        if (code) {
          try {
            const clientRec = await this.prisma.client.findFirst({ where: { clientCode: code } });
            if (clientRec && clientRec.clientName) return clientRec.clientName;
          } catch (e) {}
        }
        return code;
      })(),
      clientAddress: quotation.clients && quotation.clients.length > 0 ? (quotation.clients[0].address || undefined) : (customer?.address || quotation.clientAddress || undefined),
      clientAddressLine2: quotation.clients && quotation.clients.length > 0 ? (quotation.clients[0].addressLine2 || undefined) : (customer?.addressLine2 || quotation.clientAddressLine2 || undefined),
      clientCity: quotation.clients && quotation.clients.length > 0 ? (quotation.clients[0].city || undefined) : (customer?.city || quotation.clientCity || undefined),
      gymName: quotation.clients && quotation.clients.length > 0 ? (quotation.clients[0].gymName || undefined) : (customer?.gymName || quotation.gymName || undefined),
      gymArea: quotation.clients && quotation.clients.length > 0 ? (quotation.clients[0].area || undefined) : (customer?.area || quotation.gymArea || undefined),
      clientGST: quotation.clients && quotation.clients.length > 0 ? (quotation.clients[0].gst || undefined) : (customer?.gst || quotation.clientGST || undefined),
      clientPanCard: quotation.clients && quotation.clients.length > 0 ? (quotation.clients[0].panCard || undefined) : (customer?.panCard || quotation.clientPanCard || undefined),
      clientAadharCard: quotation.clients && quotation.clients.length > 0 ? (quotation.clients[0].aadharCard || undefined) : (customer?.aadharCard || quotation.clientAadharCard || undefined),
      leadName: quotation.leadName || undefined,
      status: quotation.status || 'DRAFT',
      notes: quotation.notes || undefined,
      
      // Client Info visibility flags
      showClientNameField: true,
      showAddressLine1Field: showField('addressLine1'),
      showAddressLine2Field: showField('addressLine2'),
      showCityField: showField('city'),
      showGstNoField: showField('gstNo'),
      showBookingDateField: showField('bookingDate'),
      showDispatchDateField: showField('dispatchDate'),
      showPanCardField: showField('panCard'),
      showAadharCardField: showField('aadharCard'),
      showGymAreaField: showField('gymArea'),
      showGymNameField: true,

      // Bank Quote visibility flags
      showBqFirmNameField: isBankQuote ? showField('bqFirmName') : false,
      showBqFirmGstNoField: isBankQuote ? showField('bqFirmGstNo') : false,
      showBqBranchAddressField: isBankQuote ? showField('bqBranchAddress') : false,
      showBqFirmPanCardField: isBankQuote ? showField('bqFirmPanCard') : false,
      showBqContactField: isBankQuote ? showField('bqContact') : false,
      showBqPartnersField: isBankQuote ? showField('bqPartners') : false,

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
      isBankQuote: isBankQuote,
      bankQuoteFirmName: bankQuoteData?.firmName || (quotation as any).gym?.legalName || (quotation as any).gym?.tradeName || (quotation as any).gym?.gymName,
      bankQuoteFirmGstNo: bankQuoteData?.firmGstNo,
      bankQuoteBranchAddress: bankQuoteData?.branchAddress,
      bankQuoteFirmPanCard: bankQuoteData?.firmPanCardNumber,
      bankQuoteContact: bankQuoteData?.contact || (quotation.clients && quotation.clients.length > 0 ? quotation.clients[0].phone : undefined) || customer?.phone,
      bankQuotePartners: bankQuoteData?.partners || [],
      bankQuoteClientAadharName: bankQuoteData?.clientAadharName,
      bankQuoteClientAadharNumber: bankQuoteData?.clientAadharNumber,
      bankQuoteClientPanCardNumber: bankQuoteData?.clientPanCardNumber,
      bankQuoteDocumentUrls: bankQuoteData?.documentUrls ? Array.from(new Set(bankQuoteData.documentUrls)) : undefined,
      
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
      showTermsAndConditions: quotation.visibleColumns ? (quotation.visibleColumns as any).termsAndConditions !== false : true,
      warrantyInfo: quotation.warrantyInfo || undefined,
      computerGeneratedText: `This is a computer Generated Quotation, Page 1 of 1 for #${quotation.quoteNumber || quotation.id}, ${quotation.status === 'BOOKED' ? 'Booked' : 'Booking Pending'}`,

      // CSS content (will be injected)
      CSS_CONTENT: '',
    };

    // Load the base HTML template
    data.isNotBankQuote = !isBankQuote;

    const templatePath = path.join(
      __dirname,
      'templates',
      'quotation-template.html'
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
  
  /**
   * Format date as DD/Mon/YYYY (e.g. 06/Oct/2026)
   */
  private formatDateAbbrev(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const day = String(d.getDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  private formatDateFriendly(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  private async mergeBankQuoteDocuments(basePdfBuffer: Buffer, documentUrls?: string[]): Promise<Buffer> {
    if (!documentUrls || documentUrls.length === 0) return basePdfBuffer;
    try {
      const mergedPdf = await PDFDocument.load(basePdfBuffer);
      for (const url of documentUrls) {
        try {
          const response = await axios.get(url, { responseType: 'arraybuffer' });
          const contentType = response.headers['content-type'] as string;
          const buffer = response.data;

          if (contentType === 'application/pdf' || url.toLowerCase().endsWith('.pdf')) {
            const extPdf = await PDFDocument.load(buffer);
            const copiedPages = await mergedPdf.copyPages(extPdf, extPdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
          } else if (contentType?.startsWith('image/') || url.match(/\.(jpeg|jpg|png|gif)$/i)) {
            // Images are now rendered natively on the final page of the quotation via HTML template
            // We no longer append them as separate new pages here.
          }
        } catch (e: any) {
          console.error('Failed to append document:', url, e.message);
        }
      }
      const finalPdfBytes = await mergedPdf.save();
      return Buffer.from(finalPdfBytes);
    } catch (e) {
      console.error('Failed to merge documents:', e);
      return basePdfBuffer;
    }
  }

  async createShortLink(url: string) {
    return this.prisma.sharedLink.create({
      data: { url }
    });
  }

  async getShortLink(id: string) {
    return this.prisma.sharedLink.findUnique({
      where: { id }
    });
  }
}
