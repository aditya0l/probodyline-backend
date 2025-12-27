// Client code generation utility (backend version)

export interface ClientCodeData {
  tokenDate: string; // YYYY-MM-DD (business token/contract date)
  stateCode: string;
  city: string;
  clientName: string;
  salesInitial: string;
}

/**
 * Generate canonical client code
 * Format: YYYY-MM-DD/STATE/CITY/CLIENT_NAME/SALES_INITIAL
 * 
 * Rules:
 * - "/" is delimiter
 * - No spaces (use underscore if needed)
 * - Token Date is immutable (business contract date)
 * - Sales Initial is mandatory
 */
export function generateClientCode(data: ClientCodeData): string {
  const {
    tokenDate,
    stateCode,
    city,
    clientName,
    salesInitial,
  } = data;

  // Validate sales initial
  if (!salesInitial || salesInitial.trim().length === 0) {
    throw new Error('Sales initial is required');
  }

  // Normalize components
  const normalizedDate = tokenDate.split('T')[0]; // YYYY-MM-DD
  const normalizedState = stateCode.toUpperCase().trim();
  const normalizedCity = city.trim().replace(/\s+/g, '_');
  const normalizedClientName = clientName.trim().replace(/\s+/g, '_');
  const normalizedSalesInitial = salesInitial.toUpperCase().trim();

  // Build client code
  const parts = [
    normalizedDate,
    normalizedState,
    normalizedCity,
    normalizedClientName,
    normalizedSalesInitial,
  ];

  return parts.join('/');
}

/**
 * Parse client code into components
 */
export function parseClientCode(clientCode: string): ClientCodeData | null {
  try {
    const parts = clientCode.split('/');
    if (parts.length !== 5) {
      return null;
    }

    return {
      tokenDate: parts[0],
      stateCode: parts[1],
      city: parts[2].replace(/_/g, ' '),
      clientName: parts[3].replace(/_/g, ' '),
      salesInitial: parts[4],
    };
  } catch {
    return null;
  }
}


