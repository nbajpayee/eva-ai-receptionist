/**
 * Supabase client for browser/client-side operations
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  // During build time, environment variables might not be available
  // Return a mock client that will fail gracefully
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // During build/SSR, return a client with placeholder values
    // This will only be used during static generation
    // At runtime in the browser, the real values will be available
    if (typeof window === 'undefined') {
      // Server-side during build - use placeholders
      return createBrowserClient<Database>(
        'https://placeholder.supabase.co',
        'placeholder-anon-key'
      )
    }
    // Client-side - this is a real error
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}

