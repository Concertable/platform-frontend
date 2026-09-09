import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const checker = join(dirname(fileURLToPath(import.meta.url)), "check-fe-boundaries.mjs");
// Fixtures sit inside the package so `@concertable/build-config` and `dependency-cruiser` resolve
// through the ancestors' node_modules, the way a consumer's own tree resolves them.
const fixtureParent = dirname(dirname(fileURLToPath(import.meta.url)));

const workspaces = [
  ["alpha", "alpha/tsconfig.build.json"],
  ["beta", "beta/tsconfig.build.json"],
];

const tsConfig = JSON.stringify(
  {
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      skipLibCheck: true,
      noEmit: true,
    },
    include: ["src"],
  },
  null,
  2,
);

function fixture(sources) {
  const root = mkdtempSync(join(fixtureParent, "boundary-fixture-"));

  writeFileSync(
    join(root, "workspaces.cjs"),
    `module.exports = ${JSON.stringify({ workspaces })};\n`,
  );
  writeFileSync(
    join(root, ".dependency-cruiser.cjs"),
    [
      'const createDependencyCruiserConfig = require("@concertable/build-config/dependency-cruiser");',
      'const { workspaces, forbidden } = require("./workspaces.cjs");',
      "",
      "module.exports = createDependencyCruiserConfig({",
      "  workspaces: workspaces.map(([workspace]) => workspace),",
      "  forbidden,",
      "});",
      "",
    ].join("\n"),
  );

  for (const [workspace] of workspaces) {
    mkdirSync(join(root, workspace, "src"), { recursive: true });
    writeFileSync(join(root, workspace, "tsconfig.build.json"), `${tsConfig}\n`);
  }

  for (const [relativePath, contents] of Object.entries(sources)) {
    writeFileSync(join(root, relativePath), contents);
  }

  return root;
}

function check(sources) {
  const root = fixture(sources);
  try {
    const result = spawnSync(process.execPath, [checker, "--root", root], { encoding: "utf8" });
    return { ...result, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("accepts a tree where no workspace reaches into another", () => {
  const result = check({
    "alpha/src/index.ts": "export const alpha = 1;\n",
    "beta/src/index.ts": "export const beta = 2;\n",
  });

  assert.equal(result.status, 0, result.output);
});

test("rejects a direct source path into another workspace", () => {
  const result = check({
    "alpha/src/index.ts": 'import "../../beta/src/index";\n',
    "beta/src/index.ts": "export const beta = 2;\n",
  });

  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /not-to-foreign-workspace/);
});

test("threads the consumer's own forbidden rules into the cruise", () => {
  const root = fixture({
    "alpha/src/index.ts": 'import "./internal";\n',
    "alpha/src/internal.ts": "export const internal = 1;\n",
    "beta/src/index.ts": "export const beta = 2;\n",
  });

  try {
    // Same-workspace, so only the consumer's rule can reject it — not-to-foreign-workspace cannot.
    writeFileSync(
      join(root, "workspaces.cjs"),
      `module.exports = ${JSON.stringify({
        workspaces,
        forbidden: [
          {
            name: "alpha-index-is-a-leaf",
            severity: "error",
            from: { path: "^alpha/src/index\.ts$" },
            to: { path: "^alpha/src/internal\.ts$" },
          },
        ],
      })};\n`,
    );

    const result = spawnSync(process.execPath, [checker, "--root", root], { encoding: "utf8" });
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

    assert.notEqual(result.status, 0, output);
    assert.match(output, /alpha-index-is-a-leaf/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects misplaced feature type and runtime entry points", () => {
  const result = check({
    "alpha/src/index.ts": [
      'import { useVenue, type Venue } from "@concertable/shared/features/venues";',
      'export { type Venue as ExportedVenue } from "@concertable/shared/features/venues";',
      'import { useVenue as wrongUseVenue } from "@concertable/shared/features/venues/types";',
      "void useVenue;",
      "void wrongUseVenue;",
      "void (null as Venue | null);",
      "",
    ].join("\n"),
    "beta/src/index.ts": "export const beta = 2;\n",
  });

  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /feature-type-import-requires-types-entrypoint/);
  assert.match(result.output, /feature-runtime-import-requires-feature-entrypoint/);
});

test("reports a missing workspace declaration instead of silently linting nothing", () => {
  const result = spawnSync(process.execPath, [checker, "--root", fixtureParent], {
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr ?? ""}`, /workspaces\.cjs/);
});
