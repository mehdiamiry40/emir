import { DATE_ISO, DATE_LABEL } from "../app/site";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function formatDate(iso) {
  return {
    iso,
    label: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`)),
  };
}

/**
 * The date shown on the site. Fixed — it never advances on its own.
 * Defaults to the constants in app/site.js; an Edge Config override only wins
 * when ENABLE_DATE_OVERRIDE is explicitly set to "true".
 */
export async function getDate() {
  if (process.env.ENABLE_DATE_OVERRIDE === "true" && process.env.EDGE_CONFIG) {
    try {
      const { get } = await import("@vercel/edge-config");
      const stored = await get("date");
      if (typeof stored === "string" && ISO_RE.test(stored)) {
        return formatDate(stored);
      }
    } catch {
      // fall through to the static default
    }
  }
  return { iso: DATE_ISO, label: DATE_LABEL };
}
