/**
 * Environment variable validation for Next.js admin dashboard
 * Validates all required configuration at build/runtime
 */

/**
 * Environment validation error class
 */
export class EnvironmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentValidationError';
  }
}

/**
 * Get an environment variable value
 * @param key - Environment variable key
 * @param defaultValue - Optional default value
 */
function getEnvVar(key: string, defaultValue?: string): string {
  // Check both process.env and window for compatibility with server/client
  if (typeof window === 'undefined') {
    // Server-side
    return process.env[key] || defaultValue || '';
  } else {
    // Client-side - only NEXT_PUBLIC_ variables are available
    return (process.env[key] as string) || defaultValue || '';
  }
}

/**
 * Validate URL format
 */
function validateUrl(url: string, name: string): { valid: boolean; error?: string } {
  if (!url) {
    return { valid: false, error: `${name} is empty` };
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: `${name} must use http:// or https://` };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: `${name} is not a valid URL` };
  }
}

/**
 * Validate API key format
 */
function validateApiKey(
  key: string,
  name: string,
  minLength: number = 20
): { valid: boolean; error?: string } {
  if (!key) {
    return { valid: false, error: `${name} is empty` };
  }

  if (key.length < minLength) {
    return { valid: false, error: `${name} appears too short (< ${minLength} characters)` };
  }

  // Check for common placeholders
  const placeholders = ['your-key-here', 'placeholder', 'xxx', 'test', 'dummy'];
  if (placeholders.some((p) => key.toLowerCase().includes(p))) {
    return { valid: false, error: `${name} contains a placeholder value` };
  }

  return { valid: true };
}

/**
 * Validate all required environment variables
 * Throws EnvironmentValidationError if validation fails
 */
export function validateEnvironment(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  const isProduction = process.env.NODE_ENV === 'production';
  const isServer = typeof window === 'undefined';

  console.log(`[Environment Validation] Running in ${process.env.NODE_ENV} mode (${isServer ? 'server' : 'client'})`);

  // Critical: API Base URL
  const apiBaseUrl = getEnvVar('NEXT_PUBLIC_API_BASE_URL');
  if (apiBaseUrl) {
    const result = validateUrl(apiBaseUrl, 'NEXT_PUBLIC_API_BASE_URL');
    if (!result.valid) {
      errors.push(result.error || 'Invalid NEXT_PUBLIC_API_BASE_URL');
    }
  } else {
    errors.push('NEXT_PUBLIC_API_BASE_URL is required');
  }

  // Critical: Supabase URL
  const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
  if (supabaseUrl) {
    const result = validateUrl(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL');
    if (!result.valid) {
      errors.push(result.error || 'Invalid NEXT_PUBLIC_SUPABASE_URL');
    }
  } else {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is required');
  }

  // Critical: Supabase Anon Key
  const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const result = validateApiKey(supabaseAnonKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 30);
  if (!result.valid) {
    errors.push(result.error || 'Invalid NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  // Optional: Backend URL (legacy, might be same as API_BASE_URL)
  const backendUrl = getEnvVar('NEXT_PUBLIC_BACKEND_URL');
  if (backendUrl && backendUrl !== apiBaseUrl) {
    warnings.push(
      'NEXT_PUBLIC_BACKEND_URL is set and differs from NEXT_PUBLIC_API_BASE_URL. Ensure this is intentional.'
    );
  }

  // Optional: Sentry DSN (only check in production)
  if (isProduction) {
    const sentryDsn = getEnvVar('NEXT_PUBLIC_SENTRY_DSN');
    if (!sentryDsn) {
      warnings.push('NEXT_PUBLIC_SENTRY_DSN not set. Error monitoring will be disabled.');
    } else {
      const sentryResult = validateUrl(sentryDsn, 'NEXT_PUBLIC_SENTRY_DSN');
      if (!sentryResult.valid) {
        warnings.push(sentryResult.error || 'Invalid NEXT_PUBLIC_SENTRY_DSN');
      }
    }
  }

  // Print warnings
  if (warnings.length > 0) {
    console.warn('='.repeat(80));
    console.warn('Environment Validation Warnings:');
    warnings.forEach((warning) => {
      console.warn(`  ⚠️  ${warning}`);
    });
    console.warn('='.repeat(80));
  }

  // Handle errors
  if (errors.length > 0) {
    console.error('='.repeat(80));
    console.error('Environment Validation FAILED:');
    errors.forEach((error) => {
      console.error(`  ❌ ${error}`);
    });
    console.error('='.repeat(80));
    console.error('Please fix the above errors before starting the application');

    throw new EnvironmentValidationError(
      `Environment validation failed with ${errors.length} error(s). See console for details.`
    );
  }

  console.log('✅ Environment validation passed successfully');
}

/**
 * Get a safe summary of environment configuration
 * (masks sensitive data)
 */
export function getEnvironmentSummary(): Record<string, string> {
  function maskSecret(value: string, showChars: number = 4): string {
    if (!value || value.length <= showChars) {
      return '***';
    }
    return `${value.slice(0, showChars)}...***`;
  }

  return {
    NODE_ENV: process.env.NODE_ENV || 'unknown',
    NEXT_PUBLIC_API_BASE_URL: getEnvVar('NEXT_PUBLIC_API_BASE_URL', 'not set'),
    NEXT_PUBLIC_SUPABASE_URL: getEnvVar('NEXT_PUBLIC_SUPABASE_URL', 'not set'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: maskSecret(getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')),
    NEXT_PUBLIC_SENTRY_DSN: getEnvVar('NEXT_PUBLIC_SENTRY_DSN')
      ? maskSecret(getEnvVar('NEXT_PUBLIC_SENTRY_DSN'))
      : 'not set',
  };
}
