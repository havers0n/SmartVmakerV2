/**
 * Thin locale/formatting helpers (i18n-ready, no framework).
 *
 * Goal: avoid hardcoded locale assumptions (e.g., 'en-US') and keep formatting consistent.
 */

export function getLocale(): string | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return navigator.language || undefined;
}

export function formatNumber(value: number, locale: string | undefined = getLocale()): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatDate(
  value: Date | string | number,
  locale: string | undefined = getLocale(),
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale, options).format(date);
}


