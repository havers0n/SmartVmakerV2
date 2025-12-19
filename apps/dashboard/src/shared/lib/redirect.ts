/**
 * Sanitize a post-auth redirect path to prevent open redirects.
 *
 * Rules (strict order):
 * 1) decodeURIComponent (once)
 * 2) trim
 * 3) must start with "/"
 * 4) must NOT start with "//"
 * 5) must NOT contain ":" before the first "/" (blocks schemes like "http:", "javascript:", "data:")
 *
 * If invalid, returns the provided fallback (default: "/hwar/create").
 */
export function sanitizeRedirectPath(
  raw: string | null | undefined,
  fallback: string = '/hwar/create',
): string {
  if (!raw) return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }

  const value = decoded.trim();
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//')) return fallback;

  const firstSlashIndex = value.indexOf('/');
  const firstColonIndex = value.indexOf(':');
  if (firstColonIndex !== -1 && (firstSlashIndex === -1 || firstColonIndex < firstSlashIndex)) {
    return fallback;
  }

  return value;
}


