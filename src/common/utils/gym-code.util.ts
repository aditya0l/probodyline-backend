// Gym code generation utility (backend version)

export interface GymCodeData {
  installationDate: string; // YYYY-MM-DD
  stateCode: string;
  city: string;
  gymName: string;
  branchCode: number;
  branchTitle: string;
  salesInitial: string;
}

/**
 * Generate canonical gym code
 * Format: YYYY-MM-DD/STATE/CITY/GYM_NAME/BRANCH_CODE/BRANCH_TITLE/SALES_INITIAL
 *
 * Rules:
 * - "/" is delimiter
 * - No spaces (use underscore if needed)
 * - Branch Code range: 1.0 → 99.0
 * - Sales Initial is mandatory
 */
export function generateGymCode(data: GymCodeData): string {
  const {
    installationDate,
    stateCode,
    city,
    gymName,
    branchCode,
    branchTitle,
    salesInitial,
  } = data;

  // Validate branch code range
  if (branchCode < 1.0 || branchCode > 99.0) {
    throw new Error('Branch code must be between 1.0 and 99.0');
  }

  // Validate sales initial
  if (!salesInitial || salesInitial.trim().length === 0) {
    throw new Error('Sales initial is required');
  }

  // Normalize components
  const normalizedDate = installationDate.split('T')[0]; // YYYY-MM-DD
  const normalizedState = stateCode.toUpperCase().trim();
  const normalizedCity = city.trim().replace(/\s+/g, '_');
  const normalizedGymName = gymName.trim().replace(/\s+/g, '_');
  const normalizedBranchCode = branchCode.toString();
  const normalizedBranchTitle = branchTitle.trim().replace(/\s+/g, '_');
  const normalizedSalesInitial = salesInitial.toUpperCase().trim();

  // Build gym code
  const parts = [
    normalizedDate,
    normalizedState,
    normalizedCity,
    normalizedGymName,
    normalizedBranchCode,
    normalizedBranchTitle,
    normalizedSalesInitial,
  ];

  return parts.join('/');
}

/**
 * Parse gym code into components
 */
export function parseGymCode(gymCode: string): GymCodeData | null {
  try {
    const parts = gymCode.split('/');
    if (parts.length !== 7) {
      return null;
    }

    return {
      installationDate: parts[0],
      stateCode: parts[1],
      city: parts[2].replace(/_/g, ' '),
      gymName: parts[3].replace(/_/g, ' '),
      branchCode: parseFloat(parts[4]),
      branchTitle: parts[5].replace(/_/g, ' '),
      salesInitial: parts[6],
    };
  } catch {
    return null;
  }
}
