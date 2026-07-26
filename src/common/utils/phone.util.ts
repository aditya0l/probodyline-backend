export function normalizePhone(rawPhone: string): string {
  if (!rawPhone) return '';
  return rawPhone.replace(/[\s\-+]/g, '');
}
