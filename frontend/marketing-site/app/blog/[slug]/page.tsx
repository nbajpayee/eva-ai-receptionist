import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, Clock, ArrowLeft, Share2 } from "lucide-react";
import { SITE_CONFIG } from "@/lib/constants";
import { getArticleSchema } from "@/lib/structured-data";
import Script from "next/script";
import CTASection from "@/components/sections/CTASection";

// In production, this would fetch from a CMS or markdown files
const BLOG_POSTS: Record<string, {
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readTime: string;
  category: string;
  content: string;
}> = {
  "10-ways-ai-receptionists-save-medical-spas-money": {
    title: "10 Ways AI Receptionists Save Medical Spas Money in 2025",
    excerpt:
      "Discover how AI receptionists can save your medical spa $30k-$40k annually while improving patient satisfaction and booking rates.",
    author: "Eva AI Team",
    date: "2025-01-15",
    readTime: "8 min read",
    category: "Cost Savings",
    content: `
      <p class="lead">The average medical spa spends between $35,000-$45,000 annually on front desk staff. With rising labor costs and increasing patient expectations, practice owners are looking for smarter solutions.</p>

      <p>AI receptionists like Eva AI are transforming how medical spas handle patient communications—cutting costs while improving service quality. Here are 10 proven ways AI saves money:</p>

      <h2>1. Eliminate After-Hours Missed Calls</h2>
      <p>65% of potential patients call outside regular business hours. Without 24/7 coverage, you're losing thousands in booking opportunities every month.</p>
      <p><strong>Savings:</strong> AI handles all after-hours calls, capturing an estimated $5,000-$8,000 in monthly bookings that would otherwise be lost.</p>

      <h2>2. Reduce No-Shows with Automated Reminders</h2>
      <p>Every no-show costs your practice an average of $200 in lost revenue. AI receptionists automatically send SMS and email reminders 48 and 24 hours before appointments.</p>
      <p><strong>Savings:</strong> Reducing no-shows by just 20% saves $2,400-$4,800 annually for practices with 100 monthly appointments.</p>

      <h2>3. Cut Overtime and Staffing Costs</h2>
      <p>Front desk overtime during busy seasons can add $500-$1,000 per week. AI scales instantly without overtime pay or additional hiring.</p>
      <p><strong>Savings:</strong> $6,000-$12,000 annually in overtime elimination.</p>

      <h2>4. Eliminate Training Costs for New Hires</h2>
      <p>Training a new receptionist takes 2-4 weeks and costs $3,000-$5,000 in productivity loss and trainer time. AI is trained once and never forgets.</p>
      <p><strong>Savings:</strong> $3,000-$5,000 per year (assuming one replacement hire).</p>

      <h2>5. Reduce Double-Booking and Calendar Errors</h2>
      <p>Manual booking errors lead to patient frustration, lost time, and revenue. AI with deterministic booking guarantees 100% accuracy.</p>
      <p><strong>Savings:</strong> Eliminating 5-10 booking errors monthly saves $1,000-$2,000 in lost revenue and service recovery costs.</p>

      <h2>6. Handle Peak Call Volume Without Extra Staff</h2>
      <p>Seasonal peaks (January detox, June weddings) require temporary staff or overwhelm existing teams. AI handles unlimited concurrent calls.</p>
      <p><strong>Savings:</strong> $4,000-$8,000 in seasonal temp staffing.</p>

      <h2>7. Automate Insurance Verification and Pre-Screening</h2>
      <p>Manual verification takes 10-15 minutes per patient. AI collects information during booking, reducing admin workload.</p>
      <p><strong>Savings:</strong> 5-10 hours weekly in admin time = $6,000-$12,000 annually.</p>

      <h2>8. Improve First-Call Resolution Rates</h2>
      <p>When receptionists are overwhelmed, patients get transferred or called back. AI answers immediately with accurate information.</p>
      <p><strong>Savings:</strong> Better patient experience increases conversion rates by 15-25%, worth $10,000-$20,000 annually for mid-sized practices.</p>

      <h2>9. Reduce Turnover Costs</h2>
      <p>Front desk turnover averages 30-50% annually in healthcare. Each replacement costs $5,000-$10,000 in recruiting, training, and lost productivity.</p>
      <p><strong>Savings:</strong> $5,000-$10,000 per year by reducing dependence on single-point-of-failure roles.</p>

      <h2>10. Free Your Team for Higher-Value Work</h2>
      <p>When AI handles routine calls, your human staff can focus on patient care, upselling services, and relationship building.</p>
      <p><strong>Savings:</strong> Increased revenue per patient visit by 10-20% = $15,000-$30,000 annually for established practices.</p>

      <h2>Total Annual Savings: $30,000-$60,000+</h2>
      <p>The numbers speak for themselves. AI receptionists aren't just a cost-cutting tool—they're a growth accelerator. Practices that adopt AI report:</p>
      <ul>
        <li>40% increase in after-hours bookings</li>
        <li>25% reduction in no-shows</li>
        <li>100% accuracy in appointment scheduling</li>
        <li>99.8% uptime (better than human availability)</li>
      </ul>

      <h2>Ready to See Your Savings?</h2>
      <p>Book a demo with Eva AI to calculate your exact ROI based on your practice size, call volume, and current staffing costs.</p>
    `,
  },
};

