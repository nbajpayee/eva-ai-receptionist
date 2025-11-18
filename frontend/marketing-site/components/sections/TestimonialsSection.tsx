import FadeInUp from "@/components/animations/FadeInUp";
import { TESTIMONIALS } from "@/lib/constants";
import { Quote } from "lucide-react";
import Image from "next/image";

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
                  "{testimonial.quote}"
                </blockquote>

                <div className="flex items-center space-x-4 pt-6 border-t border-gray-100">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {testimonial.author.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">
                      {testimonial.author}
                    </div>
                    <div className="text-sm text-gray-600">
                      {testimonial.role}
                    </div>
                    <div className="text-sm text-gray-500">
                      {testimonial.company}
                    </div>
                  </div>
                </div>
              </div>
            </FadeInUp>
          ))}
        </div>

        {/* Logo Section */}
        <FadeInUp delay={0.4}>
          <div className="mt-16 pt-16 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600 mb-8">
              Trusted by industry leaders
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-items-center opacity-50">
              {['Med Spa 1', 'Aesthetic Clinic 2', 'Wellness Center 3', 'Beauty Institute 4'].map((name, i) => (
                <div key={i} className="text-gray-400 font-semibold text-lg">
                  {name}
                </div>
              ))}
            </div>
          </div>
        </FadeInUp>
      </div>
    </section>
  );
}
