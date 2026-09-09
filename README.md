# Concertable frontend platform

Publisher for the four frontend platform tiers every Concertable product surface restores from the
GitHub Packages feed:

| Package | Source | What it holds |
| --- | --- | --- |
| `@concertable/build-config` | `packages/build-config` | Shared Vite/Vitest/Metro/dependency-cruiser configuration, the TypeScript base, and the build and publication scripts |
| `@concertable/shared` | `packages/shared` | Platform-agnostic domain, hooks, API clients and providers |
| `@concertable/web` | `packages/web` | Web-only components, contexts and feature surfaces |
| `@concertable/mobile` | `packages/mobile` | React Native / Expo components and feature surfaces |

Product code does not live here. `@concertable/customer`, `@concertable/b2b` and
`@concertable/web-b2b` are product tiers owned by the product repositories, and the web and mobile
apps are package *consumers* rather than boundaries of this repository.

## Working in it

```sh
npm ci          # one root install; every @concertable dependency links to its sibling workspace
npm run lint    # workspace boundary enforcement (dependency-cruiser + feature entry points)
npm run typecheck
npm test
npm run build   # shared, then web and mobile
```

`npm run lint` runs `check-fe-boundaries` against `workspaces.cjs`, which is the one place this
repository declares which trees are workspaces.

## Releasing

Each tier carries its own SemVer line, managed by [Changesets](https://github.com/changesets/changesets) —
the deliberate difference from the .NET platform's lockstep MinVer train. A change that only touches
`@concertable/mobile` must not republish `@concertable/web`.

1. Add a changeset in the same pull request as the change: `npm run changeset`.
2. Merging to `main` runs `.github/workflows/release.yml`, which opens a version pull request that
   applies the accumulated changesets.
3. Merging the version pull request publishes the bumped tiers and then proves each one resolves from
   the feed with `verify-fe-package`.

## Consuming the build scripts

The scripts ship as package binaries, so a consumer never reaches into this package's directory:

```sh
npm exec check-fe-boundaries                 # lints the working directory against ./workspaces.cjs
npm exec check-fe-boundaries -- --root app --workspaces app/workspaces.cjs
npm exec verify-fe-package -- <tarball-or-spec> <package-name> [--metro|--metro-only]
npm exec patch-nativewind -- --root app      # shims tailwindcss@3 under nativewind
```

A Vite config takes the ASP.NET development-certificate helper from the package rather than a
relative path:

```ts
import { aspNetDevelopmentHttps } from '@concertable/build-config/vite-development-https'
```

## CI

`.github/workflows/ci.yml` is a thin caller of the organization's reusable `node-ci.yml` from
[`Concertable/.github`](https://github.com/Concertable/.github), pinned to a full commit SHA, plus the
caller-owned `ci-complete` aggregation job the shared `main` ruleset requires. Publication is a
repository-owned Changesets workflow rather than the organization's `npm-publish.yml`, because that
workflow packs and publishes a single package from one directory against a lockfile in that
directory, while this repository has one root lockfile and releases whichever tiers changed.
