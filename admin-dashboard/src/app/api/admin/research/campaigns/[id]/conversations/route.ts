import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const url = `${BACKEND_URL}/api/admin/research/campaigns/${id}/conversations`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Ensure we always return JSON to the frontend, even if the backend body is empty
    try {
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    } catch (error) {
      console.error("Error parsing conversations response from backend:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to parse campaign conversations response from backend",
          status: response.status,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error proxying campaign conversations request:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch campaign conversations" },
      { status: 500 }
    );
  }
}
