import { NextRequest, NextResponse } from "next/server";
import { getBackendAuthHeaders, unauthorizedResponse } from "@/app/api/admin/_auth";
import { withCsrfProtection } from "@/lib/csrf";
import { validateRequestBody, providerCreateSchema } from "@/lib/api-validation";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  try {
    const incomingUrl = new URL(request.url);
    const proxyUrl = new URL("/api/admin/providers", baseUrl);
    incomingUrl.searchParams.forEach((value, key) => {
      proxyUrl.searchParams.set(key, value);
    });

    const authHeaders = await getBackendAuthHeaders();
    if (!authHeaders) {
      return unauthorizedResponse();
    }

    const response = await fetch(proxyUrl.toString(), {
      headers: { "Content-Type": "application/json", ...authHeaders },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: "Failed to fetch providers", details: errorBody },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error connecting to backend",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}

export const POST = withCsrfProtection(async (request: NextRequest) => {
  try {
    const authHeaders = await getBackendAuthHeaders();
    if (!authHeaders) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const validation = await validateRequestBody(providerCreateSchema, body);
    if (!validation.success) {
      return validation.response;
    }

    const response = await fetch(`${baseUrl}/api/admin/providers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(validation.data),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: "Failed to create provider", details: errorBody },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error connecting to backend",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
});
