import { createHmac, timingSafeEqual } from "node:crypto";
import { instagramConfig } from "./graph";

/**
 * OAuth state, signed so the callback can trust which creator started the flow.
 *
 * There is no session system here, so the handle travels in the state
 * parameter. Signing it with the app secret stops anyone forging a callback
 * that attaches their Instagram account to someone else's profile.
 */

const MAX_AGE_MS = 10 * 60 * 1000;

function sign(payload: string) {
  return createHmac("sha256", instagramConfig().appSecret).update(payload).digest("base64url");
}

export function encodeState(handle: string) {
  const payload = Buffer.from(JSON.stringify({ handle, at: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeState(state: string): { handle: string } | null {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  try {
    const { handle, at } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { handle: string; at: number };
    if (!handle || typeof at !== "number" || Date.now() - at > MAX_AGE_MS) return null;
    return { handle };
  } catch {
    return null;
  }
}
