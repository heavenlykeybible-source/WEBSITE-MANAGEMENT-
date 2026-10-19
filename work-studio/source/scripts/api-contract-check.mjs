import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];

const index = await readFile(join(root, "src/index.ts"), "utf8");
const backendRoutes = new Set(
  [...index.matchAll(/pathname === "([^"]+)"/g)].map((m) => m[1]),
);

const websiteRoot = join(root, "heavenly-key-website");
const jsFiles = [
  "js/homepage-components.js",
  "js/ui-components.js",
];
const htmlFiles = ["index.html"];
for (const entry of await readdir(join(websiteRoot, "pages"), { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".html")) {
    htmlFiles.push("pages/" + entry.name);
  }
}

const frontendEndpoints = new Set();
for (const file of jsFiles) {
  const source = await readFile(join(websiteRoot, file), "utf8");
  for (const match of source.matchAll(/endpoint:\s*"([^"]+)"/g)) {
    frontendEndpoints.add(match[1]);
  }
}
for (const file of htmlFiles) {
  const source = await readFile(join(websiteRoot, file), "utf8");
  for (const match of source.matchAll(/data-api-endpoint="([^"]+)"/g)) {
    frontendEndpoints.add(match[1]);
  }
}

for (const endpoint of frontendEndpoints) {
  if (!backendRoutes.has(endpoint)) {
    failures.push(`Website endpoint has no exact Worker route: ${endpoint}`);
  }
}

const expectedApiBase = '"https://heavenlykey.alldaywow247.workers.dev"';
for (const file of ["js/api-client.js", "js/main.js"]) {
  const source = await readFile(join(websiteRoot, file), "utf8");
  const match = source.match(/const API_BASE\s*=\s*([^;]+);/);
  if (!match || match[1].trim() !== expectedApiBase) {
    failures.push(`${file} must use canonical API_BASE https://heavenlykey.alldaywow247.workers.dev`);
  }
}

const wrangler = await readFile(join(root, "wrangler.toml"), "utf8");
if (!/^routes\s*=\s*\[\]/m.test(wrangler) && (!wrangler.includes('pattern = "api.heavenlykey.org"') || !wrangler.includes("custom_domain = true"))) {
  failures.push("Production Worker must bind the canonical api.heavenlykey.org custom domain.");
}
if (!wrangler.includes("workers_dev = true")) {
  failures.push("Production Worker must keep workers.dev enabled as an operational fallback.");
}

const headers = await readFile(join(websiteRoot, "_headers"), "utf8");
if (!headers.includes("connect-src") || !headers.includes("https://heavenlykey.alldaywow247.workers.dev")) {
  failures.push("Website CSP must allow https://heavenlykey.alldaywow247.workers.dev in connect-src.");
}

const authRoute = await readFile(join(root, "src/routes/auth.ts"), "utf8");
if (!authRoute.includes('Access-Control-Allow-Origin", "https://www.heavenlykey.org"')) {
  failures.push("API CORS must allow the canonical website origin.");
}
if (!index.includes('method === "OPTIONS"')) {
  failures.push("Worker must handle CORS OPTIONS preflight.");
}

if (failures.length) {
  console.error("API CONTRACT CHECK FAILED");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log(
  `API CONTRACT CHECK PASSED — ${frontendEndpoints.size} website endpoints have exact Worker routes.`,
);
