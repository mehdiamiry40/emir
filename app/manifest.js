import { DESCRIPTION, MANIFEST_ICONS, SITE_NAME, THEME_COLOR } from "./site";

export default function manifest() {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: THEME_COLOR,
    theme_color: THEME_COLOR,
    icons: MANIFEST_ICONS,
  };
}
