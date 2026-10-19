import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];

const proxy = await readFile(join(root, "src/services/integrations/media-engine-proxy.ts"), "utf8");
if (!proxy.includes("actor.roleName")) failures.push("Media Engine proxy must propagate actor.roleName.");
if (proxy.includes("actor.level as 'Administrator'")) failures.push("Media Engine proxy must never cast numeric role level to role name.");

const mediaIndex = await readFile(join(root, "media-engine/src/index.ts"), "utf8");
if (/catch\s*\{\s*\}/.test(mediaIndex)) {
  failures.push("Media Engine must not silently swallow storage/deletion failures.");
}

const rootMigrations = (await readdir(join(root, "migrations")))
  .filter((f) => /^\d{4}_.+\.sql$/.test(f))
  .sort();
if (rootMigrations.length !== 39 || !rootMigrations.at(-1)?.startsWith("0039_")) {
  failures.push("Root migration tip must be 0039 with exactly 39 numbered migrations.");
}

const mediaMigrations = (await readdir(join(root, "media-engine/migrations")))
  .filter((f) => /^\d{4}_.+\.sql$/.test(f))
  .sort();
if (mediaMigrations.length !== 5 || !mediaMigrations.at(-1)?.startsWith("0005_")) {
  failures.push("Media Engine migration tip must be 0005 with exactly 5 numbered migrations.");
}

const prod = await readFile(join(root, ".github/workflows/cloudflare-production.yml"), "utf8");
const account2 = await readFile(join(root, ".github/workflows/cloudflare-media-engine.yml"), "utf8");
for (const [name, workflow] of [["Account 1", prod], ["Account 2", account2]]) {
  if (!workflow.includes("npm ci")) failures.push(`${name} deployment must use npm ci.`);
  if (/wrangler whoami/.test(workflow)) failures.push(`${name} deployment must not depend on wrangler whoami.`);
}

if (failures.length) {
  console.error("ARCHITECTURE CHECK FAILED");
  for (const f of failures) console.error("- " + f);
  process.exit(1);
}

console.log("ARCHITECTURE CHECK PASSED — deployment, migration and Media Engine invariants preserved.");

