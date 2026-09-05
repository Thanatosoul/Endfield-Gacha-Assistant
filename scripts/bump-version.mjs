#!/usr/bin/env node
// One-command version bump: keeps every synced version string in lockstep.
// Usage: npm run bump -- 1.1.5
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const arg = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(arg || "")) {
  console.error("usage: npm run bump -- <x.y.z>");
  process.exit(1);
}
const next = arg;
const semver = String.raw`\d+\.\d+\.\d+`;

function read(p) {
  return readFileSync(join(root, p), "utf8");
}
function write(p, s) {
  writeFileSync(join(root, p), s);
}
function patch(p, re, replacement, label) {
  const original = read(p);
  const updated = original.replace(re, replacement);
  if (updated === original) throw new Error(`no match for ${label} in ${p}`);
  write(p, updated);
  console.log(`${label.padEnd(16)} ${p}`);
}

// package.json — the single canonical "version" key.
patch("package.json", new RegExp(`("version": )"${semver}"`), `$1"${next}"`, "package.json");

// tauri.conf.json — same shape as package.json.
patch("src-tauri/tauri.conf.json", new RegExp(`("version": )"${semver}"`), `$1"${next}"`, "tauri.conf.json");

// Cargo.toml — first `version = "…"` line (the package manifest).
patch("src-tauri/Cargo.toml", new RegExp(`^(version = )"${semver}"`, "m"), `$1"${next}"`, "Cargo.toml");

// package-lock.json — the two root entries, both immediately after our name.
patch(
  "package-lock.json",
  new RegExp(`("name": "endfield-gacha-assistant",\\s*"version": )"${semver}"`, "g"),
  `$1"${next}"`,
  "package-lock.json"
);

// Cargo.lock — the [[package]] block for our crate (same adjacency trick).
patch(
  "src-tauri/Cargo.lock",
  new RegExp(`(name = "endfield-gacha-assistant"\\s*version = )"${semver}"`),
  `$1"${next}"`,
  "Cargo.lock"
);

// AGENTS.md — the documented sync trap note.
patch(
  "AGENTS.md",
  new RegExp(`(Version \`)${semver}(\` is duplicated)`),
  `$1${next}$2`,
  "AGENTS.md"
);

console.log(`\nbumped to v${next} across all 6 files`);
