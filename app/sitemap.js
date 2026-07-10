import { SITE_URL } from "./site";

export default function sitemap() {
  return [
    {
      url: SITE_URL,
      changeFrequency: "yearly",
      priority: 1,
    },
  ];
}
