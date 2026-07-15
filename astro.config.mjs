import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";
import icon from "astro-icon";

const site = process.env.SITE_URL ?? "http://localhost:4321";

export default defineConfig({
  site,
  output: "static",
  integrations: [icon(), sitemap()],
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Inter",
      cssVariable: "--font-sans",
      fallbacks: ["system-ui", "sans-serif"],
      weights: ["400", "500", "600", "700"],
      styles: ["normal"],
      subsets: ["latin"],
      display: "swap",
    },
  ],
  image: {
    responsiveStyles: true,
    layout: "constrained",
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      assetsInlineLimit: 0,
    },
  },
});
