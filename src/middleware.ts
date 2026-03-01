import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

const PLAYTEST_COOKIE_NAME = "moviegames_playtest_access";
const PLAYTEST_COOKIE_VALUE = "1";
const PLAYTEST_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function guardPlaytestRoutes(request: NextRequest): NextResponse | null {
  if (!request.nextUrl.pathname.startsWith("/playtest")) {
    return null;
  }

  if (isLocalHost(request.nextUrl.hostname)) {
    return null;
  }

  if (request.cookies.get(PLAYTEST_COOKIE_NAME)?.value === PLAYTEST_COOKIE_VALUE) {
    return null;
  }

  const accessKey = process.env.PLAYTEST_ACCESS_KEY;
  const keyFromQuery = request.nextUrl.searchParams.get("key");

  if (accessKey && keyFromQuery === accessKey) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete("key");

    const response = NextResponse.redirect(cleanUrl);
    response.cookies.set({
      name: PLAYTEST_COOKIE_NAME,
      value: PLAYTEST_COOKIE_VALUE,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/playtest",
      maxAge: PLAYTEST_COOKIE_MAX_AGE_SECONDS,
    });
    return response;
  }

  return NextResponse.redirect(new URL("/", request.url));
}

export async function middleware(request: NextRequest) {
  const playtestGuardResponse = guardPlaytestRoutes(request);
  if (playtestGuardResponse) return playtestGuardResponse;

  return await updateSession(request);
}

export const config = {
  matcher: [
    // Run on all routes except static files and images
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
