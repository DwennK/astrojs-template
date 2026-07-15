import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL("http://localhost:4321");
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${new URL("sitemap-index.xml", base).href}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
