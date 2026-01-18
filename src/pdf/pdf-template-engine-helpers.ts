// PDF Template Engine Helpers
// Column definitions and helper functions for building table data

import { QuotationColumnId, PDFTemplateData } from './types';
import { QuotationItem } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// Canonical column order - defines the standard left-to-right order for columns in PDFs
export const CANONICAL_COLUMN_ORDER: QuotationColumnId[] = [
  'srNo',
  'productImage',
  'productName',
  'modelNumber',
  'priority',
  'productType',
  'seriesName',
  'packagingDescription',
  'keyword',
  'todaysStock',
  'stockPlus360Days',
  'cousinMachine',
  'orderTogether',
  'swapMachine',
  'category',
  'brand',
  'warranty',
  'notes',
  'rate',
  'quantity',
  'totalAmount',
];

export const COLUMN_LABELS: Record<QuotationColumnId, string> = {
  srNo: 'S.No',
  productImage: 'Picture',
  productName: 'Items / Product Name',
  modelNumber: 'Model No',
  priority: 'Priority',
  productType: 'Product Type',
  seriesName: 'Series',
  packagingDescription: 'Packaging',
  keyword: 'Keywords',
  todaysStock: 'Stock',
  stockPlus360Days: 'Stock + 360',
  cousinMachine: 'Cousin Machine',
  orderTogether: 'Order Together',
  swapMachine: 'Swap Machine',
  category: 'Category',
  brand: 'Brand',
  warranty: 'Warranty',
  notes: 'Notes',
  rate: 'Rate',
  quantity: 'Quantity',
  totalAmount: 'Amount',
};

const HEADER_ABBREVIATIONS: Record<string, string> = {
  'S.No': 'S.NO',
  Picture: 'PIC',
  'Items / Product Name': 'PRODUCT',
  'Model No': 'MODEL',
  Priority: 'PRI',
  'Product Type': 'TYPE',
  Series: 'SER',
  Packaging: 'PKG',
  Keywords: 'KW',
  Stock: 'STK',
  'Stock + 360': 'STK+360',
  'Cousin Machine': 'COUSIN',
  'Order Together': 'ORDER',
  'Swap Machine': 'SWAP',
  Category: 'CAT',
  Brand: 'BRAND',
  Warranty: 'WAR',
  Notes: 'NOTES',
  Rate: 'RATE',
  Quantity: 'QTY',
  Amount: 'AMT',
};

export function getColumnClass(colId: QuotationColumnId): string {
  if (colId === 'srNo' || colId === 'priority') return 'col-center';
  if (
    colId === 'rate' ||
    colId === 'quantity' ||
    colId === 'totalAmount' ||
    colId === 'todaysStock' ||
    colId === 'stockPlus360Days'
  ) {
    return 'col-right';
  }
  return 'col-left';
}

export function getCellValue(
  item: QuotationItem,
  colId: QuotationColumnId,
): string {
  switch (colId) {
    case 'srNo':
      return String(item.srNo);
    case 'productName':
      return item.productName || '';
    case 'productImage':
      return item.productImage || '';
    case 'modelNumber':
      return item.modelNumber || '';
    case 'priority':
      return item.priority ? String(item.priority) : '';
    case 'productType':
      return item.productType || '';
    case 'seriesName':
      return item.seriesName || '';
    case 'packagingDescription':
      return Array.isArray(item.packagingDescription)
        ? item.packagingDescription.join(', ')
        : '';
    case 'keyword':
      return Array.isArray(item.keyword) ? item.keyword.join(', ') : '';
    case 'todaysStock':
      return item.todaysStock !== undefined ? String(item.todaysStock) : '';
    case 'stockPlus360Days':
      return item.stockPlus360Days !== undefined
        ? String(item.stockPlus360Days)
        : '';
    case 'cousinMachine':
      return item.cousinMachine || '';
    case 'orderTogether':
      return item.orderTogether || '';
    case 'swapMachine':
      return item.swapMachine || '';
    case 'category':
      return item.category || '';
    case 'brand':
      return item.brand || '';
    case 'warranty':
      return item.warranty || '';
    case 'notes':
      return item.notes || '';
    case 'rate':
      const rate =
        typeof item.rate === 'object' &&
        item.rate !== null &&
        'toNumber' in item.rate
          ? item.rate.toNumber()
          : Number(item.rate);
      return `₹${rate.toLocaleString('en-IN')}`;
    case 'quantity':
      return String(item.quantity);
    case 'totalAmount':
      const total =
        typeof item.totalAmount === 'object' &&
        item.totalAmount !== null &&
        'toNumber' in item.totalAmount
          ? item.totalAmount.toNumber()
          : Number(item.totalAmount);
      return `₹${total.toLocaleString('en-IN')}`;
    default:
      return '';
  }
}

