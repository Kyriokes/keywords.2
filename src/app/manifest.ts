import type { MetadataRoute } from "next";
import { SEO } from "@/components/landing/copy";
import { SITE_NAME, THEME_DARK } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SEO.description,
    lang: "es-AR",
    start_url: "/user/dashboard",
    scope: "/",
    display: "standalone",
    background_color: THEME_DARK,
    theme_color: THEME_DARK,
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
