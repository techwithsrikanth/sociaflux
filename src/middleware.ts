/**
 * Keeps signed-out visitors out of the two workspaces, and signed-in ones off
 * the login pages.
 *
 * This is navigation, not security. It only reads the cookie signature, never
 * the database, so it stays cheap enough to run on every request. API routes
 * do their own checks in src/lib/auth/guard.ts, because anyone can call them
 * directly without ever loading a page.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "@/lib/auth/session";

const LOGIN_PAGES = ["/creator/login", "/brand/login"];

/** Where each role lands when it opens the app already signed in. */
const HOME: Record<string, string> = { creator: "/creator/onboarding", brand: "/brand/onboarding" };

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (LOGIN_PAGES.includes(pathname)) {
    if (!session) return NextResponse.next();
    return NextResponse.redirect(new URL(HOME[session.role] || "/", request.url));
  }

  if (!session) {
    const login = new URL(pathname.startsWith("/brand") ? "/brand/login" : "/creator/login", request.url);
    // So the login page can send them where they were going.
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  // A creator following a stale link into the brand workspace, or vice versa.
  const area = pathname.startsWith("/brand") ? "brand" : "creator";
  if (session.role !== area) {
    return NextResponse.redirect(new URL(HOME[session.role] || "/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/creator/:path*", "/brand/:path*"]
};
