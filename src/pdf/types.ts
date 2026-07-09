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
  | 'mrp'
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
  currentDate?: string;
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
  clientAddressLine2?: string;
  clientCity?: string;
  gymName?: string;
  gymArea?: string;
  clientGST?: string;
  clientPanCard?: string;
  clientAadharCard?: string;
  leadName?: string;
  
  hasMultipleClients?: boolean;
  isSingleClient?: boolean;
  client1Name?: string;
  client1Address?: string;
  client1AddressLine2?: string;
  client1City?: string;
  client1GST?: string;
  client1PanCard?: string;
  client1AadharCard?: string;

  client2Name?: string;
  client2Address?: string;
  client2AddressLine2?: string;
  client2City?: string;
  client2GST?: string;
  client2PanCard?: string;
  client2AadharCard?: string;
  legalName?: string;
  tradeName?: string;
  nameAsPanCard?: string;
  nameAsAadharCard?: string;
  
  // Client Info visibility flags
  showClientNameField?: boolean;
  showAddressLine1Field?: boolean;
  showAddressLine2Field?: boolean;
  showCityField?: boolean;
  showGstNoField?: boolean;
  showBookingDateField?: boolean;
  showDispatchDateField?: boolean;
  showPanCardField?: boolean;
  showAadharCardField?: boolean;
  showGymAreaField?: boolean;
  showGymNameField?: boolean;

  // Bank Quote visibility flags
  showBqFirmNameField?: boolean;
  showBqFirmGstNoField?: boolean;
  showBqBranchAddressField?: boolean;
  showBqFirmPanCardField?: boolean;
  showBqContactField?: boolean;
  showBqPartnersField?: boolean;

  // Totals
  subtotal: string;
  gstRate: number;
  gstAmount: string;
  grandTotal: string;
  amountInWords: string;

  // Table Data
  tableHeaders: Array<{ label: string; className: string }>;
  products: Array<{
    cells: Array<{ value: string; className: string; isImage: boolean }>;
  }>;
  columnCount: number;
  colSpanMinusOne?: number;
  colSpanMinusTwo?: number;
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
  isWholesale?: boolean;
  isRetail?: boolean;
  isPriceList?: boolean;
  isLoadingSlip?: boolean;
  isBankQuote?: boolean;
  isNotBankQuote?: boolean;
  bankQuoteFirmName?: string;
  bankQuoteFirmGstNo?: string;
  bankQuoteBranchAddress?: string;
  bankQuoteFirmPanCard?: string;
  bankQuoteContact?: string;
  bankQuotePartners?: Array<{
    nameAsOnAadhar: string;
    aadharNumber: string;
    panCardNumber: string;
  }>;
  bankQuoteDocumentUrls?: string[];
  status?: string;
  notes?: string;
  computerGeneratedText?: string;

  // CSS content
  CSS_CONTENT: string;
}
