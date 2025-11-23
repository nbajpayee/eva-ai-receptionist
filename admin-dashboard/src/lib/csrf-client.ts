/**
 * Client-side CSRF protection utilities
 * Use these functions to include CSRF tokens in API requests
 */

/**
 * Get CSRF token from cookies
 */
function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrf_token') {
      return decodeURIComponent(value);
    }
  }

  return null;
}

/**
 * Fetch a new CSRF token from the server
 */
export async function fetchCsrfToken(): Promise<string> {
  try {
    const response = await fetch('/api/csrf');
    if (!response.ok) {
      throw new Error('Failed to fetch CSRF token');
    }

    const data = await response.json();
    return data.csrfToken;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    throw error;
  }
}

/**
 * Get CSRF token (from cookie or fetch new one)
 */
export async function getCsrfToken(): Promise<string> {
  // Try to get from cookie first
  const cookieToken = getCsrfTokenFromCookie();
  if (cookieToken) {
    return cookieToken;
  }

  // If not in cookie, fetch a new one
  return fetchCsrfToken();
}

/**
 * Enhanced fetch wrapper that automatically includes CSRF token
 */
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = options.method?.toUpperCase() || 'GET';

  // Only add CSRF token for state-changing methods
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const token = await getCsrfToken();

    const headers = new Headers(options.headers);
    headers.set('x-csrf-token', token);

    options.headers = headers;
  }

  return fetch(url, options);
}

/**
 * Initialize CSRF protection
 * Call this once when the application starts to ensure a token is available
 */
export async function initCsrfProtection(): Promise<void> {
  try {
    // Check if we already have a token
    const existingToken = getCsrfTokenFromCookie();
    if (existingToken) {
      return; // Already initialized
    }

    // Fetch a new token
    await fetchCsrfToken();
  } catch (error) {
    console.error('Failed to initialize CSRF protection:', error);
  }
}
