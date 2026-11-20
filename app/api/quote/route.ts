import axios from "axios";
import { VEHICLES } from "@/lib/catalog";
import { getPaintColor } from "@/lib/paint";
import { grantAccess } from "@/lib/quote-access";
import { isRequestId } from "@/lib/quote-log";
import type { BuildSubmission } from "@/lib/submit-build";

const REQUIRED_CUSTOMER_FIELDS = [
  "firstName",
  "lastName",
  "phone",
  "email",
  "companyName",
  "industry",
  "purchaseMethod",
  "purchaseTime",
  "deliveryAddress",
  "callbackTime",
] as const;

const isText = (v: unknown) => typeof v === "string" && v.trim() !== "";

/** Only colors the vehicle offers, so sales never receives a made-up or other-brand color. */
const offersPaint = (vehicleName: unknown) => {
  const offered = VEHICLES.find((v) => v.name === vehicleName)?.paints.map(getPaintColor) ?? [];
  return (p: unknown) =>
    offered.some(
      (c) => c?.name === (p as { name?: unknown })?.name && c?.hex === (p as { hex?: unknown })?.hex,
    );
};

const isValid = (s: BuildSubmission) => {
  const isPaint = offersPaint(s?.build?.vehicle);
  return (
    isText(s?.build?.vehicle) &&
    Array.isArray(s.build.upfits) &&
    s.build.upfits.every((u) => typeof u === "string") &&
    isPaint(s.build.paint?.vehicle) &&
    Array.isArray(s.build.paint.upfits) &&
    s.build.paint.upfits.every((p) => s.build.upfits.includes(p?.upfit) && isPaint(p)) &&
    REQUIRED_CUSTOMER_FIELDS.every((f) => isText(s.customer?.[f]))
  );
};

/** The new quote's request id from the webhook's reply, if it gave one. */
function requestIdOf(reply: unknown): string | undefined {
  const r = reply as Record<string, unknown> | null;
  const nested = r?.data as Record<string, unknown> | undefined;
  return [r?.request_id, r?.requestId, nested?.request_id, nested?.requestId].find(isRequestId);
}

/**
 * Forwards a customer's build to the sales webhook. Runs on the server, so the
 * browser never calls the webhook (no CORS) and its URL stays private.
 */
export async function POST(request: Request) {
  const root = process.env.WEBHOOK_ROOT_URL;
  if (!root) {
    console.error("WEBHOOK_ROOT_URL is not configured");
    return Response.json({ error: "Not configured" }, { status: 500 });
  }

  const submission: BuildSubmission | null = await request.json().catch(() => null);
  if (!submission || !isValid(submission)) {
    return Response.json({ error: "Invalid quote request" }, { status: 400 });
  }

  let data: unknown;
  try {
    ({ data } = await axios.post(`${root}/tb/quote`, submission, { timeout: 10_000 }));
  } catch (error) {
    console.error(
      "Quote webhook failed:",
      axios.isAxiosError(error) ? (error.response?.status ?? error.code) : error,
    );
    return Response.json({ error: "Quote request failed" }, { status: 502 });
  }

  // The quote is saved from here on: nothing below may report it as failed.
  const requestId = requestIdOf(data);
  if (!requestId) console.warn("Quote webhook replied without a request id");
  // The customer just gave this quote's email, so its preview opens without asking again.
  if (requestId) await grantAccess(requestId).catch((e) => console.error("Quote access grant failed:", e));
  return Response.json({ success: true, requestId });
}
