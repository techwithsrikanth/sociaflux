/**
 * Signed session cookies.
 *
 * The session is a signed value rather than a database row, so verifying it
 * costs no query and middleware can check it on every request. The trade is
 * that a session cannot be revoked server-side before it expires; rotating
 * SOCIAFLUX_SESSION_SECRET invalidates every session at once, which is the
 * blunt instrument available if one is ever leaked.
 *
 * Signing uses Web Crypto rather than node:crypto so the same code runs in
 * middleware on the edge runtime, where node:crypto is unavailable.
 */

export const SESSION_COOKIE = "sociaflux_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type SessionRole = "creator" | "brand";

export type Session = {
  userId: string;
  role: SessionRole;
  email: string;
  /** Creators only: the profile this account owns. */
  handle?: string;
};

type SessionPayload = Session & { exp: number };

/**
 * Falls back to a fixed development secret so the app runs with no config,
 * matching how the database falls back to a local file. Production without a
 * real secret is a genuine problem, so it says so loudly rather than quietly
 * signing sessions anyone could forge.
 */
let warned = false;
function secret() {
  const configured = process.env.SOCIAFLUX_SESSION_SECRET?.trim();
  if (configured) return configured;

  if (!warned) {
    warned = true;
    const message = "SOCIAFLUX_SESSION_SECRET is not set. Sessions are signed with a public development key.";
    if (process.env.NODE_ENV === "production") console.error(`[auth] ${message} Set it before taking real sign-ups.`);
    else console.warn(`[auth] ${message}`);
  }
  return "sociaflux-development-session-secret-not-for-production";
}

function base64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function key() {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function sign(payload: string) {
  const signature = await crypto.subtle.sign("HMAC", await key(), new TextEncoder().encode(payload));
  return base64url(new Uint8Array(signature));
}

/** Constant-time, so a forged cookie cannot be refined one byte at a time. */
function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

export async function createSessionToken(session: Session, maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
  const payload: SessionPayload = { ...session, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds };
  const encoded = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${encoded}.${await sign(encoded)}`;
}

export async function readSessionToken(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!equal(signature, await sign(encoded))) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(encoded))) as SessionPayload;
    if (!payload.userId || !payload.role) return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return { userId: payload.userId, role: payload.role, email: payload.email, handle: payload.handle };
  } catch {
    return null;
  }
}

/** The attributes the cookie is set with, shared by the login and logout routes. */
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  };
}
