import { NextResponse } from "next/server";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function GET(request: Request) {
  try {
    const incomingUrl = new URL(request.url);
    const proxyUrl = new URL("/api/admin/services", baseUrl);
    incomingUrl.searchParams.forEach((value, key) => {
      proxyUrl.searchParams.set(key, value);
    });

    const response = await fetch(proxyUrl.toString(), {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: "Failed to fetch services", details: errorBody },
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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch(`${baseUrl}/api/admin/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: "Failed to create service", details: errorBody },
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
