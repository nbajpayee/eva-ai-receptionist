/**
 * Analytics and Conversion Tracking Utilities
 *
 * Setup Instructions:
 * 1. Add NEXT_PUBLIC_GA_MEASUREMENT_ID to .env.local
 * 2. Install Google Analytics Script in layout.tsx
 * 3. Configure conversion goals in Google Analytics 4
 */

// Type definitions for analytics events
export type AnalyticsEvent =
  | 'demo_booking_started'
  | 'demo_booking_completed'
  | 'contact_form_submitted'
  | 'phone_clicked'
  | 'email_clicked'
  | 'pricing_page_viewed'
  | 'features_page_viewed'
  | 'blog_post_viewed'
  | 'newsletter_signup'
  | 'calendly_opened'
  | 'download_press_kit';

interface AnalyticsEventParams {
  category?: string;
  label?: string;
  value?: number;
  [key: string]: any;
}

/**
 * Track custom events in Google Analytics 4
 */
export const trackEvent = (
  eventName: AnalyticsEvent,
  params?: AnalyticsEventParams
) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, {
      event_category: params?.category || 'engagement',
      event_label: params?.label,
      value: params?.value,
      ...params,
    });
  } else {
    // Fallback for development or when GA is not loaded
    console.log('[Analytics Event]:', eventName, params);
  }
};

/**
 * Track page views (called automatically by Next.js with GA4)
 */
export const trackPageView = (url: string, title?: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID!, {
      page_path: url,
      page_title: title,
    });
  }
};

/**
 * Track conversion events (for Google Ads and conversion tracking)
 */
export const trackConversion = (
  conversionId: string,
  value?: number,
  currency: string = 'USD'
) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'conversion', {
      send_to: conversionId,
      value: value,
      currency: currency,
    });
  }
};

/**
 * Track demo booking completion (HIGH VALUE CONVERSION)
 */
export const trackDemoBooked = (source: string = 'unknown') => {
  trackEvent('demo_booking_completed', {
    category: 'conversion',
    label: source,
    value: 1000, // Estimated value of a demo booking
  });

  // Also track as a conversion for Google Ads
  if (process.env.NEXT_PUBLIC_GA_ADS_CONVERSION_ID) {
    trackConversion(process.env.NEXT_PUBLIC_GA_ADS_CONVERSION_ID, 1000);
  }
};

/**
 * Track contact form submission
 */
export const trackContactFormSubmit = (formType: string = 'general') => {
  trackEvent('contact_form_submitted', {
    category: 'conversion',
    label: formType,
    value: 500, // Estimated value of contact form
  });
};

/**
 * Track phone call clicks (call tracking)
 */
export const trackPhoneClick = (phoneNumber: string) => {
  trackEvent('phone_clicked', {
    category: 'engagement',
    label: phoneNumber,
  });
};

/**
 * Track email clicks
 */
export const trackEmailClick = (email: string) => {
  trackEvent('email_clicked', {
    category: 'engagement',
    label: email,
  });
};

/**
 * Track Calendly widget interactions
 */
export const trackCalendlyEvent = (eventType: 'opened' | 'scheduled' | 'closed') => {
  if (eventType === 'scheduled') {
    trackDemoBooked('calendly');
  } else if (eventType === 'opened') {
    trackEvent('calendly_opened', {
      category: 'engagement',
    });
  }
};

/**
 * Track blog post reads (time on page metric)
 */
export const trackBlogPostRead = (slug: string, timeSpent: number) => {
  trackEvent('blog_post_viewed', {
    category: 'content',
    label: slug,
    value: Math.floor(timeSpent / 1000), // Convert to seconds
  });
};

/**
 * Track newsletter signups
 */
export const trackNewsletterSignup = (source: string = 'blog') => {
  trackEvent('newsletter_signup', {
    category: 'conversion',
    label: source,
    value: 50,
  });
};

/**
 * Track scroll depth for engagement metrics
 */
export const trackScrollDepth = (percentage: number, page: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'scroll', {
      event_category: 'engagement',
      event_label: page,
      value: percentage,
    });
  }
};

/**
 * Set user properties for segmentation
 */
export const setUserProperties = (properties: {
  user_type?: 'new' | 'returning';
  industry?: string;
  company_size?: string;
  [key: string]: any;
}) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('set', 'user_properties', properties);
  }
};

// Type augmentation for window.gtag
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}
