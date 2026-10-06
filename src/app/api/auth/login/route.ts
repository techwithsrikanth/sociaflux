import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, needsRehash, verifyPassword } from "@/lib/auth/passwords";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, createSessionToken, sessionCookieOptions } from "@/lib/auth/session";
import { findUserByEmailWithSecret, normaliseEmail, recordLogin, updatePasswordHash } from "@/lib/auth/users";

const schema = z.object({ email: z.string(), password: z.string() });

/** Deliberately identical for "no such account" and "wrong password", so the
 *  response cannot be used to discover which emails are registered. */
const REJECTION = "That email and password do not match an account.";

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: REJECTION }, { status: 401 });

  const email = normaliseEmail(parsed.data.email);
  const user = await findUserByEmailWithSecret(email);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: REJECTION }, { status: 401 });
  }

  // Opportunistically upgrade hashes written under older cost parameters,
  // while we have the plaintext in hand.
  if (needsRehash(user.passwordHash)) {
    await updatePasswordHash(user.id, await hashPassword(parsed.data.password));
  }
  await recordLogin(user.id);

  const token = await createSessionToken({ userId: user.id, role: user.role, email: user.email, name: user.displayName, handle: user.handle });
  const response = NextResponse.json({ user: { email: user.email, role: user.role, name: user.displayName, handle: user.handle } });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_MAX_AGE_SECONDS));
  return response;
}
