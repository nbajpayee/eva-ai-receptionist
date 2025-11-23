import { NextRequest, NextResponse } from "next/server";
import { getBackendAuthHeaders, unauthorizedResponse } from "@/app/api/admin/_auth";
import { withCsrfProtection } from "@/lib/csrf";
import { validateRequestBody, providerUpdateSchema } from "@/lib/api-validation";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeaders = await getBackendAuthHeaders();
    if (!authHeaders) {
      return unauthorizedResponse();
    }

    const { id } = await context.params;
    const response = await fetch(`${baseUrl}/api/admin/providers/${id}`, {
      headers: { "Content-Type": "application/json", ...authHeaders },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: "Failed to fetch provider", details: errorBody },
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

const putHandler = async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    const authHeaders = await getBackendAuthHeaders();
    if (!authHeaders) {
      return unauthorizedResponse();
    }

    const { id } = await context.params;
    const body = await request.json();
    const validation = await validateRequestBody(providerUpdateSchema, body);
    if (!validation.success) {
      return validation.response;
    }

    const response = await fetch(`${baseUrl}/api/admin/providers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(validation.data),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: "Failed to update provider", details: errorBody },
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
};

export const PUT = withCsrfProtection(putHandler);

const deleteHandler = async (
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    const authHeaders = await getBackendAuthHeaders();
    if (!authHeaders) {
      return unauthorizedResponse();
    }

    const { id } = await context.params;
    const response = await fetch(`${baseUrl}/api/admin/providers/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeaders },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: "Failed to delete provider", details: errorBody },
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
};

export const DELETE = withCsrfProtection(deleteHandler);
