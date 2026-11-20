export type CustomerDetails = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  companyName: string;
  industry: string;
  purchaseMethod: string;
  purchaseTime: string;
  deliveryAddress: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  callbackTime: string;
};

export type CompleteAddress = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

/** A paint preset as sales sees it: its name and sRGB hex. */
export type PaintSpec = { name: string; hex: string };

export type BuildSubmission = {
  build: {
    vehicle: string;
    upfits: string[];
    /** The vehicle's color, and one per installed painted upfit (bodies and racks). */
    paint: { vehicle: PaintSpec; upfits: ({ upfit: string } & PaintSpec)[] };
  };
  customer: CustomerDetails;
};

/**
 * Sends a customer's build to our quote endpoint, which forwards it to the
 * sales webhook. Resolves with the new quote's request id when the webhook gave one.
 */
export async function submitBuild(submission: BuildSubmission): Promise<{ requestId?: string }> {
  const res = await fetch("/api/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
  if (!res.ok) throw new Error("Quote request failed");
  const { requestId } = (await res.json().catch(() => ({}))) as { requestId?: unknown };
  return { requestId: typeof requestId === "string" ? requestId : undefined };
}
