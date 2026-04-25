import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on the new auth-aware home + auth routes only.
  // Legacy routes (/history, /video, /api) keep working off SQLite for now;
  // they'll move under auth in Week 3 when db.ts is ported.
  matcher: ["/", "/login", "/auth/:path*"],
};
