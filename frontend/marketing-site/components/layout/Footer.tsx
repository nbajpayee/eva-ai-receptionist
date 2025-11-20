import Link from "next/link";
import { Phone, Mail, MapPin, Linkedin, Twitter } from "lucide-react";
import { SITE_CONFIG, NAV_ITEMS } from "@/lib/constants";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    product: [
      { title: "Features", href: "/features" },
      { title: "Pricing", href: "/pricing" },
      { title: "Voice Demo", href: "/voice-demo" },
      { title: "Integrations", href: "/integrations" },
    ],
    company: [
      { title: "Book a Demo", href: "/#book-demo" },
    ],
    legal: [
      { title: "Privacy Policy", href: "/privacy" },
      { title: "Terms of Service", href: "/terms" },
      { title: "HIPAA Compliance", href: "/hipaa" },
      { title: "Security", href: "/security" },
    ],
  };

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="container-wide">
        <div className="py-12 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8 lg:gap-12">
            {/* Brand Column */}
            <div className="lg:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
                  <Phone className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-white">
                  {SITE_CONFIG.name}
                </span>
              </div>
              <p className="text-sm text-gray-400 mb-6 max-w-xs">
                The AI receptionist that never misses a call. Transform your medical spa&apos;s front desk with intelligent automation.
              </p>
              <div className="flex space-x-4" aria-hidden />
            </div>

            {/* Product Links */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Product</h3>
              <ul className="space-y-3">
                {footerLinks.product.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm hover:text-white transition-colors"
                    >
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Company</h3>
              <ul className="space-y-3">
                {footerLinks.company.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm hover:text-white transition-colors"
                    >
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Legal</h3>
              <ul className="space-y-3">
                {footerLinks.legal.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm hover:text-white transition-colors"
                    >
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-sm text-gray-400">
              © {currentYear} {SITE_CONFIG.name}. All rights reserved.
            </div>
            <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4" />
                <a
                  href={`mailto:${SITE_CONFIG.contact.email}`}
                  className="hover:text-white transition-colors"
                >
                  {SITE_CONFIG.contact.email}
                </a>
              </div>
              <div className="flex items-center space-x-2" aria-hidden />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
