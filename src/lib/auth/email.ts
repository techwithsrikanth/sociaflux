/**
 * Transactional email.
 *
 * There is no mail account baked in, so this has two modes. With
 * SOCIAFLUX_RESEND_API_KEY set it sends through Resend over plain HTTP (no SDK,
 * so nothing to install or patch). Without it, the message is written to the
 * server log instead, which is enough to test the reset flow locally and to
 * recover an account from Vercel's function logs before a provider is wired up.
 *
 * The log fallback is deliberately loud about what it is, so a production
 * deployment that forgot to configure a provider is obvious rather than silent.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function emailConfig() {
  return {
    apiKey: process.env.SOCIAFLUX_RESEND_API_KEY?.trim() || "",
    from: process.env.SOCIAFLUX_EMAIL_FROM?.trim() || "SociaFlux <onboarding@resend.dev>"
  };
}

export function isEmailConfigured() {
  return Boolean(emailConfig().apiKey);
}

export type Email = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail(email: Email): Promise<{ delivered: boolean }> {
  const { apiKey, from } = emailConfig();

  if (!apiKey) {
    console.warn(
      [
        "",
        "  [email] No SOCIAFLUX_RESEND_API_KEY set, so this email was not sent.",
        `  [email] To     : ${email.to}`,
        `  [email] Subject: ${email.subject}`,
        ...email.text.split("\n").map((line) => `  [email] ${line}`),
        ""
      ].join("\n")
    );
    return { delivered: false };
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: email.to, subject: email.subject, text: email.text })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    // Surfaced in logs, not to the caller: whether the mail went out must not
    // change the response the browser sees, or it leaks which emails exist.
    console.error(`[email] Resend returned ${response.status}: ${detail.slice(0, 300)}`);
    return { delivered: false };
  }

  return { delivered: true };
}

export function passwordResetEmail(to: string, link: string, ttlMinutes: number): Email {
  return {
    to,
    subject: "Reset your SociaFlux password",
    text: [
      "Someone asked to reset the password for this SociaFlux account.",
      "",
      "If it was you, open this link to choose a new password:",
      link,
      "",
      `The link works once and expires in ${ttlMinutes} minutes.`,
      "If it wasn't you, ignore this email — nothing has changed."
    ].join("\n")
  };
}
