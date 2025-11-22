import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function getBackendAuthHeaders() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  if (!accessToken) {
    return null;
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  } as Record<string, string>;
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Not authenticated" },
    { status: 401 }
  );
}
