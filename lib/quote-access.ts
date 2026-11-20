import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { QuoteLog } from "./quote-log";

/**
 * Who may open a quote's preview: someone who entered its request ID together
 * with the email on the quote. A match is remembered in this browser by a
 * signed, http-only cookie per quote, so the email never travels in a URL.
 *
 * Server only. The signing secret is `QUOTE_ACCESS_SECRET`; without it nobody
 * is let in (fail closed).
 */

/** How long a verified quote stays open in this browser. */
const ACCESS_SECONDS = 12 * 60 * 60;

const cookieName = (ref: string) => `quote_${ref}`;

function secret() {
  const s = process.env.QUOTE_ACCESS_SECRET;
  if (!s) throw new Error("QUOTE_ACCESS_SECRET is not configured");
  return s;
}

const sign = (ref: string, expires: number) =>
  createHmac("sha256", secret()).update(`${ref}.${expires}`).digest("base64url");

/** The quote's email matches the one entered, ignoring case and surrounding spaces. */
export const emailMatches = (log: QuoteLog, email: string) =>
  log.profile.email.trim().toLowerCase() === email.trim().toLowerCase();

/** Opens `ref` in this browser. Call only from a Server Function, after `emailMatches`. */
export async function grantAccess(ref: string) {
  const expires = Math.floor(Date.now() / 1000) + ACCESS_SECONDS;
  (await cookies()).set(cookieName(ref), `${expires}.${sign(ref, expires)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/preview",
    maxAge: ACCESS_SECONDS,
  });
}

/** Whether this browser verified `ref` and the grant hasn't expired or been altered. */
export async function hasAccess(ref: string) {
  const value = (await cookies()).get(cookieName(ref))?.value;
  if (!value) return false;
  const [expiresText, mac] = value.split(".");
  const expires = Number(expiresText);
  if (!Number.isInteger(expires) || expires < Date.now() / 1000 || !mac) return false;
  const expected = Buffer.from(sign(ref, expires));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
