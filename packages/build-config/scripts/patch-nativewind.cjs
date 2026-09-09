#!/usr/bin/env node
// NativeWind resolves `tailwindcss` to v4 (hoisted from a web surface) but only supports v3, so a
// workspace holding both re-shims a v3 copy into nativewind's own node_modules after every install.
//
//   patch-nativewind [--root <directory>] [--tailwind <directory>]
//
// This ships from @concertable/build-config, so neither directory can be derived from __dirname:
// --root is the workspace whose node_modules holds nativewind (default: the working directory) and
// --tailwind is the v3 copy to shim in (default: <root>/mobile/node_modules/tailwindcss).
const fs = require("fs");
const path = require("path");

const argv = process.argv.slice(2);

function option(name, fallback) {
  const index = argv.indexOf(`--${name}`);
  if (index === -1) {
    return fallback;
  }
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`--${name} requires a value`);
  }
  return path.resolve(value);
}

const root = option("root", process.cwd());
const src = option("tailwind", path.join(root, "mobile", "node_modules", "tailwindcss"));
const dest = path.join(root, "node_modules", "nativewind", "node_modules", "tailwindcss");

if (!fs.existsSync(src)) {
  console.warn(`patch-nativewind: no tailwindcss at ${src}, skipping`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
fs.symlinkSync(src, dest, "junction");
console.log("patched: nativewind -> tailwindcss@3");
