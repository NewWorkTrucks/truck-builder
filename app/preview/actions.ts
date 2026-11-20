"use server";
import { emailMatches, grantAccess } from "@/lib/quote-access";
import { findQuoteLog } from "@/lib/quote-log";
import { redirect } from "next/navigation";

/**
 * "View my build": opens a quote when its request ID and email match. Every
 * miss (unknown ID, wrong email) gets the same answer, so the form can't be
 * used to find out which request IDs exist.
 */
export async function verifyQuote(formData: FormData) {
  const ref = String(formData.get("ref") ?? "").trim();
  const email = String(formData.get("email") ?? "");
  const back = (status: string) => `/preview?${new URLSearchParams({ ref, [status]: "1" })}`;

  let ok = false;
  try {
    const log = ref && email.trim() ? await findQuoteLog(ref) : null;
    ok = !!log && emailMatches(log, email);
    if (ok) await grantAccess(ref);
  } catch (error) {
    console.error("Quote verification failed:", error);
    redirect(back("error"));
  }
  // redirect() throws, so it stays outside the try above.
  redirect(ok ? `/preview?${new URLSearchParams({ ref })}` : back("denied"));
}
