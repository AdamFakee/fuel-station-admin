/**
 * Unaccent helper mirroring Postgres wms_unaccent() according to search-api skill.
 */

export function unaccent(s: string): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function unaccentIncludes(haystack: string | null | undefined, needle: string | null | undefined): boolean {
  if (!haystack || !needle) return false;
  return unaccent(haystack).includes(unaccent(needle));
}
