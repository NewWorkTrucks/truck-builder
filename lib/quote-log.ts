import { upfitsForVehicle, VEHICLES } from "./catalog";
import type { Build } from "./builder";
import { DEFAULT_PAINT, PAINT_COLORS, type Paint, type PaintColorId } from "./paint";
import type { PaintSpec } from "./submit-build";

/** A row of the Supabase `truck-quote-logs` table. */
export type QuoteLog = {
  id: number;
  request_id: string;
  upfit_requirements: string[];
  truck_name: string;
  profile: {
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    companyName: string;
  };
  deliveryAddress: string;
  created_at: string;
  /** As submitted with the quote; null when none was recorded. */
  paint: { vehicle: PaintSpec; upfits: ({ upfit: string } & PaintSpec)[] } | null;
  public: boolean;
};

/** Request ids are short codes like "TB-20005"; anything else can't match. */
const REF_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The quote log whose `request_id` is `ref`, or null if none.
 * Server only: reads with the secret key (bypasses RLS), so callers must check `public` before
 * showing anything from it.
 */
export async function findQuoteLog(ref: string): Promise<QuoteLog | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SECRET_KEY is not configured");
  if (!REF_PATTERN.test(ref)) return null;

  const query = new URLSearchParams({
    select: "*",
    request_id: `eq.${ref}`,
    limit: "1",
  });
  const res = await fetch(`${url}/rest/v1/truck-quote-logs?${query}`, {
    // A secret key (sb_secret_…) isn't a JWT, so it goes in `apikey` only, never as a Bearer token.
    headers: { apikey: key },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase responded ${res.status}`);
  const rows: QuoteLog[] = await res.json();
  return rows[0] ?? null;
}

const paintId = (spec: PaintSpec | undefined): PaintColorId | undefined =>
  PAINT_COLORS.find((c) => c.name === spec?.name)?.id;

/** The builder's view of a logged quote, or null when its truck is no longer in the catalog. */
export function quoteLogToBuild(log: QuoteLog): Build | null {
  const vehicle = VEHICLES.find((v) => v.name === log.truck_name);
  if (!vehicle) return null;
  const upfits = upfitsForVehicle(vehicle.id).filter((u) =>
    log.upfit_requirements.includes(u.name),
  );
  const paint: Paint = {
    vehicle: paintId(log.paint?.vehicle) ?? DEFAULT_PAINT.vehicle,
    upfits: Object.fromEntries(
      upfits.flatMap((u) => {
        const id = paintId(log.paint?.upfits.find((p) => p.upfit === u.name));
        return id ? [[u.id, id]] : [];
      }),
    ),
  };
  return { vehicleId: vehicle.id, upfitIds: upfits.map((u) => u.id), paint };
}
