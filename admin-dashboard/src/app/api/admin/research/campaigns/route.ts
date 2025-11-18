import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const queryString = searchParams.toString();
  const url = `${BACKEND_URL}/api/admin/research/campaigns${queryString ? `?${queryString}` : ""}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying request:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = `${BACKEND_URL}/api/admin/research/campaigns`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying request:", error);
    return NextResponse.json({ success: false, error: "Failed to create campaign" }, { status: 500 });
  }
}
