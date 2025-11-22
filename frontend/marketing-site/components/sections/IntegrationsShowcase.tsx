"use client";

import FadeInUp from "@/components/animations/FadeInUp";
import IntegrationsViz from "@/components/ui/IntegrationsViz";

export default function IntegrationsShowcase() {
  return (
    <section className="py-8 lg:py-12 bg-white overflow-hidden">
      <div className="container-wide relative">
        {/* Background Decor */}
        <div className="absolute top-0 right-0 w-[800px] h-[600px] bg-primary-50/50 blur-[100px] rounded-full pointer-events-none translate-x-1/3 -translate-y-1/4" />
        
        <div className="grid lg:grid-cols-2 gap-12 items-center relative z-10">
          {/* Viz (Left Side now) */}
          <FadeInUp delay={0.2} className="w-full flex justify-center lg:justify-start order-2 lg:order-1">
            <div className="w-full max-w-[600px]">
              <IntegrationsViz />
            </div>
          </FadeInUp>

          {/* Text Content (Right Side now) */}
          <FadeInUp className="text-left order-1 lg:order-2">
            <h2 className="heading-lg text-gray-900 mb-6">
              Eva syncs with your booking engine
            </h2>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Our solution seamlessly integrates with the apps you use most, making it easy to connect and streamline your workflow. Eva syncs perfectly with your existing booking engine.
            </p>
          </FadeInUp>
        </div>
      </div>
    </section>
  );
}
