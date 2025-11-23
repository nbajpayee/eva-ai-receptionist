/**
 * API request/response validation schemas using Zod
 * Provides runtime type safety for API routes
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';

/**
 * Common validation schemas
 */

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(100).default(20),
});

// ID parameter schema
export const idParamSchema = z.object({
  id: z.string().uuid().or(z.coerce.number().int().positive()),
});

// Search query schema
export const searchQuerySchema = z.object({
  search: z.string().optional(),
  ...paginationSchema.shape,
});

// Date range schema
export const dateRangeSchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

/**
 * Customer validation schemas
 */
export const customerCreateSchema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().min(1).max(20),
  email: z.string().email().optional(),
  notes: z.string().optional(),
});

export const customerUpdateSchema = customerCreateSchema.partial();

/**
 * Appointment validation schemas
 */
export const appointmentCreateSchema = z.object({
  customer_id: z.number().int().positive(),
  service_id: z.number().int().positive(),
  provider_id: z.number().int().positive().optional(),
  location_id: z.number().int().positive().optional(),
  scheduled_at: z.string().datetime(),
  duration_minutes: z.number().int().positive(),
  notes: z.string().optional(),
});

export const appointmentUpdateSchema = appointmentCreateSchema.partial();

/**
 * Message validation schemas
 */
export const messageSendSchema = z.object({
  customer_id: z.number().int().positive(),
  channel: z.enum(['sms', 'email']),
  content: z.string().min(1),
  subject: z.string().optional(), // For email only
});

/**
 * Settings validation schemas
 */
export const settingsUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  phone: z.string().min(1).max(20).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  timezone: z.string().optional(),
  ai_assistant_name: z.string().min(1).max(100).optional(),
  cancellation_policy: z.string().optional(),
});

/**
 * Service validation schemas
 */
export const serviceCreateSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).optional(),
  description: z.string(),
  duration_minutes: z.number().int().positive(),
  price_min: z.number().positive().optional(),
  price_max: z.number().positive().optional(),
  price_display: z.string().optional(),
  prep_instructions: z.string().optional(),
  aftercare_instructions: z.string().optional(),
  category: z.string().optional(),
  is_active: z.boolean().default(true),
  display_order: z.number().int().optional(),
});

export const serviceUpdateSchema = serviceCreateSchema.partial();

/**
 * Provider validation schemas
 */
export const providerCreateSchema = z.object({
  name: z.string().min(1).max(255),
  title: z.string().min(1).max(255).optional(),
  specialties: z.array(z.string()).optional(),
  bio: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  is_active: z.boolean().default(true),
});

export const providerUpdateSchema = providerCreateSchema.partial();

/**
 * Location validation schemas
 */
export const locationCreateSchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().min(1),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(50),
  zip_code: z.string().min(1).max(20),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  timezone: z.string().default('America/New_York'),
  is_active: z.boolean().default(true),
});

export const locationUpdateSchema = locationCreateSchema.partial();

/**
 * Helper function to validate request body
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated data or NextResponse with validation errors
 */
export async function validateRequestBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'Validation failed',
            details: error.errors.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          },
          { status: 400 }
        ),
      };
    }
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      ),
    };
  }
}

/**
 * Helper function to validate query parameters
 * @param schema - Zod schema to validate against
 * @param searchParams - URLSearchParams to validate
 * @returns Validated data or NextResponse with validation errors
 */
export function validateQueryParams<T>(
  schema: z.ZodSchema<T>,
  searchParams: URLSearchParams
): { success: true; data: T } | { success: false; response: NextResponse } {
  try {
    const params = Object.fromEntries(searchParams.entries());
    const validated = schema.parse(params);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'Invalid query parameters',
            details: error.errors.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          },
          { status: 400 }
        ),
      };
    }
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      ),
    };
  }
}

/**
 * Helper function to validate route parameters
 * @param schema - Zod schema to validate against
 * @param params - Route parameters to validate
 * @returns Validated data or NextResponse with validation errors
 */
export function validateRouteParams<T>(
  schema: z.ZodSchema<T>,
  params: unknown
): { success: true; data: T } | { success: false; response: NextResponse } {
  try {
    const validated = schema.parse(params);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'Invalid route parameters',
            details: error.errors.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          },
          { status: 400 }
        ),
      };
    }
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid route parameters' },
        { status: 404 }
      ),
    };
  }
}