export async function imageToDataURL(imagePath: string): Promise<string> {
  try {
    // Handle absolute and relative paths
    let fullPath = imagePath;

    // Handle paths starting with /app/public (container absolute) or /public (repo root)
    if (imagePath.startsWith('/app/public/')) {
      fullPath = imagePath;
    } else if (imagePath.startsWith('/public/')) {
      fullPath = path.join(process.cwd(), imagePath.replace(/^\//, ''));
    } else if (!path.isAbsolute(imagePath)) {
      // Try relative to uploads directory
      fullPath = path.join(process.cwd(), 'uploads', imagePath);
    }

    if (!fs.existsSync(fullPath)) {
      console.warn(`Image not found: ${fullPath}`);
      return '';
    }

    const imageBuffer = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const mimeType = mimeTypes[ext] || 'image/png';
    const base64 = imageBuffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(`Error converting image to data URL: ${imagePath}`, error);
    return '';
  }
}

export async function buildTableData(
  items: QuotationItem[],
  visibleColumns: QuotationColumnId[],
  columnCount?: number,
): Promise<{ headers: any[]; rows: any[] }> {
  const useAbbreviations = columnCount !== undefined && columnCount >= 10;

  const getHeaderLabel = (colId: QuotationColumnId): string => {
    const fullLabel = COLUMN_LABELS[colId] || colId;
    return useAbbreviations && HEADER_ABBREVIATIONS[fullLabel]
      ? HEADER_ABBREVIATIONS[fullLabel]
      : fullLabel;
  };

  if (!items || items.length === 0) {
    return {
      headers: visibleColumns.map((colId) => ({
        label: getHeaderLabel(colId),
        className: getColumnClass(colId),
      })),
      rows: [],
    };
  }

  const headers = visibleColumns.map((colId) => ({
    label: getHeaderLabel(colId),
    className: getColumnClass(colId),
  }));

  // Process rows and convert images to base64
  const rows = await Promise.all(
    items.map(async (item) => {
      try {
        const cells = await Promise.all(
          visibleColumns.map(async (colId) => {
            let value = getCellValue(item, colId);
            const isImage = colId === 'productImage';

            // Convert product images to base64
            if (isImage && value) {
              try {
                if (value.startsWith('data:')) {
                  // Already base64
                } else {
                  const base64Image = await imageToDataURL(value);
                  if (base64Image && base64Image.length > 0) {
                    value = base64Image;
                  } else {
                    value = '';
                  }
                }
              } catch (error) {
                console.warn(
                  `Failed to convert product image to base64: ${value}`,
                  error,
                );
                value = '';
              }
            } else if (isImage && !value) {
              value = '';
            }

            return {
              value: value || '',
              className: getColumnClass(colId),
              isImage,
            };
          }),
        );

        return { cells };
      } catch (error) {
        console.error(`Error processing item:`, error);
        return {
          cells: visibleColumns.map((colId) => ({
            value: '',
            className: getColumnClass(colId),
            isImage: colId === 'productImage',
          })),
        };
      }
    }),
  );

  return { headers, rows };
}