type Props = {
  params: {
    slug: string;
  };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = BLOG_POSTS[params.slug];

  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `${SITE_CONFIG.url}/blog/${params.slug}`,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
    },
    alternates: {
      canonical: `${SITE_CONFIG.url}/blog/${params.slug}`,
    },
  };
}

export default function BlogPost({ params }: Props) {
  const post = BLOG_POSTS[params.slug];

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Post Not Found</h1>
          <Link href="/blog" className="text-primary-600 hover:underline">
            ← Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  const articleSchema = getArticleSchema({
    title: post.title,
    description: post.excerpt,
    image: SITE_CONFIG.ogImage,
    datePublished: post.date,
    authorName: post.author,
  });

  return (
    <>
      {/* Article Structured Data */}
      <Script
        id="article-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleSchema),
        }}
      />

      <article className="py-24">
        <div className="container-narrow">
          {/* Back Link */}
          <Link
            href="/blog"
            className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-8 font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Blog
          </Link>

          {/* Header */}
          <header className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xs font-bold px-3 py-1 bg-primary-100 text-primary-700 rounded-full uppercase tracking-wide">
                {post.category}
              </span>
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="w-4 h-4 mr-1" />
                {post.readTime}
              </div>
            </div>

            <h1 className="heading-xl text-gray-900 mb-6">{post.title}</h1>

            <div className="flex items-center justify-between pb-6 border-b border-gray-200">
              <div className="flex items-center text-gray-600">
                <Calendar className="w-5 h-5 mr-2" />
                <span>
                  {new Date(post.date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="mx-3">•</span>
                <span>By {post.author}</span>
              </div>

              <button className="flex items-center text-gray-600 hover:text-primary-600 transition-colors">
                <Share2 className="w-5 h-5 mr-2" />
                Share
              </button>
            </div>
          </header>

          {/* Content */}
          <div
            className="prose prose-lg prose-primary max-w-none
              prose-headings:font-bold prose-headings:text-gray-900
              prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-4
              prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-6
              prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline
              prose-strong:text-gray-900 prose-strong:font-semibold
              prose-ul:my-6 prose-li:text-gray-700
              prose-lead:text-xl prose-lead:text-gray-600 prose-lead:mb-8"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Author Bio */}
          <div className="mt-16 p-8 bg-gray-50 rounded-2xl border border-gray-200">
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-primary-600 font-bold text-xl">EA</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Eva AI Team</h3>
                <p className="text-gray-600">
                  Our team of medical spa automation experts shares insights on AI, HIPAA compliance,
                  and practice growth strategies to help aesthetic practices thrive.
                </p>
              </div>
            </div>
          </div>
        </div>
      </article>

      {/* CTA */}
      <CTASection />
    </>
  );
}
