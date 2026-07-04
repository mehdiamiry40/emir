import { DATE_ISO, SITE_URL } from "./site";

export default function sitemap() {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(DATE_ISO),
      changeFrequency: "yearly",
      priority: 1,
    },
  ];
}
