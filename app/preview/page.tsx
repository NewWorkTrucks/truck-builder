import BuilderHeader from "@/components/builder/BuilderHeader";
import { hasAccess } from "@/lib/quote-access";
import { findQuoteLog, quoteLogToBuild, type QuoteLog } from "@/lib/quote-log";
import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { verifyQuote } from "./actions";
import PreviewClient from "./PreviewClient";

export const metadata: Metadata = { title: "Quote preview | NWT Truck Builder" };

function QuoteError({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex h-dvh w-full flex-col">
      <BuilderHeader title="Quote preview" />
      <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-primary/10 to-background p-4">
        <div
          role="alert"
          className="w-full max-w-md rounded-2xl border bg-background p-6 text-center shadow-sm"
        >
          <CircleAlert aria-hidden className="mx-auto size-10 text-destructive" />
          <h2 className="mt-4 text-xl font-extrabold tracking-tight">{title}</h2>
          <p className="mt-2 text-base text-muted-foreground">{message}</p>
          <Link
            href="/#track-quote"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}

const field =
  "min-h-12 w-full rounded-lg border bg-background px-4 text-base outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50";

/** Asks for the request ID and the email on the quote before showing anything from it. */
function VerifyQuote({ requestId, status }: { requestId: string; status?: "denied" | "error" }) {
  return (
    <div className="flex h-dvh w-full flex-col">
      <BuilderHeader title="Quote preview" />
      <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-primary/10 to-background p-4">
        <form
          action={verifyQuote}
          className="flex w-full max-w-md flex-col gap-4 rounded-2xl border bg-background p-6 shadow-sm"
        >
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">See your quoted build</h2>
            <p className="mt-1 text-base text-muted-foreground">
              Enter your request ID and the email you used on the quote.
            </p>
          </div>
          {status && (
            <p role="alert" className="flex gap-2 text-base text-destructive">
              <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
              {status === "denied"
                ? "We couldn't find a quote with that request ID and email. Check both and try again."
                : "We couldn't check your quote right now. Please try again later."}
            </p>
          )}
          <label className="flex flex-col gap-1.5 text-base font-medium">
            Request ID
            <input name="ref" required maxLength={64} autoComplete="off" defaultValue={requestId} placeholder="e.g. TB-20005" className={field} />
          </label>
          <label className="flex flex-col gap-1.5 text-base font-medium">
            Email
            <input name="email" type="email" required autoComplete="email" className={field} />
          </label>
          <button
            type="submit"
            className="min-h-12 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            View my build
          </button>
        </form>
      </main>
    </div>
  );
}

export default async function PreviewPage({ searchParams }: PageProps<"/preview">) {
  const { ref, printable, denied, error } = await searchParams;
  const value = typeof ref === "string" ? ref.trim() : "";
  // Nothing about a quote, not even whether it exists, before its ID and email were matched.
  let allowed = false;
  try {
    allowed = !!value && (await hasAccess(value));
  } catch (e) {
    console.error("Quote access check failed:", e);
    return <VerifyQuote requestId={value} status="error" />;
  }
  if (!allowed) {
    return <VerifyQuote requestId={value} status={denied ? "denied" : error ? "error" : undefined} />;
  }

  let log: QuoteLog | null;
  try {
    log = await findQuoteLog(value);
  } catch (error) {
    console.error("Quote lookup failed:", error);
    return <QuoteError title="Something went wrong" message="We couldn't load this quote right now. Please try again later." />;
  }

  if (!log) {
    return <QuoteError title="Quote not found" message={`We couldn't find a quote for “${value}”. Check the ID and try again.`} />;
  }
  // Private quotes never leave the server.
  if (!log.public) {
    return <QuoteError title="This quote isn't public" message="The owner of this quote hasn't made it available for preview." />;
  }
  const build = quoteLogToBuild(log);
  if (!build) {
    return <QuoteError title="Truck unavailable" message={`${log.truck_name} is no longer offered in the builder, so this quote can't be shown in 3D.`} />;
  }

  // Only the fields the details card shows.
  const { request_id, truck_name, upfit_requirements, paint, profile, deliveryAddress, created_at } = log;
  return (
    <PreviewClient
      build={build}
      quote={{ request_id, truck_name, upfit_requirements, paint, profile, deliveryAddress, created_at }}
      printable={printable === "true"}
    />
  );
}
