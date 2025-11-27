import { NextRequest, NextResponse } from "next/server";
import {
  getBackendAuthHeaders,
  unauthorizedResponse,
} from "@/app/api/admin/_auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_API_BASE_URL is not configured" },
      { status: 500 }
    );
  }

  try {
    const { id } = await context.params;

    const authHeaders = await getBackendAuthHeaders();
    if (!authHeaders) {
      return unauthorizedResponse();
    }

    const proxyUrl = new URL(`/api/admin/appointments/detail/${id}`, baseUrl);

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
          error: "Failed to fetch appointment detail from FastAPI backend",
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
