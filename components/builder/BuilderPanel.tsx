"use client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { paintTargets, previewToggle, type Build, type PaintTarget } from "@/lib/builder";
import { useBuilderStore } from "@/lib/builder-store";
import {
  CATEGORIES,
  VEHICLES,
  getUpfit,
  getVehicle,
  upfitsForVehicle,
  vehiclePaints,
  type Upfit,
} from "@/lib/catalog";
import PaintChip from "@/components/builder/PaintChip";
import SubmitBuildDialog from "@/components/builder/SubmitBuildDialog";
import { Button } from "@/components/ui/button";
import { getPaintColor, type PaintColorId } from "@/lib/paint";
import { ChevronDown, CircleCheck, Info, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

/** Radio value for "no upfit installed" in an exclusive category. */
const NONE = "__none__";

const nameList = (ids: string[]) =>
  ids.map((id) => getUpfit(id)?.name ?? id).join(", ");

/** What picking an upfit implies, shown under its name before the click. */
const upfitHint = (build: Build, upfit: Upfit, isOn: boolean) => {
  const { adds, removes } = previewToggle(build, upfit.id);
  const effects = isOn
    ? [removes.length && `Also removes ${nameList(removes)}`]
    : [
        adds.length && `Also adds ${nameList(adds)}`,
        removes.length && `Replaces ${nameList(removes)}`,
      ];
  // Missing requirements already show up as "Also adds".
  const needs =
    !adds.length &&
    upfit.requires?.length &&
    `Requires ${nameList(upfit.requires)}`;
  return [needs, ...effects].filter(Boolean).join(" · ") || undefined;
};

/** Name plus the side effects of picking it, used inside menu items. */
function OptionLabel({ name, hint }: { name: string; hint?: string }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-lg font-medium">{name}</span>
      {hint && <span className="text-base text-muted-foreground">{hint}</span>}
    </span>
  );
}

function Field({
  title,
  aside,
  value,
  paint,
  children,
}: {
  title: string;
  aside?: string;
  value: string;
  /** Color pickers for what this field selects, shown beside its dropdown. */
  paint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-baseline justify-between text-base font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
        {aside && <span className="font-normal normal-case">{aside}</span>}
      </h2>
      <div className="flex gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex min-h-12 min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2 text-left text-lg font-semibold transition-colors outline-none hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:border-primary">
          <span className="truncate">{value}</span>
          <ChevronDown className="size-5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-(--anchor-width) rounded-xl p-1.5">
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
      {paint}
      </div>
    </section>
  );
}

const itemClassName = "min-h-12 rounded-lg py-2";

/**
 * Color dropdown for one painted part: the vehicle's factory colors, each a
 * swatch with its name (several whites look alike as swatches alone). The
 * selected one shows a check mark.
 */
