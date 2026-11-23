/**
 * Comparison key for model numbers: case-insensitive, ignoring everything
 * that isn't a letter or digit, so "BL05_TT", "BL_05_TT", "bl-05 tt" and
 * "BL.05.TT" all map to "bl05tt". Empty for missing/blank input.
 */
export function modelKey(modelNumber: string | null | undefined): string {
  return (modelNumber ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
