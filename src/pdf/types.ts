// PDF Template Types

export type QuotationColumnId =
  | 'srNo'
  | 'productImage'
  | 'productName'
  | 'modelNumber'
  | 'priority'
  | 'productType'
  | 'seriesName'
  | 'packagingDescription'
  | 'keyword'
  | 'todaysStock'
  | 'stockPlus360Days'
  | 'cousinMachine'
  | 'orderTogether'
  | 'swapMachine'
  | 'category'
  | 'brand'
  | 'warranty'
  | 'notes'
  | 'rate'
  | 'quantity'
  | 'totalAmount';

export interface QuotationColumnVisibility {
  [key: string]: boolean;
}

export interface PDFTemplateData {
  // Company Info
  companyName: string;
  companyAddress?: string;
  companyGST?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyContactPerson?: string;
  companyLogo?: string;

  // Quotation Info
  quoteNumber: string;
  quoteDate: string;
  deliveryDate?: string;
  bookingDate?: string;
  dispatchDate?: string;
  installationDate?: string;
  inaugurationDate?: string;
  templateType: string;
  isDefaultTemplate: boolean;
  titleText: string;

  // Client Info
  clientName?: string;
  clientAddress?: string;
  clientCity?: string;
  gymName?: string;
  gymArea?: string;
  clientGST?: string;
  leadName?: string;

  // Totals
  subtotal: string;
  gstRate: number;
  gstAmount: string;
  grandTotal: string;
  amountInWords: string;

  // Table Data
  tableHeaders: Array<{ label: string; className: string }>;
  products: Array<{ cells: Array<{ value: string; className: string; isImage: boolean }> }>;
  columnCount: number;
  useLandscape: boolean;

  // Conditional Flags
  showHeader: boolean;
  showClientInfo: boolean;
  showGymName: boolean;
  showDeliveryDate: boolean;
  showDisclaimer: boolean;
  showTotals: boolean;
  showBankDetails: boolean;
  showGSTBreakdown?: boolean;
  showSubtotalLabel?: boolean;
  bankDetails?: string;
  termsAndConditions?: string;
  warrantyInfo?: string;

  // CSS content
  CSS_CONTENT: string;
}

