import { SITE_CONFIG } from './constants';

/**
 * Schema.org JSON-LD Structured Data for SEO
 * These help search engines understand our content better
 */

export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Eva AI',
  alternateName: 'Eva - AI Receptionist',
  url: SITE_CONFIG.url,
  logo: `${SITE_CONFIG.url}/icon-med.png`,
  description: SITE_CONFIG.description,
  email: SITE_CONFIG.contact.email,
  telephone: SITE_CONFIG.contact.phone,
  sameAs: [
    SITE_CONFIG.links.twitter,
    SITE_CONFIG.links.linkedin,
    SITE_CONFIG.links.facebook,
  ],
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'US',
  },
};

export const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Eva AI Receptionist',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Healthcare Software',
  operatingSystem: 'Web, Cloud',
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'USD',
    lowPrice: '299',
    highPrice: '599',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: '299',
      priceCurrency: 'USD',
      referenceQuantity: {
        '@type': 'QuantitativeValue',
        value: '1',
        unitText: 'MONTH',
      },
    },
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    ratingCount: '127',
    bestRating: '5',
    worstRating: '1',
  },
  description: SITE_CONFIG.description,
  url: SITE_CONFIG.url,
  screenshot: SITE_CONFIG.ogImage,
  featureList: [
    '24/7 AI Voice Receptionist',
    'Deterministic Appointment Booking',
    'HIPAA Compliant',
    'Omnichannel Communications (Voice, SMS, Email)',
    'AI-Powered Analytics',
    'Google Calendar & Boulevard Integration',
  ],
};

export const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  serviceType: 'AI Receptionist Service',
  provider: {
    '@type': 'Organization',
    name: 'Eva AI',
    url: SITE_CONFIG.url,
  },
  areaServed: {
    '@type': 'Country',
    name: 'United States',
  },
  audience: {
    '@type': 'Audience',
    audienceType: 'Medical Spas, Aesthetic Practices, Healthcare Providers',
  },
  category: 'Healthcare Automation',
  description: 'AI-powered receptionist service for medical spas and aesthetic practices',
  brand: {
    '@type': 'Brand',
    name: 'Eva AI',
  },
};

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_CONFIG.name,
  url: SITE_CONFIG.url,
  description: SITE_CONFIG.description,
  publisher: {
    '@type': 'Organization',
    name: 'Eva AI',
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_CONFIG.url}/icon-med.png`,
    },
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_CONFIG.url}/search?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

export function getFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function getBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function getArticleSchema({
  title,
  description,
  image,
  datePublished,
  dateModified,
  authorName = 'Eva AI Team',
}: {
  title: string;
  description: string;
  image: string;
  datePublished: string;
  dateModified?: string;
  authorName?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: description,
    image: image,
    datePublished: datePublished,
    dateModified: dateModified || datePublished,
    author: {
      '@type': 'Person',
      name: authorName,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Eva AI',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_CONFIG.url}/icon-med.png`,
      },
    },
  };
}

export function getReviewSchema(reviews: Array<{
  author: string;
  rating: number;
  reviewBody: string;
  datePublished?: string;
}>) {
  return reviews.map((review) => ({
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: {
      '@type': 'SoftwareApplication',
      name: 'Eva AI Receptionist',
    },
    author: {
      '@type': 'Person',
      name: review.author,
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.rating,
      bestRating: 5,
      worstRating: 1,
    },
    reviewBody: review.reviewBody,
    datePublished: review.datePublished || new Date().toISOString(),
  }));
}
