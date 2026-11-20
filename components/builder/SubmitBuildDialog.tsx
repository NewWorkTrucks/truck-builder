"use client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { paintTargets, type Build } from "@/lib/builder";
import { useBuilderStore } from "@/lib/builder-store";
import { getCategory, getUpfit, getVehicle } from "@/lib/catalog";
import {
  submitBuild,
  type BuildSubmission,
  type CustomerDetails,
} from "@/lib/submit-build";
import PaintChip from "./PaintChip";
import { useState, type FormEvent } from "react";

type FieldSpec = {
  name: keyof CustomerDetails;
  label: string;
  type?: string;
  autoComplete?: string;
  optional?: boolean;
  /** Spans both columns on wider screens. */
  wide?: boolean;
};

const CONTACT_FIELDS: FieldSpec[] = [
  { name: "firstName", label: "First name", autoComplete: "given-name" },
  { name: "lastName", label: "Last name", autoComplete: "family-name" },
  { name: "phone", label: "Phone number", type: "tel", autoComplete: "tel" },
  {
    name: "email",
    label: "Email address",
    type: "email",
    autoComplete: "email",
  },
  { name: "companyName", label: "Company name", autoComplete: "organization" },
  { name: "industry", label: "Industry" },
  { name: "purchaseMethod", label: "Purchase method" },
  { name: "purchaseTime", label: "Purchase time" },
];

const ADDRESS_FIELDS: FieldSpec[] = [
  {
    name: "addressLine1",
    label: "Address line 1",
    autoComplete: "address-line1",
    wide: true,
  },
  {
    name: "addressLine2",
    label: "Address line 2",
    autoComplete: "address-line2",
    optional: true,
    wide: true,
  },
  { name: "city", label: "City", autoComplete: "address-level2" },
  { name: "state", label: "State", autoComplete: "address-level1" },
  { name: "zipCode", label: "Zip code", autoComplete: "postal-code" },
  { name: "country", label: "Country", autoComplete: "country-name" },
];

const CALLBACK_FIELD: FieldSpec = {
  name: "callbackTime",
  label: "Best callback time",
  wide: true,
};

function TextField({
  name,
  label,
  type,
  autoComplete,
  optional,
  wide,
}: FieldSpec) {
  return (
    <label className={wide ? "sm:col-span-2" : undefined}>
      <span className="mb-1.5 block text-base font-medium">
        {label}
        {optional && (
          <span className="font-normal text-muted-foreground"> (optional)</span>
        )}
      </span>
      <Input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={!optional}
        className="h-12 text-base"
      />
    </label>
  );
}

function BuildSummary({ build }: { build: Build }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h3 className="text-base font-semibold uppercase tracking-wider text-muted-foreground">
        Your build
      </h3>
      <p className="mt-2 font-bold">{getVehicle(build.vehicleId)?.name}</p>
      {build.upfitIds.length ? (
        <ul className="mt-2 divide-y text-base">
          {build.upfitIds.map((id) => {
            const upfit = getUpfit(id);
            return (
              <li key={id} className="flex justify-between gap-4 py-1.5">
                <span>{upfit?.name ?? id}</span>
                <span className="text-muted-foreground">
                  {upfit && getCategory(upfit.category).label}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-1 text-base text-muted-foreground">
          Stock vehicle, no upfits.
        </p>
      )}
      <ul className="mt-2 divide-y border-t text-base">
        {paintTargets(build).map(({ id, label, color }) => (
          <li key={id} className="flex justify-between gap-4 py-1.5">
            <span>{label}</span>
            <span className="flex items-center gap-2">
              <PaintChip hex={color.hex} />
              {color.name}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The build's colors as sales receives them: names and hex values, keyed by part name. */
const paintSpec = (build: Build): BuildSubmission["build"]["paint"] => {
  const [vehicle, ...upfits] = paintTargets(build);
  const spec = ({ color }: { color: { name: string; hex: string } }) => ({
    name: color.name,
    hex: color.hex,
  });
  return {
    vehicle: spec(vehicle),
    upfits: upfits.map((t) => ({ upfit: t.upfit!.name, ...spec(t) })),
  };
};

/** Mounted only while the dialog is open, so it starts fresh every time. */
function SubmitBuildForm({
  onClose,
  onSubmitted,
}: {
  onClose: () => void;
  onSubmitted: (requestId?: string) => void;
}) {
  const build = useBuilderStore((s) => s.build);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const customer = Object.fromEntries(
      new FormData(e.currentTarget),
    ) as CustomerDetails;
    setSubmitting(true);
    setError(false);
    try {
      const { requestId } = await submitBuild({
        build: {
          vehicle: getVehicle(build.vehicleId)?.name ?? build.vehicleId,
          upfits: build.upfitIds.map((id) => getUpfit(id)?.name ?? id),
          paint: paintSpec(build),
        },
        customer: {
          ...customer, 
          deliveryAddress: `${customer.addressLine1}${customer.addressLine2 ? `, ${customer.addressLine2}` : ""}, ${customer.city}, ${customer.state} ${customer.zipCode}, ${customer.country}`,  
        },
      });
      onSubmitted(requestId);
    } catch {
      setError(true);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-6">
      <BuildSummary build={build} />

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-base font-semibold uppercase tracking-wider text-muted-foreground">
          Your details
        </legend>
        {CONTACT_FIELDS.map((f) => (
          <TextField key={f.name} {...f} />
        ))}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-base font-semibold uppercase tracking-wider text-muted-foreground">
          Delivery address
        </legend>
        {ADDRESS_FIELDS.map((f) => (
          <TextField key={f.name} {...f} />
        ))}
      </fieldset>

      <fieldset className="grid gap-4">
        <TextField {...CALLBACK_FIELD} wide={false} />
      </fieldset>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            Something went wrong sending your build. Please try again.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-12 px-5 text-base"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="h-12 px-5 text-base"
          disabled={submitting}
        >
          {submitting ? "Submitting…" : "Submit build"}
        </Button>
      </div>
    </form>
  );
}

export default function SubmitBuildDialog({
  open,
  onOpenChange,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the quote was sent and the dialog closed, with its request id if known. */
  onSubmitted: (requestId?: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Submit your build</DialogTitle>
        <DialogDescription>
          This sends your build to our team for a quote. It isn&apos;t a purchase or reservation: our
          team confirms pricing and availability with you.
        </DialogDescription>
        <SubmitBuildForm
          onClose={() => onOpenChange(false)}
          onSubmitted={(requestId) => {
            onOpenChange(false);
            onSubmitted(requestId);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
