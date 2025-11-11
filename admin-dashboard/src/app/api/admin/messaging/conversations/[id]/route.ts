import { NextResponse } from "next/server";

type RouteContext = {
  params?: { id: string } | Promise<{ id: string }>;
};

async function resolveParams(context: RouteContext): Promise<{ id: string }> {
  if (!context?.params) {
    throw new Error("Route params unavailable");
  }

  return await context.params;
}

export async function GET(request: Request, context: RouteContext) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_API_BASE_URL is not configured" },
      { status: 500 }
    );
  }

  const { id } = await resolveParams(context);
  const proxyUrl = new URL(`/api/admin/messaging/conversations/${id}`, baseUrl);

  try {
    const response = await fetch(proxyUrl.toString(), {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        {
          error: "Failed to fetch conversation from FastAPI backend",
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
