import FadeInUp from "@/components/animations/FadeInUp";
import { TESTIMONIALS } from "@/lib/constants";
import { Quote } from "lucide-react";

export default function TestimonialsSection() {
  return (
    <section className="section-spacing bg-gradient-to-b from-gray-50 to-white">
      <div className="container-wide">
        <FadeInUp className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="heading-lg text-gray-900 mb-4">
            Trusted by Leading Medical Spas
          </h2>
          <p className="text-xl text-gray-600">
            See how Eva is transforming front desk operations for practices nationwide.
          </p>
        </FadeInUp>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {TESTIMONIALS.map((testimonial, index) => (
            <FadeInUp key={index} delay={index * 0.1}>
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow h-full flex flex-col">
                <Quote className="w-10 h-10 text-primary-500 mb-6" />

                <blockquote className="text-gray-700 text-lg mb-6 flex-1">
                  &quot;{testimonial.quote}&quot;
                </blockquote>

                <div className="pt-6 border-t border-gray-100 text-sm text-gray-600">
                  {testimonial.role}
                </div>
              </div>
            </FadeInUp>
          ))}
        </div>

      </div>
    </section>
  );
}
