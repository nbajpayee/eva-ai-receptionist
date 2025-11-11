import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_API_BASE_URL is not configured" },
      { status: 500 }
    );
  }

  const proxyUrl = new URL("/api/admin/messaging/send", baseUrl);

  try {
    const response = await fetch(proxyUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: await request.text(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        {
          error: "Failed to send message via FastAPI backend",
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
