"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, SITE_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import Image from "next/image";

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-white/95 backdrop-blur-sm shadow-sm"
          : "bg-transparent"
      )}
    >
      <nav className="container-wide">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3">
            <div className="relative w-10 h-10 rounded-lg overflow-hidden">
              <Image 
                src="/icon-med.png" 
                alt="Eva AI Logo" 
                fill
                className="object-cover"
                priority
              />
            </div>
            <span className="text-xl font-bold text-gray-900">
              {SITE_CONFIG.name}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  pathname === item.href
                    ? "text-primary"
                    : "text-gray-700"
                )}
              >
                {item.title}
              </Link>
            ))}
          </div>

          {/* CTA Button (Desktop) */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              href="https://dashboard.getevaai.com"
              className="text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              Login
            </Link>
            <Link
              href="/#book-demo"
              className="btn-primary px-4 py-2 text-xs sm:px-5 sm:py-2.5 sm:text-sm"
            >
              Talk to Sales
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center space-x-3">
            <Link
              href="https://dashboard.getevaai.com"
              className="text-xs font-medium text-gray-500 hover:text-gray-900"
            >
              Login
            </Link>
            <Link
              href="/#book-demo"
              className="btn-primary px-4 py-2 text-xs sm:px-5 sm:py-2.5 sm:text-sm"
            >
              Talk to Sales
            </Link>
          </div>
        </div>

        {/* Mobile Menu */}
        {false && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col space-y-4">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "text-base font-medium transition-colors hover:text-primary px-4 py-2",
                    pathname === item.href
                      ? "text-primary bg-primary-50"
                      : "text-gray-700"
                  )}
                >
                  {item.title}
                </Link>
              ))}
              <div className="px-4 pt-4 border-t border-gray-200">
                <Link
                  href="/#book-demo"
                  className="btn-primary w-full"
                >
                  Book a Demo
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
