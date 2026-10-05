import { NextResponse } from "next/server";
import { z } from "zod";
import { passwordResetEmail, sendEmail } from "@/lib/auth/email";
import { RESET_TOKEN_TTL_MINUTES, createResetToken } from "@/lib/auth/reset";
import { findUserByEmail, normaliseEmail } from "@/lib/auth/users";

const schema = z.object({ email: z.string() });

// One message regardless of whether the account exists, so this cannot be used
// to find out which emails are registered.
const ACKNOWLEDGEMENT =
  "If an account exists for that email, a reset link is on its way. Check your inbox.";

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: ACKNOWLEDGEMENT });

  const email = normaliseEmail(parsed.data.email);
  const user = await findUserByEmail(email);

  if (user) {
    const token = await createResetToken(user.id);
    const origin = new URL(request.url).origin;
    const link = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
    await sendEmail(passwordResetEmail(user.email, link, RESET_TOKEN_TTL_MINUTES));
  }

  return NextResponse.json({ message: ACKNOWLEDGEMENT });
}
