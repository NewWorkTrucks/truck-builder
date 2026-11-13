"use client";
import BuilderHeader from "@/components/builder/BuilderHeader";
import PaintChip from "@/components/builder/PaintChip";
import Scene from "@/components/builder/Scene";
import SpecSheet from "@/components/builder/SpecSheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Build } from "@/lib/builder";
import { useBuilderStore } from "@/lib/builder-store";
import { submittedOn, type QuotePreview } from "@/lib/quote-log";
import { printSpecSheet } from "@/lib/spec-snapshot";
import { ClipboardList, Lightbulb, PanelRightClose, PanelRightOpen, Printer, Rotate3d, X } from "lucide-react";
import { useState } from "react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t pt-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="mt-2 text-base">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium break-all">{children}</dd>
    </div>
  );
}

/** Everything recorded with the quote; the floating card on desktop, the dialog on phones. */
function QuoteDetails({ quote }: { quote: QuotePreview }) {
  const { profile, paint } = quote;
  return (
    <div className="space-y-4">
      <dl>
        <Row label="Request ID">{quote.request_id}</Row>
        <Row label="Submitted">{submittedOn(quote.created_at)}</Row>
      </dl>
      <Section title="Truck">
        <p className="font-bold">{quote.truck_name}</p>
        {quote.upfit_requirements.length ? (
          <ul className="mt-1 divide-y">
            {quote.upfit_requirements.map((u) => (
              <li key={u} className="py-1.5">
                {u}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-muted-foreground">Stock vehicle, no upfits.</p>
        )}
      </Section>
      {paint && (
        <Section title="Paint">
          <ul className="divide-y">
            {[{ upfit: "Vehicle", ...paint.vehicle }, ...paint.upfits].map((p) => (
              <li key={p.upfit} className="flex justify-between gap-4 py-1.5">
                <span>{p.upfit}</span>
                <span className="flex items-center gap-2">
                  <PaintChip hex={p.hex} />
                  {p.name}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Customer">
        <dl>
          <Row label="Name">
            {profile.firstName} {profile.lastName}
          </Row>
          <Row label="Company">{profile.companyName}</Row>
          <Row label="Email">{profile.email}</Row>
          <Row label="Phone">{profile.phone}</Row>
        </dl>
      </Section>
      <Section title="Delivery address">
        <p>{quote.deliveryAddress}</p>
      </Section>
    </div>
  );
}

const roundButton =
  "flex min-h-12 items-center justify-center gap-2 rounded-full border bg-background/90 shadow-sm backdrop-blur transition-colors outline-none hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";

/** `printable` adds the spec sheet and its print button (`?printable=true`). */
export default function PreviewClient({
  build,
  quote,
  printable,
}: {
  build: Build;
  quote: QuotePreview;
  printable: boolean;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Desktop card; the scene narrows to sit beside it while it's open.
  const [cardOpen, setCardOpen] = useState(true);
  const specShotReady = useBuilderStore((s) => s.specShotReady);
  const lightsOn = useBuilderStore((s) => s.lightsOn);
  const setLightsOn = useBuilderStore((s) => s.setLightsOn);

  return (
    <>
      {printable && <SpecSheet build={build} quote={quote} />}
      <div className="flex h-dvh w-full flex-col print:hidden">
        <BuilderHeader title={quote.truck_name} />
        <main className="relative min-h-0 flex-1 overflow-hidden bg-gradient-to-b from-primary/10 to-background">
          <div
            className={`absolute inset-y-0 left-0 right-0 transition-[right] duration-300 motion-reduce:transition-none ${
              cardOpen ? "lg:right-[26rem]" : ""
            }`}
          >
            <Scene preview={build} />
            <p className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-base whitespace-nowrap text-muted-foreground backdrop-blur max-lg:hidden">
              <Rotate3d className="size-4" /> Drag to rotate
            </p>
            <button
              type="button"
              aria-expanded={cardOpen}
              aria-controls="quote-details-card"
              aria-label="Quote details"
              title={cardOpen ? "Hide quote details" : "Show quote details"}
              onClick={() => setCardOpen((o) => !o)}
              className={`${roundButton} absolute top-3 right-3 size-12 max-lg:hidden`}
            >
              {cardOpen ? (
                <PanelRightClose className="size-5" aria-hidden />
              ) : (
                <PanelRightOpen className="size-5" aria-hidden />
              )}
            </button>
            {/* Stacked on phones (the details button takes the bottom middle), side by side on desktop. */}
            <div className="absolute right-3 bottom-3 flex flex-col items-end gap-2 lg:flex-row">
              <button
                type="button"
                aria-pressed={lightsOn}
                aria-label="Truck lights"
                title={lightsOn ? "Turn lights off" : "Turn lights on"}
                onClick={() => setLightsOn(!lightsOn)}
                className={`${roundButton} size-12 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground`}
              >
                <Lightbulb className="size-5" aria-hidden />
              </button>
              {printable && (
                <button
                  type="button"
                  onClick={printSpecSheet}
                  disabled={!specShotReady}
                  aria-label={specShotReady ? "Print spec sheet" : "Preparing spec sheet"}
                  title={specShotReady ? "Print spec sheet" : "Preparing spec sheet…"}
                  className={`${roundButton} max-lg:size-12 lg:px-5 lg:text-base lg:font-semibold`}
                >
                  <Printer className="size-5" aria-hidden />
                  <span className="max-lg:hidden">
                    {specShotReady ? "Print spec sheet" : "Preparing spec sheet…"}
                  </span>
                </button>
              )}
            </div>
          </div>

          <aside
            id="quote-details-card"
            aria-labelledby="quote-details-title"
            hidden={!cardOpen}
            className="absolute top-4 right-4 bottom-4 w-96 overflow-y-auto rounded-2xl border bg-background/95 p-5 shadow-lg backdrop-blur max-lg:hidden"
          >
            <h2 id="quote-details-title" className="mb-4 text-xl font-extrabold tracking-tight">
              Quote details
            </h2>
            <QuoteDetails quote={quote} />
          </aside>

          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="absolute bottom-3 left-1/2 flex min-h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-6 text-base font-semibold whitespace-nowrap text-primary-foreground shadow-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
          >
            <ClipboardList className="size-5" aria-hidden /> View quote details
          </button>
          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogContent>
              <div className="mb-4 flex items-center justify-between gap-4">
                <DialogTitle>Quote details</DialogTitle>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setDetailsOpen(false)}
                  className="flex size-12 items-center justify-center rounded-full border outline-none hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <QuoteDetails quote={quote} />
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </>
  );
}
