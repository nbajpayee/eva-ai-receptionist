import { NextRequest, NextResponse } from "next/server";
import { getBackendAuthHeaders, unauthorizedResponse } from "@/app/api/admin/_auth";
import { withCsrfProtection } from "@/lib/csrf";
import { validateRequestBody, customerUpdateSchema } from "@/lib/api-validation";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_API_BASE_URL is not configured" },
      { status: 500 }
    );
  }

  const { id: customerId } = await context.params;
  const proxyUrl = new URL(`/api/admin/customers/${customerId}`, baseUrl);

  try {
    const authHeaders = await getBackendAuthHeaders();
    if (!authHeaders) {
      return unauthorizedResponse();
    }

    const response = await fetch(proxyUrl.toString(), {
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
          error: "Failed to fetch customer from FastAPI backend",
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

const putHandler = async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_API_BASE_URL is not configured" },
      { status: 500 }
    );
  }

  const { id: customerId } = await context.params;
  const proxyUrl = new URL(`/api/admin/customers/${customerId}`, baseUrl);

  try {
    const authHeaders = await getBackendAuthHeaders();
    if (!authHeaders) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const validation = await validateRequestBody(customerUpdateSchema, body);
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
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        {
          error: "Failed to update customer in FastAPI backend",
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
};

export const PUT = withCsrfProtection(putHandler);
