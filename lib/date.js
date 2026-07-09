import { DATE_ISO, DATE_LABEL } from "../app/site";

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
 * The date shown on the site. Fixed — it never advances on its own and does
 * not read runtime storage.
 */
export async function getDate() {
  return { iso: DATE_ISO, label: DATE_LABEL };
}
