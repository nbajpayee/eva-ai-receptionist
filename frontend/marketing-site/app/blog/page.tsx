import type { Metadata } from "next";
import Link from "next/link";
import FadeInUp from "@/components/animations/FadeInUp";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { SITE_CONFIG } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Blog - Medical Spa AI & Automation Insights",
  description:
    "Expert insights on AI receptionists, medical spa automation, HIPAA compliance, and practice growth strategies. Learn how to optimize your aesthetic practice with Eva AI.",
  keywords: [
    "medical spa blog",
    "AI receptionist insights",
    "medical spa automation tips",
    "HIPAA compliance guide",
    "aesthetic practice management",
    "medical spa marketing",
  ],
  openGraph: {
    title: "Eva AI Blog - Medical Spa Automation & Growth Insights",
    description: "Expert tips on AI automation, HIPAA compliance, and growing your medical spa practice.",
    url: `${SITE_CONFIG.url}/blog`,
  },
  alternates: {
    canonical: `${SITE_CONFIG.url}/blog`,
  },
};

// Blog posts data - in production, this would come from a CMS or markdown files
const BLOG_POSTS = [
  {
    slug: "10-ways-ai-receptionists-save-medical-spas-money",
    title: "10 Ways AI Receptionists Save Medical Spas Money in 2025",
    excerpt:
      "Discover how AI receptionists can save your medical spa $30k-$40k annually while improving patient satisfaction and booking rates.",
    author: "Eva AI Team",
    date: "2025-01-15",
    readTime: "8 min read",
    category: "Cost Savings",
    image: "/blog/ai-savings.jpg",
  },
  {
    slug: "hipaa-compliance-guide-medical-spa-software",
    title: "The Complete HIPAA Compliance Guide for Medical Spa Software",
    excerpt:
      "Everything you need to know about HIPAA compliance when choosing software for your medical spa or aesthetic practice.",
    author: "Eva AI Team",
    date: "2025-01-10",
    readTime: "12 min read",
    category: "Compliance",
    image: "/blog/hipaa-guide.jpg",
  },
  {
    slug: "handling-after-hours-calls-medical-spa",
    title: "How to Handle After-Hours Calls in Your Medical Spa",
    excerpt:
      "65% of booking decisions happen outside business hours. Learn how to capture these patients without burning out your staff.",
    author: "Eva AI Team",
    date: "2025-01-05",
    readTime: "6 min read",
    category: "Operations",
    image: "/blog/after-hours.jpg",
  },
  {
    slug: "ai-vs-human-receptionist-medical-spas",
    title: "AI vs Human Receptionists: What Medical Spas Need to Know",
    excerpt:
      "A balanced comparison of AI and human receptionists, including when to use each and how to combine them effectively.",
    author: "Eva AI Team",
    date: "2024-12-20",
    readTime: "10 min read",
    category: "Strategy",
    image: "/blog/ai-vs-human.jpg",
  },
  {
    slug: "deterministic-booking-explained",
    title: "What is Deterministic Booking and Why Does It Matter?",
    excerpt:
      "Learn how deterministic booking eliminates AI hallucinations and ensures 100% accurate appointment scheduling.",
    author: "Eva AI Team",
    date: "2024-12-15",
    readTime: "7 min read",
    category: "Technology",
    image: "/blog/deterministic-booking.jpg",
  },
  {
    slug: "increase-medical-spa-bookings-sms-email",
    title: "How to Increase Medical Spa Bookings with SMS & Email Follow-ups",
    excerpt:
      "Master the art of omnichannel communication to convert more leads and reduce no-shows at your medical spa.",
    author: "Eva AI Team",
    date: "2024-12-10",
    readTime: "9 min read",
    category: "Marketing",
    image: "/blog/omnichannel.jpg",
  },
];

export default function BlogPage() {
  return (
    <>
      {/* Hero */}
      <section className="section-spacing bg-gradient-to-b from-gray-50 to-white pt-32">
        <div className="container-wide">
          <FadeInUp className="text-center max-w-3xl mx-auto mb-16">
            <h1 className="heading-xl text-gray-900 mb-6">
              Medical Spa Automation & Growth Insights
            </h1>
            <p className="text-xl text-gray-600">
              Expert tips on AI automation, HIPAA compliance, and scaling your aesthetic practice.
            </p>
          </FadeInUp>
        </div>
      </section>

      {/* Blog Grid */}
      <section className="section-spacing bg-white">
        <div className="container-wide">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {BLOG_POSTS.map((post, index) => (
              <FadeInUp key={post.slug} delay={index * 0.1}>
                <article className="group h-full flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl hover:border-primary-100 transition-all duration-300">
                  {/* Image Placeholder */}
                  <div className="aspect-[16/9] bg-gradient-to-br from-primary-100 to-primary-50 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-primary-300 text-6xl font-bold opacity-20">
                        Eva AI
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xs font-bold px-3 py-1 bg-primary-100 text-primary-700 rounded-full uppercase tracking-wide">
                        {post.category}
                      </span>
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="w-4 h-4 mr-1" />
                        {post.readTime}
                      </div>
                    </div>

                    <h2 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-primary-600 transition-colors line-clamp-2">
                      {post.title}
                    </h2>

                    <p className="text-gray-600 mb-6 flex-1 line-clamp-3">
                      {post.excerpt}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(post.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>

                      <Link
                        href={`/blog/${post.slug}`}
                        className="flex items-center text-primary-600 font-semibold text-sm group-hover:translate-x-1 transition-transform"
                      >
                        Read more
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Link>
                    </div>
                  </div>
                </article>
              </FadeInUp>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="section-spacing bg-gradient-to-br from-primary-600 to-primary-700">
        <div className="container-wide">
          <FadeInUp className="text-center max-w-2xl mx-auto text-white">
            <h2 className="heading-md mb-4">Stay Updated</h2>
            <p className="text-xl text-primary-100 mb-8">
              Get the latest insights on medical spa automation delivered to your inbox.
            </p>
            <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-6 py-3 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
                required
              />
              <button
                type="submit"
                className="px-8 py-3 bg-white text-primary-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              >
                Subscribe
              </button>
            </form>
          </FadeInUp>
        </div>
      </section>
    </>
  );
}
