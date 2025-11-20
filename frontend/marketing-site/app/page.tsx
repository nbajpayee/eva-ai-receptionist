import Hero from "@/components/sections/Hero";
import ProblemSection from "@/components/sections/ProblemSection";
import HowItWorks from "@/components/sections/HowItWorks";
import FeatureGrid from "@/components/sections/FeatureGrid";
import IntegrationsShowcase from "@/components/sections/IntegrationsShowcase";
import ComparisonTable from "@/components/sections/ComparisonTable";
import TestimonialsSection from "@/components/sections/TestimonialsSection";
import PricingTeaser from "@/components/sections/PricingTeaser";
import CTASection from "@/components/sections/CTASection";

export default function Home() {
  return (
    <>
      <Hero />
      <ProblemSection />
      <HowItWorks />
      <FeatureGrid />
      <IntegrationsShowcase />
      <ComparisonTable />
      <TestimonialsSection />
      <PricingTeaser />
      <CTASection />
    </>
  );
}
