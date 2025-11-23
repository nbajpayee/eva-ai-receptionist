/**
 * CSRF Token API Endpoint
 * Clients call this to obtain a CSRF token before making state-changing requests
 */

import { NextRequest } from 'next/server';
import { handleGetCsrfToken } from '@/lib/csrf';

export async function GET(request: NextRequest) {
  return handleGetCsrfToken(request);
}
