import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, passwordProblem } from "@/lib/auth/passwords";
import { consumeResetToken } from "@/lib/auth/reset";
import { findUserById, updatePasswordHash } from "@/lib/auth/users";

const schema = z.object({ token: z.string(), password: z.string() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const problem = passwordProblem(parsed.data.password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  // Consume first: an expired or already-used link must fail before we touch
  // any account, and consuming marks it used so it cannot be replayed.
  const userId = await consumeResetToken(parsed.data.token);
  if (!userId) {
    return NextResponse.json({ error: "This reset link is invalid or has expired. Request a new one." }, { status: 400 });
  }

  const user = await findUserById(userId);
  if (!user) return NextResponse.json({ error: "That account no longer exists." }, { status: 400 });

  await updatePasswordHash(user.id, await hashPassword(parsed.data.password));
  return NextResponse.json({ ok: true, role: user.role });
}
