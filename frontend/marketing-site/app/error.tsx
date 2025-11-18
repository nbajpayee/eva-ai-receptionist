'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console (in production, send to error tracking service)
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white px-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 text-red-600 rounded-full mb-8">
          <AlertTriangle className="w-10 h-10" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Something went wrong
        </h1>

        <p className="text-lg text-gray-600 mb-8">
          We encountered an unexpected error. Please try refreshing the page or return home.
        </p>

        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mb-8 p-4 bg-gray-100 rounded-lg text-left">
            <p className="text-sm font-mono text-gray-700 break-words">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors"
          >
            <RefreshCcw className="w-5 h-5 mr-2" />
            Try Again
          </button>

          <Link
            href="/"
            className="inline-flex items-center justify-center bg-gray-100 text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
          >
            <Home className="w-5 h-5 mr-2" />
            Go Home
          </Link>
        </div>

        <p className="mt-8 text-sm text-gray-500">
          If this problem persists, please{' '}
          <Link href="/contact" className="text-primary-600 hover:text-primary-700 font-semibold">
            contact support
          </Link>
        </p>
      </div>
    </div>
  );
}
