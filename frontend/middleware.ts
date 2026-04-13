import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function sanitizeNextPath(path: string | null): string {
  const candidate = String(path || "").trim();

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return "";
  }

  return candidate;
}

function hasAuthToken(request: NextRequest): boolean {
  const token = request.cookies.get("app_auth_token")?.value;
  return Boolean(token && token.trim().length > 0);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoggedIn = hasAuthToken(request);

  if (pathname.startsWith("/portal/customer") && !isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    loginUrl.searchParams.set("role", "customer");
    return NextResponse.redirect(loginUrl);
  }

  if ((pathname.startsWith("/portal/admin") || pathname.startsWith("/portal/superadmin")) && !isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    loginUrl.searchParams.set("role", pathname.startsWith("/portal/superadmin") ? "superadmin" : "admin");
    return NextResponse.redirect(loginUrl);
  }

  if ((pathname === "/login" || pathname === "/signup") && isLoggedIn) {
    const requestedNext = sanitizeNextPath(request.nextUrl.searchParams.get("next"));

    if (requestedNext) {
      return NextResponse.redirect(new URL(requestedNext, request.url));
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*", "/login", "/signup"],
};
