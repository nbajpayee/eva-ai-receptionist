import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; action: string }> }
) {
  const { id, action } = await context.params;
  const url = `${BACKEND_URL}/api/admin/research/campaigns/${id}/${action}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying request:", error);
    return NextResponse.json(
      { success: false, error: `Failed to ${action} campaign` },
      { status: 500 }
    );
  }
}
