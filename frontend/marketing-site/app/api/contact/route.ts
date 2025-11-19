import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { firstName, lastName, email, phone, practiceName } = body;

    if (!firstName || !lastName || !email || !phone || !practiceName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Option 1: Forward to Eva AI backend
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

    try {
      const response = await fetch(`${backendUrl}/api/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Backend submission failed");
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (backendError) {
      // Fallback: If backend is unavailable, log to console
      // In production, you might want to use a service like Formspree, SendGrid, or store in a database
      console.log("Demo request received:", {
        ...body,
        timestamp: new Date().toISOString(),
      });

      // Return success even if backend is down (for demo purposes)
      return NextResponse.json({
        success: true,
        message: "Thank you for your interest! We'll contact you within 24 hours.",
      });
    }
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
