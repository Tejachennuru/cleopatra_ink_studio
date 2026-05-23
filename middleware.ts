import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

// Routes that never require authentication
const PUBLIC_PATHS = ["/studio/login"];

// API routes — pass through without session check
const PUBLIC_PREFIXES = [
  "/_next/",
  "/favicon",
  "/cleopatra-logo",
  "/placeholder",
  "/api/generate",
  "/api/upload",
  "/api/upload-ref",
  "/api/placement",
  "/api/pinterest",
  "/api/proxy-image",
  "/api/cron",
];

function makeSupabaseClient(request: NextRequest, response: { current: NextResponse }) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response.current = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.current.cookies.set(name, value, options)
          );
        },
      },
    }
  );
}

function isSessionExpired(lastLogin: string | null): boolean {
  if (!lastLogin) return false; // null = first login, allow through
  return Date.now() - new Date(lastLogin).getTime() > SESSION_TIMEOUT_MS;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = { current: NextResponse.next({ request }) };

  // ── Public paths ─────────────────────────────────────────
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return response.current;
  }

  const supabase = makeSupabaseClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  // ── /studio/login — redirect to dashboard if already valid session ──
  if (pathname === "/studio/login") {
    if (user) {
      const { data: staff } = await supabase
        .from("staff")
        .select("role, is_active, last_login")
        .eq("id", user.id)
        .maybeSingle();

      // Only skip login if session is still within 24hr window
      if (staff && staff.is_active && !isSessionExpired(staff.last_login)) {
        const dest = staff.role === "admin" ? "/studio/admin" : "/studio/designer";
        return NextResponse.redirect(new URL(dest, request.url));
      }

      // Session expired or invalid — sign out silently and show login
      await supabase.auth.signOut();
    }
    return response.current;
  }

  // ── All other routes — require valid staff session ────────
  if (!user) {
    const loginUrl = new URL("/studio/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: staff } = await supabase
    .from("staff")
    .select("role, is_active, last_login")
    .eq("id", user.id)
    .maybeSingle();

  // Not a staff member or deactivated
  if (!staff || !staff.is_active) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/studio/login?error=access_denied", request.url));
  }

  // Session expired — sign out and redirect to login
  if (isSessionExpired(staff.last_login)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/studio/login?error=session_expired", request.url));
  }

  // Designers cannot access /studio/admin
  if (pathname.startsWith("/studio/admin") && staff.role !== "admin") {
    return NextResponse.redirect(new URL("/studio/designer", request.url));
  }

  // Root redirect based on role
  if (pathname === "/" || pathname === "/studio") {
    const dest = staff.role === "admin" ? "/studio/admin" : "/studio/designer";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return response.current;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
