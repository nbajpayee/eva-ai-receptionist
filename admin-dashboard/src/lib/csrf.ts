/**
 * CSRF Protection for Next.js API Routes
 * Implements double-submit cookie pattern with Origin header validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

const CSRF_TOKEN_COOKIE = 'csrf_token';
const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a new CSRF token
 */
export function generateCsrfToken(): string {
  return nanoid(CSRF_TOKEN_LENGTH);
}

/**
 * Validate CSRF token from request
 * Checks that the token in the header matches the token in the cookie
 */
export function validateCsrfToken(request: NextRequest): boolean {
  // Only check for state-changing methods
  const method = request.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return true; // GET and HEAD don't need CSRF protection
  }

  // Get token from cookie
  const cookieToken = request.cookies.get(CSRF_TOKEN_COOKIE)?.value;

  // Get token from header
  const headerToken = request.headers.get(CSRF_TOKEN_HEADER);

  // Both must exist and match
  if (!cookieToken || !headerToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return constantTimeCompare(cookieToken, headerToken);
}

/**
 * Validate Origin header to prevent cross-origin requests
 * This is an additional layer of protection beyond CSRF tokens
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  // If there's no origin header, it's likely a same-origin request
  // (browsers send Origin for cross-origin requests and POST requests)
  if (!origin) {
    // Check Referer as fallback
    const referer = request.headers.get('referer');
    if (!referer) {
      // No origin and no referer - this is suspicious for state-changing requests
      const method = request.method.toUpperCase();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return false;
      }
      return true; // Allow GET requests without origin/referer
    }

    try {
      const refererUrl = new URL(referer);
      return refererUrl.host === host;
    } catch {
      return false;
    }
  }

  // Check if origin matches the host
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Middleware function to protect API routes from CSRF attacks
 * Usage: wrap your API route handler with this function
 */
export function withCsrfProtection(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    // Validate origin header first (additional security layer)
    if (!validateOrigin(request)) {
      return NextResponse.json(
        { error: 'Invalid origin' },
        { status: 403 }
      );
    }

    // Validate CSRF token for state-changing methods
    if (!validateCsrfToken(request)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    // Call the actual handler
    return handler(request, context);
  };
}

/**
 * Set CSRF token cookie in response
 * Call this when initializing a session or periodically refreshing tokens
 */
export function setCsrfTokenCookie(response: NextResponse, token?: string): NextResponse {
  const csrfToken = token || generateCsrfToken();

  response.cookies.set({
    name: CSRF_TOKEN_COOKIE,
    value: csrfToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return response;
}

/**
 * Get CSRF token from request
 * Use this in client-side code to retrieve the token for API requests
 */
export function getCsrfTokenFromCookies(request: NextRequest): string | undefined {
  return request.cookies.get(CSRF_TOKEN_COOKIE)?.value;
}

/**
 * API endpoint to get a new CSRF token
 * Clients should call this to obtain a token before making state-changing requests
 */
export async function handleGetCsrfToken(request: NextRequest): Promise<NextResponse> {
  const token = generateCsrfToken();
  const response = NextResponse.json({ csrfToken: token });

  setCsrfTokenCookie(response, token);

  return response;
}
