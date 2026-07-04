import { DESCRIPTION, MANIFEST_ICONS, SITE_NAME, THEME_COLORS } from "./site";

export default function manifest() {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: THEME_COLORS.light,
    theme_color: THEME_COLORS.light,
    icons: MANIFEST_ICONS,
  };
}
