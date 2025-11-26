/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          /**
           * Content-Security-Policy (CSP)
           *
           * SECURITY TRADEOFFS:
           * This CSP includes some permissive directives required for Next.js to function.
           * In an ideal production setup, these should be tightened or replaced with nonces.
           *
           * CURRENT COMPROMISES:
           * 1. script-src 'unsafe-eval': Required for Next.js dev mode and some runtime features
           *    - TODO: Remove 'unsafe-eval' in production builds or use nonces
           *    - Risk: Allows eval() which can be exploited for XSS if input is not sanitized
           *
           * 2. script-src 'unsafe-inline': Required for Next.js inline scripts
           *    - TODO: Replace with nonce-based CSP (requires middleware to generate nonces)
           *    - Risk: Allows inline <script> tags which can be exploited for XSS
           *
           * 3. style-src 'unsafe-inline': Required for CSS-in-JS and Tailwind
           *    - TODO: Consider styled-components with nonces or CSS Modules
           *    - Risk: Allows inline styles (lower risk than inline scripts)
           *
           * 4. img-src https:: Allows any HTTPS image source
           *    - TODO: Restrict to specific domains (CDN, Supabase storage, etc.)
           *    - Risk: Could load tracking pixels or malicious images from any HTTPS source
           *
           * RECOMMENDED IMPROVEMENTS FOR PRODUCTION:
           * - Implement nonce-based CSP with Next.js middleware
           * - Restrict img-src to specific trusted domains
           * - Remove 'unsafe-eval' for production builds
           * - Add report-uri or report-to for CSP violation monitoring
           *
           * Resources:
           * - Next.js CSP: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
           * - CSP Evaluator: https://csp-evaluator.withgoogle.com/
           */
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://assets.calendly.com https://www.googletagmanager.com https://www.google-analytics.com https://clarity.microsoft.com https://connect.facebook.net", // Analytics + Calendly
              "style-src 'self' 'unsafe-inline' https://assets.calendly.com", // Required for Tailwind/CSS-in-JS
              "img-src 'self' data: https: blob:", // Allow all HTTPS images for analytics pixels, OG images, etc.
              "font-src 'self' data:",
              "connect-src 'self' https://calendly.com https://*.calendly.com https://assets.calendly.com https://www.google-analytics.com https://analytics.google.com https://clarity.microsoft.com https://www.facebook.com https://region1.google-analytics.com", // Analytics endpoints
              "frame-src 'self' https://calendly.com https://*.calendly.com",
              "frame-ancestors 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
