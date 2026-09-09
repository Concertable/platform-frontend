#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import ts from "typescript";

// This ships from @concertable/build-config, so the tree being linted is the caller's, never this
// package's own directory: both the root and the workspace declaration have to be passed in.
//
//   node check-fe-boundaries.mjs [--root <directory>] [--workspaces <file>]
//
// --root defaults to the working directory and --workspaces to <root>/workspaces.cjs.
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
  return value;
}

const appRoot = resolve(option("root", process.cwd()));
const workspacesPath = option("workspaces", join(appRoot, "workspaces.cjs"));
const executable = dependencyCruiseExecutable(appRoot);
const { workspaces } = createRequire(join(appRoot, "package.json"))(
  isAbsolute(workspacesPath) ? workspacesPath : resolve(appRoot, workspacesPath),
);

// Walked rather than resolved: dependency-cruiser's "." export is import-only, so require.resolve
// cannot see it, and the executable is not an export at all. Walking node_modules the way Node would
// still lets a nested tree find the copy its ancestors installed.
function dependencyCruiseExecutable(fromDirectory) {
  let directory = fromDirectory;
  for (;;) {
    const candidate = join(directory, "node_modules", "dependency-cruiser", "bin", "dependency-cruise.mjs");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error(`Could not find dependency-cruiser in any node_modules above ${fromDirectory}`);
    }
    directory = parent;
  }
}

const bareFeatureEntryPoint = /^@concertable\/[^/]+\/features\/[^/]+$/;
const featureTypesEntryPoint = /^@concertable\/[^/]+\/features\/[^/]+\/types$/;

function* sourceFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      yield* sourceFiles(path);
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      yield path;
    }
  }
}

function checkFeatureEntryPoints() {
  let violations = 0;

  for (const [workspace] of workspaces) {
    for (const path of sourceFiles(join(appRoot, workspace))) {
      const sourceFile = ts.createSourceFile(
        path,
        readFileSync(path, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );

      for (const statement of sourceFile.statements) {
        const moduleSpecifier = statement.moduleSpecifier;
        if (!moduleSpecifier || !ts.isStringLiteral(moduleSpecifier)) {
          continue;
        }

        const hasTypeImport = ts.isImportDeclaration(statement)
          && (statement.importClause?.isTypeOnly
            || statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)
              && statement.importClause.namedBindings.elements.some((element) => element.isTypeOnly));
        const hasTypeExport = ts.isExportDeclaration(statement)
          && (statement.isTypeOnly
            || statement.exportClause && ts.isNamedExports(statement.exportClause)
              && statement.exportClause.elements.some((element) => element.isTypeOnly));
        const hasValueImport = ts.isImportDeclaration(statement)
          && statement.importClause
          && !statement.importClause.isTypeOnly
          && (statement.importClause.name
            || statement.importClause.namedBindings && ts.isNamespaceImport(statement.importClause.namedBindings)
            || statement.importClause.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)
              && statement.importClause.namedBindings.elements.some((element) => !element.isTypeOnly));
        const hasValueExport = ts.isExportDeclaration(statement)
          && !statement.isTypeOnly
          && statement.exportClause
          && ts.isNamedExports(statement.exportClause)
          && statement.exportClause.elements.some((element) => !element.isTypeOnly);

        let rule;
        if (bareFeatureEntryPoint.test(moduleSpecifier.text) && (hasTypeImport || hasTypeExport)) {
          rule = "feature-type-import-requires-types-entrypoint";
        } else if (featureTypesEntryPoint.test(moduleSpecifier.text) && (hasValueImport || hasValueExport)) {
          rule = "feature-runtime-import-requires-feature-entrypoint";
        } else {
          continue;
        }

        const { line, character } = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile));
        process.stderr.write(`${path}:${line + 1}:${character + 1} ${rule}: ${moduleSpecifier.text}\n`);
        violations += 1;
      }
    }
  }

  return violations;
}

let failed = checkFeatureEntryPoints() > 0;
for (const [workspace, tsConfig] of workspaces) {
  const result = spawnSync(
    process.execPath,
    [executable, workspace, "--config", ".dependency-cruiser.cjs", "--ts-config", join(appRoot, tsConfig), "--output-type", "err"],
    { cwd: appRoot, encoding: "utf8" },
  );
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  failed ||= result.status !== 0;
}

process.exitCode = failed ? 1 : 0;
