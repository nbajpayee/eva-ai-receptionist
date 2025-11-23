import type { Metadata } from "next";
import "./globals.css";
import { SITE_CONFIG } from "@/lib/constants";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Script from "next/script";
import {
  organizationSchema,
  softwareApplicationSchema,
  websiteSchema,
} from "@/lib/structured-data";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.url),
  title: {
    default: "Eva AI - HIPAA-Compliant AI Receptionist for Medical Spas",
    template: `%s | ${SITE_CONFIG.name}`,
  },
  description: SITE_CONFIG.description,
  keywords: [
    "AI receptionist for medical spas",
    "HIPAA compliant AI receptionist",
    "medical spa automation software",
    "voice AI appointment booking",
    "aesthetic practice automation",
    "med spa scheduling software",
    "AI phone answering service healthcare",
    "automated medical spa receptionist",
    "healthcare front desk automation",
    "medical spa booking system",
    "AI voice assistant healthcare",
    "appointment scheduling AI",
    "med spa software",
    "aesthetic clinic automation",
    "omnichannel healthcare communication",
  ],
  authors: [
    {
      name: "Eva AI",
      url: SITE_CONFIG.url,
    },
  ],
  creator: "Eva AI",
  publisher: "Eva AI",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_CONFIG.url,
    title: "Eva AI - HIPAA-Compliant AI Receptionist for Medical Spas",
    description: SITE_CONFIG.description,
    siteName: SITE_CONFIG.name,
    images: [
      {
        url: SITE_CONFIG.ogImage,
        width: 1200,
        height: 630,
        alt: "Eva AI - The AI Receptionist for Medical Spas",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Eva AI - HIPAA-Compliant AI Receptionist for Medical Spas",
    description: SITE_CONFIG.description,
    images: [SITE_CONFIG.ogImage],
    creator: "@eva-ai",
    site: "@eva-ai",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: "/icon-med.png",
    shortcut: "/icon-med.png",
    apple: "/icon-med.png",
  },
  manifest: "/site.webmanifest",
  verification: {
    // Add these when you set up Google Search Console and Bing Webmaster Tools
    // google: 'your-google-verification-code',
    // bing: 'your-bing-verification-code',
  },
  alternates: {
    canonical: SITE_CONFIG.url,
  },
  category: 'Healthcare Technology',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Structured Data for SEO */}
        <Script
          id="organization-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <Script
          id="software-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(softwareApplicationSchema),
          }}
        />
        <Script
          id="website-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteSchema),
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-6 focus:py-3 focus:bg-primary focus:text-white focus:rounded-lg focus:shadow-lg"
        >
          Skip to main content
        </a>
        <Header />
        <main id="main-content" className="min-h-screen">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
