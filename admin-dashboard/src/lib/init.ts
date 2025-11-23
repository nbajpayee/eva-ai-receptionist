/**
 * Application initialization module
 * Runs validation and setup on application startup
 */

import { validateEnvironment, getEnvironmentSummary } from './env-validator';

let initialized = false;

/**
 * Initialize the application
 * Should be called once on application startup
 */
export function initializeApp(): void {
  // Prevent multiple initializations
  if (initialized) {
    return;
  }

  console.log('[Init] Initializing application...');

  try {
    // Validate environment variables
    validateEnvironment();

    // Log environment summary (safe, with masked secrets)
    const summary = getEnvironmentSummary();
    console.log('[Init] Environment Summary:', summary);

    initialized = true;
    console.log('[Init] Application initialized successfully');
  } catch (error) {
    console.error('[Init] Application initialization failed:', error);
    // In production, this prevents the app from starting with invalid config
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
    // In development, log error but allow continuing (for debugging)
    console.warn('[Init] Continuing in development mode despite validation errors');
  }
}

/**
 * Check if the application has been initialized
 */
export function isInitialized(): boolean {
  return initialized;
}
