/**
 * Sentry edge runtime configuration for Next.js
 * This file configures Sentry for the Edge Runtime (middleware, edge API routes)
 */

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,

    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: ENVIRONMENT === "production" ? 0.1 : 1.0,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Filter sensitive data before sending to Sentry
    beforeSend(event, hint) {
      // Remove PII from user data
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
      }

      // Filter sensitive headers
      if (event.request?.headers) {
        const sensitiveHeaders = [
          "authorization",
          "cookie",
          "x-api-key",
          "x-supabase-auth",
        ];
        sensitiveHeaders.forEach((header) => {
          if (event.request?.headers?.[header]) {
            event.request.headers[header] = "[FILTERED]";
          }
        });
      }

      return event;
    },

    // Don't send default PII
    sendDefaultPii: false,
  });
} else {
  console.log("[Sentry] DSN not configured, skipping edge runtime initialization");
}
