import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // maxAge 0 expires it immediately; the attributes must otherwise match the
  // ones it was set with, or the browser keeps the original cookie.
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}
