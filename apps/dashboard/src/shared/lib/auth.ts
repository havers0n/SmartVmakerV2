import { NextResponse } from 'next/server';

export const TRUSTED_USER_ID_HEADER = 'x-scrimspec-user-id';
const ADMIN_USER_IDS_ENV = 'SCRIMSPEC_ADMIN_USER_IDS';

let cachedAdminRaw: string | undefined;
let cachedAdminIds = new Set<string>();

function getAdminUserIds(): Set<string> {
  const raw = process.env[ADMIN_USER_IDS_ENV];
  if (raw === cachedAdminRaw) {
    return cachedAdminIds;
  }

  cachedAdminRaw = raw;
  cachedAdminIds = new Set(
    (raw ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  );
  return cachedAdminIds;
}

export function getTrustedUserId(req: Request): string | null {
  const userId = req.headers.get(TRUSTED_USER_ID_HEADER);
  if (!userId || userId.trim() === '') return null;
  return userId;
}

export function isAdminUser(userId: string): boolean {
  return getAdminUserIds().has(userId);
}

export function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: 'Unauthorized. Please authenticate to access this endpoint.',
      code: 'UNAUTHORIZED',
    },
    { status: 401 }
  );
}

export function forbiddenResponse(message = 'Forbidden. Insufficient permissions.') {
  return NextResponse.json(
    {
      error: message,
      code: 'FORBIDDEN',
    },
    { status: 403 }
  );
}
