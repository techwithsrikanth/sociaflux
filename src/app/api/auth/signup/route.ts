import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, passwordProblem } from "@/lib/auth/passwords";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, createSessionToken, sessionCookieOptions } from "@/lib/auth/session";
import { createUser, emailProblem, findUserByEmail, handleIsClaimed, normaliseEmail } from "@/lib/auth/users";
import { getCreator, saveCreator } from "@/lib/db/repositories";
import { emptyCreatorProfile } from "@/lib/creator-store";
import { normaliseHandle } from "@/lib/marketplace";

const schema = z.object({
  email: z.string(),
  password: z.string(),
  role: z.enum(["creator", "brand"]),
  name: z.string().optional(),
  handle: z.string().optional()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid sign-up details." }, { status: 400 });

  const { role, password } = parsed.data;
  const email = normaliseEmail(parsed.data.email);
  const name = (parsed.data.name || "").trim();

  const problem = emailProblem(email) || passwordProblem(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  if (await findUserByEmail(email)) {
    return NextResponse.json({ error: "An account already exists for that email. Sign in instead." }, { status: 409 });
  }

  let handle: string | undefined;
  if (role === "creator") {
    handle = normaliseHandle(parsed.data.handle || "");
    if (!handle || handle === "@") return NextResponse.json({ error: "Enter the Instagram handle you create under." }, { status: 400 });
    if (await handleIsClaimed(handle)) {
      return NextResponse.json({ error: "That handle already belongs to another account." }, { status: 409 });
    }
  }

  const user = await createUser({ email, passwordHash: await hashPassword(password), role, displayName: name, handle });

  // Claim or create the creator profile this account owns, so the workspace
  // has something to open rather than an empty shell.
  if (role === "creator" && handle && !(await getCreator(handle))) {
    const profile = emptyCreatorProfile(handle, name, email);
    if (profile.contact) profile.contact.email = email;
    await saveCreator(profile);
  }

  const token = await createSessionToken({ userId: user.id, role, email, handle });
  const response = NextResponse.json({ user: { email, role, name: user.displayName, handle } });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_MAX_AGE_SECONDS));
  return response;
}