function PaintDropdown({
  target,
  offered,
  onChange,
}: {
  target: PaintTarget;
  offered: readonly PaintColorId[];
  onChange: (color: PaintColorId) => void;
}) {
  const current = `${target.label}: ${target.color.name}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={current}
        title={current}
        className="flex size-12 shrink-0 items-center justify-center rounded-xl border bg-card transition-colors outline-none hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:border-primary"
      >
        <PaintChip hex={target.color.hex} className="size-7" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-max rounded-xl p-1.5">
        <DropdownMenuRadioGroup
          value={target.color.id}
          onValueChange={(id) => onChange(id as PaintColorId)}
        >
          {offered.map(getPaintColor).map(
            (color) =>
              color && (
                <DropdownMenuRadioItem
                  key={color.id}
                  value={color.id}
                  closeOnClick
                  className="min-h-12 gap-3 rounded-lg py-2 pr-9 text-base whitespace-nowrap"
                >
                  <PaintChip hex={color.hex} className="size-8" />
                  {color.name}
                </DropdownMenuRadioItem>
              ),
          )}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** How long the "quote sent" confirmation stays visible when it has no request id to keep. */
const QUOTE_SENT_MS = 8000;

/**
 * The build's options and the submit action.
 *
 * Wide layouts (see globals.css) show them as a sidebar. Compact layouts
 * (phones upright) show a one-line summary bar with "Edit options" and
 * "Submit"; editing (`sheetOpen`) swaps the bar for the options, so the
 * truck stays in view above them.
 */
export default function BuilderPanel({
  sheetOpen,
  onSheetOpenChange,
}: {
  sheetOpen: boolean;
  onSheetOpenChange: (open: boolean) => void;
}) {
  const build = useBuilderStore((s) => s.build);
  const notices = useBuilderStore((s) => s.notices);
  const onChangeVehicle = useBuilderStore((s) => s.changeVehicle);
  const onToggleUpfit = useBuilderStore((s) => s.toggleUpfit);
  const onSetPaint = useBuilderStore((s) => s.setPaint);
  const onDismissNotices = useBuilderStore((s) => s.dismissNotices);
  const available = upfitsForVehicle(build.vehicleId);
  const installed = new Set(build.upfitIds);
  const [vehiclePaint, ...upfitPaint] = paintTargets(build);
  const paintFor = (targets: PaintTarget[]) =>
    targets.length ? (
      targets.map((t) => (
        <PaintDropdown
          key={t.id}
          target={t}
          offered={vehiclePaints(build.vehicleId)}
          onChange={(color) => onSetPaint(t.id, color)}
        />
      ))
    ) : undefined;

  const [submitOpen, setSubmitOpen] = useState(false);
  // The sent quote; its request id stays on screen until dismissed, so it can be noted down.
  const [quoteSent, setQuoteSent] = useState<{ requestId?: string } | null>(null);

  useEffect(() => {
    if (!quoteSent || quoteSent.requestId) return;
    const id = setTimeout(() => setQuoteSent(null), QUOTE_SENT_MS);
    return () => clearTimeout(id);
  }, [quoteSent]);

  return (
    <div className="flex min-h-full flex-col">
      <div id="builder-options" className={`flex flex-col gap-5 p-5 ${sheetOpen ? "" : "compact:hidden"}`}>
        <Field
          title="Vehicle"
          value={getVehicle(build.vehicleId)?.name ?? ""}
          paint={paintFor([vehiclePaint])}
        >
          <DropdownMenuRadioGroup
            value={build.vehicleId}
            onValueChange={(id) => onChangeVehicle(id as string)}
          >
            {VEHICLES.map((v) => (
              <DropdownMenuRadioItem
                key={v.id}
                value={v.id}
                closeOnClick
                className={itemClassName}
              >
                <OptionLabel name={v.name} />
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </Field>

        {notices.length > 0 && (
          <Alert role="status" className="border-primary/30 bg-primary/5 pr-14 text-base">
            <Info className="text-primary" />
            <AlertDescription>
              <ul className="space-y-0.5">
                {notices.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </AlertDescription>
            <button
              onClick={onDismissNotices}
              aria-label="Dismiss"
              className="absolute top-0 right-0 flex size-12 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </Alert>
        )}

        {CATEGORIES.map((category) => {
          const items = available.filter((u) => u.category === category.id);
          if (!items.length) return null;
          const selected = items.filter((u) => installed.has(u.id));
          const label = selected.length
            ? nameList(selected.map((u) => u.id))
            : "None";

          return (
            <Field
              key={category.id}
              title={category.label}
              aside={category.exclusive ? "Choose one" : "Choose any"}
              value={label}
              paint={paintFor(upfitPaint.filter((t) => t.upfit!.category === category.id))}
            >
              {category.exclusive ? (
                <DropdownMenuRadioGroup
                  value={selected[0]?.id ?? NONE}
                  onValueChange={(value) => {
                    if (value === NONE) {
                      if (selected[0]) onToggleUpfit(selected[0].id);
                    } else {
                      onToggleUpfit(value as string);
                    }
                  }}
                >
                  <DropdownMenuRadioItem
                    value={NONE}
                    closeOnClick
                    className={itemClassName}
                  >
                    <OptionLabel name="None" />
                  </DropdownMenuRadioItem>
                  {items.map((upfit) => (
                    <DropdownMenuRadioItem
                      key={upfit.id}
                      value={upfit.id}
                      closeOnClick
                      className={itemClassName}
                    >
                      <OptionLabel
                        name={upfit.name}
                        hint={upfitHint(build, upfit, installed.has(upfit.id))}
                      />
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              ) : (
                items.map((upfit) => (
                  <DropdownMenuCheckboxItem
                    key={upfit.id}
                    checked={installed.has(upfit.id)}
                    onCheckedChange={() => onToggleUpfit(upfit.id)}
                    className={itemClassName}
                  >
                    <OptionLabel
                      name={upfit.name}
                      hint={upfitHint(build, upfit, installed.has(upfit.id))}
                    />
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </Field>
          );
        })}

      </div>

      <section className="sticky bottom-0 mt-auto border-t bg-background/95 p-5 backdrop-blur compact:px-4 compact:py-3 max-lg:landscape:static">
        {quoteSent && (
          <Alert role="status" className="mb-4 border-primary/30 bg-primary/5 pr-14 text-base compact:mb-3">
            <CircleCheck className="text-primary" />
            <AlertDescription>
              {quoteSent.requestId ? (
                <>
                  <span className="block">
                    Quote request sent. Your request ID is{" "}
                    <strong className="font-bold text-foreground">{quoteSent.requestId}</strong>. Keep it to view
                    your build later.
                  </span>
                  <a
                    href={`/preview?${new URLSearchParams({ ref: quoteSent.requestId })}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex min-h-12 items-center font-semibold text-primary underline underline-offset-4"
                  >
                    View my build
                  </a>
                </>
              ) : (
                "Quote request sent. Our team will be in touch."
              )}
            </AlertDescription>
            <button
              onClick={() => setQuoteSent(null)}
              aria-label="Dismiss"
              className="absolute top-0 right-0 flex size-12 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </Alert>
        )}
        {/* Compact: the summary bar, or Done while the options are open. */}
        <div className="flex items-center gap-2 wide:hidden">
          {sheetOpen ? (
            <Button onClick={() => onSheetOpenChange(false)} className="h-12 flex-1 text-base">
              Done
            </Button>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold">{getVehicle(build.vehicleId)?.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {build.upfitIds.length ? nameList(build.upfitIds) : "No upfits"}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => onSheetOpenChange(true)}
                aria-expanded={false}
                aria-controls="builder-options"
                className="h-12 px-3 text-base"
              >
                <SlidersHorizontal /> Edit
              </Button>
              <Button onClick={() => setSubmitOpen(true)} className="h-12 px-4 text-base">
                Submit
              </Button>
            </>
          )}
        </div>
        <div className="flex flex-col gap-1.5 compact:hidden">
          <Button onClick={() => setSubmitOpen(true)} className="h-12 px-5 text-base">
            Submit New Build
          </Button>
          <p className="text-center text-sm text-muted-foreground">Free quote. No purchase or commitment.</p>
        </div>
        <SubmitBuildDialog
          open={submitOpen}
          onOpenChange={setSubmitOpen}
          onSubmitted={(requestId) => setQuoteSent({ requestId })}
        />
      </section>
    </div>
  );
}
