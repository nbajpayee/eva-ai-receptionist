import type { Metadata } from "next";
import Hero from "@/components/sections/Hero";
import ProblemSection from "@/components/sections/ProblemSection";
import HowItWorks from "@/components/sections/HowItWorks";
import FeatureGrid from "@/components/sections/FeatureGrid";
import IntegrationsShowcase from "@/components/sections/IntegrationsShowcase";
import ComparisonTable from "@/components/sections/ComparisonTable";
import TestimonialsSection from "@/components/sections/TestimonialsSection";
import CTASection from "@/components/sections/CTASection";
import Script from "next/script";
import { getFAQSchema } from "@/lib/structured-data";
import { FAQ_ITEMS, SITE_CONFIG } from "@/lib/constants";

export const metadata: Metadata = {
  title: "HIPAA-Compliant AI Receptionist for Medical Spas",
  description:
    "Eva AI is the first HIPAA-compliant AI receptionist for medical spas. Book appointments 24/7, handle voice calls, SMS & email with 100% booking accuracy. Save $30k-$40k annually.",
  openGraph: {
    title: "Eva AI - HIPAA-Compliant AI Receptionist for Medical Spas",
    description:
      "Eva AI is the first HIPAA-compliant AI receptionist for medical spas. Book appointments 24/7, handle voice calls, SMS & email with 100% booking accuracy.",
    url: SITE_CONFIG.url,
    type: "website",
    images: [
      {
        url: SITE_CONFIG.ogImage,
        width: 1200,
        height: 630,
        alt: "Eva AI Dashboard - AI Receptionist for Medical Spas",
      },
    ],
  },
  alternates: {
    canonical: SITE_CONFIG.url,
  },
};

const faqSchema = getFAQSchema(FAQ_ITEMS);

export default function Home() {
  return (
    <>
      {/* FAQ Structured Data */}
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Hero />
      <ProblemSection />
      <HowItWorks />
      <FeatureGrid />
      <IntegrationsShowcase />
      <ComparisonTable />
      <TestimonialsSection />
      <CTASection />
    </>
  );
}
