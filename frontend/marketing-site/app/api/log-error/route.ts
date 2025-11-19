import { NextRequest, NextResponse } from "next/server";

/**
 * Error logging endpoint for client-side errors
 *
 * In production, this should forward to a proper error tracking service
 * like Sentry, LogRocket, or Bugsnag. For now, it logs to console/file.
 *
 * TODO: Integrate with proper error tracking service:
 * - Sentry: https://sentry.io/for/nextjs/
 * - LogRocket: https://logrocket.com/
 * - Bugsnag: https://www.bugsnag.com/
 */
export async function POST(request: NextRequest) {
  try {
    const errorData = await request.json();

    // Validate error data
    if (!errorData.message) {
      return NextResponse.json(
        { error: "Missing error message" },
        { status: 400 }
      );
    }

    // Log error with timestamp and context
    const logEntry = {
      timestamp: errorData.timestamp || new Date().toISOString(),
      message: errorData.message,
      stack: errorData.stack,
      digest: errorData.digest,
      userAgent: request.headers.get("user-agent"),
      url: request.headers.get("referer"),
      ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    };

    // In development, log to console
    if (process.env.NODE_ENV === "development") {
      console.error("Client Error Logged:", JSON.stringify(logEntry, null, 2));
    }

    // In production, this should forward to error tracking service
    if (process.env.NODE_ENV === "production") {
      // TODO: Forward to Sentry/LogRocket/Bugsnag
      // Example for Sentry:
      // Sentry.captureException(new Error(errorData.message), {
      //   contexts: {
      //     error: logEntry,
      //   },
      // });

      console.error("Production Error:", logEntry);
    }

    return NextResponse.json(
      { success: true, message: "Error logged successfully" },
      { status: 200 }
    );
  } catch (error) {
    // Don't let error logging errors crash the app
    console.error("Error in error logging endpoint:", error);
    return NextResponse.json(
      { error: "Failed to log error" },
      { status: 500 }
    );
  }
}
