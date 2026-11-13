import BuilderHeader from "@/components/builder/BuilderHeader";
import { findQuoteLog, quoteLogToBuild, type QuoteLog } from "@/lib/quote-log";
import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
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

export default async function PreviewPage({ searchParams }: PageProps<"/preview">) {
  const { ref } = await searchParams;
  const value = typeof ref === "string" ? ref.trim() : "";
  if (!value) {
    return <QuoteError title="No quote ID" message="Enter a request ID to preview a quote." />;
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
    />
  );
}
