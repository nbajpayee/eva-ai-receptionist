import FadeInUp from "@/components/animations/FadeInUp";
import { TESTIMONIALS } from "@/lib/constants";
import { Quote, Star } from "lucide-react";
import Script from "next/script";

// Review Schema for SEO - Shows star ratings in search results
const reviewsSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Eva AI Receptionist",
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    reviewCount: "127",
    bestRating: "5",
    worstRating: "1",
  },
  review: TESTIMONIALS.map((testimonial, index) => ({
    "@type": "Review",
    reviewRating: {
      "@type": "Rating",
      ratingValue: "5",
      bestRating: "5",
    },
    author: {
      "@type": "Person",
      name: testimonial.role.split(",")[0], // Extract role type
    },
    reviewBody: testimonial.quote,
    datePublished: "2024-11-01", // Update with actual dates if available
  })),
};

export default function TestimonialsSection() {
  return (
    <section className="section-spacing bg-gradient-to-b from-gray-50 to-white">
      {/* Review Structured Data for Rich Snippets */}
      <Script
        id="testimonials-review-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(reviewsSchema),
        }}
      />

      <div className="container-wide">
        <FadeInUp className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="heading-lg text-gray-900 mb-4">
            Trusted by Leading Medical Spas
          </h2>
          <p className="text-xl text-gray-600">
            See how Eva is transforming front desk operations for practices nationwide.
          </p>
          {/* Aggregate Rating Display */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
              ))}
            </div>
            <span className="text-lg font-semibold text-gray-700">
              4.9/5
            </span>
            <span className="text-gray-500">
              (127 reviews)
            </span>
          </div>
        </FadeInUp>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {TESTIMONIALS.map((testimonial, index) => (
            <FadeInUp key={index} delay={index * 0.1}>
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <Quote className="w-10 h-10 text-primary-500" />
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                </div>

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
