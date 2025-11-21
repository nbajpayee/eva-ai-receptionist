import Hero from "@/components/sections/Hero";
import ProblemSection from "@/components/sections/ProblemSection";
import HowItWorks from "@/components/sections/HowItWorks";
import FeatureGrid from "@/components/sections/FeatureGrid";
import IntegrationsShowcase from "@/components/sections/IntegrationsShowcase";
import ComparisonTable from "@/components/sections/ComparisonTable";
import TestimonialsSection from "@/components/sections/TestimonialsSection";
import ROICalculator from "@/components/sections/ROICalculator";
import CTASection from "@/components/sections/CTASection";
import FadeInUp from "@/components/animations/FadeInUp";

export default function Home() {
  return (
    <>
      <Hero />
      <ProblemSection />

      {/* ROI Calculator Section */}
      <section className="section-spacing bg-gray-50">
        <div className="container-narrow">
          <FadeInUp className="text-center mb-12">
            <h2 className="heading-lg text-gray-900 mb-4">
              What&apos;s Missed Calls Costing You?
            </h2>
            <p className="text-xl text-gray-600">
              Calculate the revenue you&apos;re losing every year
            </p>
          </FadeInUp>
          <ROICalculator />
        </div>
      </section>

      <HowItWorks />
      <FeatureGrid />
      <IntegrationsShowcase />
      <ComparisonTable />
      <TestimonialsSection />
      <CTASection />
    </>
  );
}
