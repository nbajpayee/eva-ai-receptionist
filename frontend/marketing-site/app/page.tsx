import Hero from "@/components/sections/Hero";
import ProblemSection from "@/components/sections/ProblemSection";
import HowItWorks from "@/components/sections/HowItWorks";
import FeaturesSection from "@/components/sections/FeaturesSection";
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
      <FeaturesSection />
      <ComparisonTable />
      <TestimonialsSection />
      <PricingTeaser />
      <CTASection />
    </>
  );
}
