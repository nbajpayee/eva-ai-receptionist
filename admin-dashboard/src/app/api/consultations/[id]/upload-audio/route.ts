import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const formData = await request.formData();
  const { id } = await context.params;

  try {
    const response = await fetch(
      `${baseUrl}/api/consultations/${id}/upload-audio`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: "Failed to upload audio", details: errorBody },
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
