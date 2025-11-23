import { NextRequest, NextResponse } from "next/server";
import { getBackendAuthHeaders, unauthorizedResponse } from "@/app/api/admin/_auth";
import { withCsrfProtection } from "@/lib/csrf";
import { validateRequestBody, appointmentCreateSchema } from "@/lib/api-validation";

export async function GET(request: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_API_BASE_URL is not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const proxyUrl = new URL("/api/appointments", baseUrl);

  // Forward all query parameters
  searchParams.forEach((value, key) => {
    proxyUrl.searchParams.set(key, value);
  });

  try {
    const authHeaders = await getBackendAuthHeaders();
    if (!authHeaders) {
      return unauthorizedResponse();
    }

    const response = await fetch(proxyUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        {
          error: "Failed to fetch appointments from FastAPI backend",
          status: response.status,
          details: errorBody,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error connecting to FastAPI backend",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}

export const POST = withCsrfProtection(async (request: NextRequest) => {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_API_BASE_URL is not configured" },
      { status: 500 }
    );
  }

  const proxyUrl = new URL("/api/admin/appointments", baseUrl);

  try {
    const authHeaders = await getBackendAuthHeaders();
    if (!authHeaders) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const validation = await validateRequestBody(appointmentCreateSchema, body);
    if (!validation.success) {
      return validation.response;
    }

    // Build query params from validated body
    const searchParams = new URLSearchParams();
    Object.entries(validation.data).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        searchParams.append(key, String(value));
      }
    });

    const response = await fetch(`${proxyUrl.toString()}?${searchParams.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        {
          error: "Failed to create appointment in FastAPI backend",
          status: response.status,
          details: errorBody,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error connecting to FastAPI backend",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
});
