// Client code generation utility (backend version)

export interface ClientCodeData {
  tokenDate?: string; // YYYY-MM-DD
  stateCode?: string;
  city?: string;
  clientName?: string;
  salesInitial: string; // Still required, provided by system/user context
}

/**
 * Generate canonical client code
 * Format: YYYY-MM-DD/STATE/CITY/CLIENT_NAME/SALES_INITIAL
 * Uses 'NA' for missing components.
 */
export function generateClientCode(data: ClientCodeData): string {
  const {
    tokenDate,
    stateCode,
    city,
    clientName,
    salesInitial,
  } = data;

  // Validate sales initial (still required as it comes from system)
  if (!salesInitial || salesInitial.trim().length === 0) {
    throw new Error('Sales initial is required');
  }

  // Normalize components or use defaults
  const normalizedDate = tokenDate ? tokenDate.split('T')[0] : 'NA';
  const normalizedState = stateCode ? stateCode.toUpperCase().trim() : 'NA';
  const normalizedCity = city ? city.trim().replace(/\s+/g, '_') : 'NA';
  const normalizedClientName = clientName ? clientName.trim().replace(/\s+/g, '_') : 'NA';
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


