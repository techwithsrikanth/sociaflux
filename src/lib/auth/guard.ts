/**
 * Server-side session checks for API routes.
 *
 * Middleware guards pages, but middleware is a redirect, not a security
 * boundary: anything that changes data or reveals private fields has to check
 * again here, because an API route can be called directly.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "./session";
import type { Session, SessionRole } from "./session";

export async function getSession(): Promise<Session | null> {
  return readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export type Guarded = { session: Session; response?: never } | { session?: never; response: NextResponse };

/**
 * Returns either a session or the response to send instead, so a route reads:
 *
 *   const guard = await requireSession("brand");
 *   if (guard.response) return guard.response;
 */
export async function requireSession(role?: SessionRole): Promise<Guarded> {
  const session = await getSession();
  if (!session) {
    return { response: NextResponse.json({ error: "Sign in to continue." }, { status: 401 }) };
  }
  if (role && session.role !== role) {
    return { response: NextResponse.json({ error: `This action is for ${role} accounts.` }, { status: 403 }) };
  }
  return { session };
}

/** A creator may only act on the profile their account owns. */
export function ownsHandle(session: Session, handle: string) {
  return session.role === "creator" && !!session.handle && session.handle === handle;
}
