import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const outputDirectory = resolve(process.argv[2] ?? "dist");

if (!existsSync(outputDirectory)) {
  console.error(`Build directory not found: ${outputDirectory}`);
  process.exit(1);
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const files = walk(outputDirectory);
const htmlFiles = files.filter((file) => extname(file) === ".html");
const htmlByRoute = new Map();
const idsByRoute = new Map();

for (const file of htmlFiles) {
  const relativePath = relative(outputDirectory, file).replaceAll("\\", "/");
  const route =
    relativePath === "index.html"
      ? "/"
      : relativePath.endsWith("/index.html")
        ? `/${relativePath.slice(0, -"index.html".length)}`
        : `/${relativePath.replace(/\.html$/, "")}`;
  const html = readFileSync(file, "utf8");
  const ids = new Set(
    [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]),
  );
  htmlByRoute.set(route, { file, html });
  idsByRoute.set(route, ids);
}

function normalizeRoute(pathname) {
  if (pathname === "/") return "/";
  if (pathname.endsWith(".html")) return pathname.replace(/\.html$/, "");
  if (extname(pathname)) return pathname;
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

const failures = [];

for (const [sourceRoute, { file, html }] of htmlByRoute) {
  const links = [...html.matchAll(/\shref=["']([^"']+)["']/g)].map(
    (match) => match[1],
  );

  for (const href of links) {
    if (/^(?:https?:|mailto:|tel:|data:|javascript:)/.test(href)) continue;

    if (href.startsWith("#")) {
      const id = decodeURIComponent(href.slice(1));
      if (id.startsWith("ai:")) continue;
      if (!idsByRoute.get(sourceRoute)?.has(id)) {
        failures.push(
          `${relative(outputDirectory, file)} -> missing anchor ${href}`,
        );
      }
      continue;
    }

    const target = new URL(href, `https://internal.test${sourceRoute}`);
    const targetRoute = normalizeRoute(target.pathname);

    if (extname(target.pathname) && extname(target.pathname) !== ".html") {
      const assetPath = join(
        outputDirectory,
        decodeURIComponent(target.pathname),
      );
      if (!existsSync(assetPath))
        failures.push(`${relative(outputDirectory, file)} -> missing ${href}`);
      continue;
    }

    if (!htmlByRoute.has(targetRoute)) {
      failures.push(`${relative(outputDirectory, file)} -> missing ${href}`);
      continue;
    }

    if (target.hash) {
      const id = decodeURIComponent(target.hash.slice(1));
      if (!idsByRoute.get(targetRoute)?.has(id)) {
        failures.push(
          `${relative(outputDirectory, file)} -> missing anchor ${href}`,
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error(
    `Internal link check failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`,
  );
  process.exit(1);
}

console.log(
  `Checked ${htmlFiles.length} HTML files: all internal links and anchors are valid.`,
);
