'use client';

import Link from 'next/link';
import { Search, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white px-4">
      <div className="max-w-2xl w-full text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 text-primary-600 rounded-full mb-8">
          <Search className="w-10 h-10" />
        </div>

        <h1 className="text-6xl font-bold text-gray-900 mb-4">
          404
        </h1>

        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Page Not Found
        </h2>

        <p className="text-lg text-gray-600 mb-8">
          Sorry, we couldn&apos;t find the page you&apos;re looking for. It may have been moved or no longer exists.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors"
          >
            <Home className="w-5 h-5 mr-2" />
            Go Home
          </Link>

          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center bg-gray-100 text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Go Back
          </button>
        </div>

        <div className="border-t border-gray-200 pt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Popular Pages
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link href="/features" className="text-primary-600 hover:text-primary-700 font-medium">
              Features
            </Link>
            <Link href="/pricing" className="text-primary-600 hover:text-primary-700 font-medium">
              Pricing
            </Link>
            <Link href="/voice-demo" className="text-primary-600 hover:text-primary-700 font-medium">
              Voice Demo
            </Link>
            <Link href="/contact" className="text-primary-600 hover:text-primary-700 font-medium">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
