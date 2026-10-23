import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fail = [];
const warn = [];

const wrangler = await readFile(join(root, "wrangler.toml"), "utf8");
const requiredBindings = ["DB", "MEDIA_R2", "LIVE_STATUS_KV"];

for (const binding of requiredBindings) {
  if (!wrangler.includes(`binding = "${binding}"`)) {
    fail.push(`Missing Media Engine binding: ${binding}`);
  }
}

const placeholders = [
  ...wrangler.matchAll(/REPLACE_WITH_REAL_[A-Z0-9_]+/g),
].map((m) => m[0]);

if (placeholders.length) {
  fail.push(
    `Cloudflare resource IDs are still placeholders (${new Set(placeholders).size}). Replace them before deployment.`
  );
}

if (!wrangler.includes("MEDIA_ENGINE_SHARED_SECRET")) {
  warn.push(
    "MEDIA_ENGINE_SHARED_SECRET is not referenced in wrangler.toml comments; ensure it is configured as a Worker secret."
  );
}

const migrationDir = join(root, "migrations");
const migrations = (await readdir(migrationDir))
  .filter((f) => /^\d{4}_.+\.sql$/.test(f))
  .sort();

const nums = migrations.map((f) => Number(f.slice(0, 4)));
for (let i = 0; i < nums.length; i++) {
  if (nums[i] !== i + 1) {
    fail.push(
      `Media Engine migration sequence gap at ${String(i + 1).padStart(4, "0")}.`
    );
  }
}

if (nums.length !== 5 || nums[nums.length - 1] !== 5) {
  fail.push(
    `Expected Media Engine migration 0005 as the current schema tip; found ${
      nums.length ? String(nums[nums.length - 1]).padStart(4, "0") : "none"
    }.`
  );
}

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(file);
    } else if (entry.name.endsWith(".ts")) {
      const text = await readFile(file, "utf8");
      if (/\b(TODO|FIXME)\b/i.test(text)) {
        fail.push(`TODO/FIXME marker in ${file.replace(root + "/", "")}`);
      }
      if (/console\.log\(/.test(text)) {
        warn.push(`console.log present in ${file.replace(root + "/", "")}`);
      }
    }
  }
}

await walk(join(root, "src"));

const packageJson = JSON.parse(
  await readFile(join(root, "package.json"), "utf8")
);
for (const script of ["check", "preflight", "deploy"]) {
  if (!packageJson.scripts?.[script]) {
    fail.push(`Missing Media Engine npm script: ${script}`);
  }
}

if (fail.length) {
  console.error("MEDIA ENGINE PREFLIGHT FAILED");
  for (const x of fail) console.error("- " + x);
  for (const x of warn) console.error("WARN - " + x);
  process.exit(1);
}

console.log(
  `MEDIA ENGINE PREFLIGHT PASSED — ${migrations.length} migrations and required bindings present.`
);
for (const x of warn) console.log("WARN - " + x);

