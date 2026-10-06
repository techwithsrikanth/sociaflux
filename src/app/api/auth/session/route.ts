import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSessionToken } from "@/lib/auth/session";

/** What the browser is allowed to know about its own session. No hash, no token. */
export async function GET() {
  const session = await readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ session: null }, { status: 200 });
  return NextResponse.json({ session: { email: session.email, role: session.role, name: session.name, handle: session.handle } });
}
