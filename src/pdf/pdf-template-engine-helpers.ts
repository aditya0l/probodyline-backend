// PDF Template Engine Helpers
// Column definitions and helper functions for building table data
import sharp from 'sharp';

import { QuotationColumnId, PDFTemplateData } from './types';
import { QuotationItem } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// Canonical column order - defines the standard left-to-right order for columns in PDFs
export const CANONICAL_COLUMN_ORDER: QuotationColumnId[] = [
  'srNo',
  'productName',
  'productImage',
  'quantity',
  'mrp',
  'rate',
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
  mrp: 'MRP',
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
  MRP: 'MRP',
  Rate: 'RATE',
  Quantity: 'QTY',
  Amount: 'AMT',
};

export function getColumnClass(colId: QuotationColumnId): string {
  let cls = `col-${colId}`;
  if (colId === 'srNo' || colId === 'priority') {
    cls += ' col-center';
  } else if (
    colId === 'rate' ||
    colId === 'mrp' ||
    colId === 'quantity' ||
    colId === 'totalAmount' ||
    colId === 'todaysStock' ||
    colId === 'stockPlus360Days'
  ) {
    cls += ' col-right';
  } else {
    cls += ' col-left';
  }
  return cls;
}

export function getCellValue(
  item: QuotationItem,
  colId: QuotationColumnId,
): string {
  switch (colId) {
    case 'srNo':
      return String(item.srNo);
    case 'productName':
      return item.productName ? `<span class="product-name-txt">${item.productName}</span>` : '';
    case 'productImage':
      return item.productImage || '';
    case 'modelNumber':
      return item.modelNumber ? `<span class="model-no-txt">${item.modelNumber}</span>` : '';
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
    case 'mrp':
      return '—';
    case 'rate': {
      const rate =
        typeof item.rate === 'object' &&
        item.rate !== null &&
        'toNumber' in item.rate
          ? item.rate.toNumber()
          : Number(item.rate);
      return `₹${rate.toLocaleString('en-IN')}`;
    }
    case 'quantity':
      return String(item.quantity);
    case 'totalAmount': {
      const total =
        typeof item.totalAmount === 'object' &&
        item.totalAmount !== null &&
        'toNumber' in item.totalAmount
          ? item.totalAmount.toNumber()
          : Number(item.totalAmount);
      return `₹${total.toLocaleString('en-IN')}`;
    }
    default:
      return '';
  }
}

export async function imageToDataURL(imagePath: string): Promise<string> {
  try {
    let cleanPath = imagePath;

    // 1. If it's a web URL, try to extract the local path segment after "files/" or "uploads/"
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      const filesIdx = imagePath.indexOf('/files/');
      if (filesIdx !== -1) {
        cleanPath = imagePath.substring(filesIdx + 7); // e.g. "uploads/..."
      } else {
        const uploadsIdx = imagePath.indexOf('/uploads/');
        if (uploadsIdx !== -1) {
          cleanPath = imagePath.substring(uploadsIdx + 1); // e.g. "uploads/..."
        }
      }
    }

    // 2. Remove leading slash if any
    cleanPath = cleanPath.replace(/^\//, '');

    // 3. Construct the absolute file system path
    let fullPath = '';
    if (cleanPath.startsWith('app/public/')) {
      fullPath = '/' + cleanPath;
    } else if (cleanPath.startsWith('public/')) {
      fullPath = path.join(process.cwd(), cleanPath);
    } else if (cleanPath.startsWith('uploads/')) {
      // If it already starts with uploads/, resolve it directly from process.cwd()
      fullPath = path.join(process.cwd(), cleanPath);
    } else {
      // Otherwise, assume it's relative to the uploads/ directory
      fullPath = path.join(process.cwd(), 'uploads', cleanPath);
    }

    if (!fs.existsSync(fullPath)) {
      console.warn(`Image not found: ${fullPath} (original: ${imagePath})`);
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
    
    // Compress image using Sharp
    const compressedBuffer = await sharp(imageBuffer)
      .resize(150, 150, { fit: 'inside' })
      .webp({ quality: 60 })
      .toBuffer();

    const base64 = compressedBuffer.toString('base64');
    return `data:image/webp;base64,${base64}`;
  } catch (error) {
    console.error(`Error converting image to data URL: ${imagePath}`, error);
    return '';
  }
}

export async function buildTableData(
  items: QuotationItem[],
  visibleColumns: QuotationColumnId[],
  columnCount?: number,
  convertToBase64 = true,
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

  // Process rows and convert images to base64 or absolute URLs
  const rows = await Promise.all(
    items.map(async (item) => {
      try {
        const cells = await Promise.all(
          visibleColumns.map(async (colId) => {
            let value = getCellValue(item, colId);
            const isImage = colId === 'productImage';

            // Convert product images
            if (isImage && value) {
              try {
                if (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://')) {
                  // Already base64 or absolute web URL
                } else if (convertToBase64) {
                  const base64Image = await imageToDataURL(value);
                  if (base64Image && base64Image.length > 0) {
                    value = base64Image;
                  } else {
                    value = '';
                  }
                } else {
                  // Simply use absolute web URL for the HTML Preview to save 99.9% payload size
                  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 
                    (process.env.NODE_ENV === 'development' 
                      ? `http://localhost:${process.env.PORT || '3001'}/api` 
                      : 'https://api.probodyline.co.in/api');
                  
                  const cleanPath = value.replace(/^\//, '');
                  value = `${apiBaseUrl}/files/${cleanPath}`;
                }
              } catch (error) {
                console.warn(
                  `Failed to process product image: ${value}`,
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
