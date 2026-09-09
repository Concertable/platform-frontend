# @concertable/build-config

## 0.1.0

First release from `Concertable/platform-frontend`. The tier previously published from the
`concertable` monorepo under lockstep `0.1.0-alpha.0.<commit-height>` prereleases on the `alpha`
tag; it now carries its own SemVer line, managed by Changesets.

Two consumer-visible changes come with the move:

- A `./vite-development-https` export, so a Vite config asks the package for the ASP.NET
  dev-certificate helper instead of importing it by relative source path.
- `check-fe-boundaries`, `verify-fe-package` and `patch-nativewind` are exposed as package binaries
  and take the tree they act on explicitly, because a script shipped from a package cannot derive the
  consumer's root from its own location.
