import { getDate } from "../lib/date";
import { SITE_URL } from "./site";

export default async function sitemap() {
  const date = await getDate();
  return [
    {
      url: SITE_URL,
      lastModified: new Date(date.iso),
      changeFrequency: "yearly",
      priority: 1,
    },
  ];
}
