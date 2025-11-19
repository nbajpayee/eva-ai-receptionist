import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET() {
  const url = `${BACKEND_URL}/api/admin/research/segments/templates`;

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
    return NextResponse.json({ success: false, error: "Failed to fetch segment templates" }, { status: 500 });
  }
}
