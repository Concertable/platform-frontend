# Changesets

Each frontend platform package carries its own SemVer line, so a change that only touches
`@concertable/mobile` never republishes `@concertable/web`. That is the deliberate difference from the
.NET platform's lockstep MinVer train.

Add a changeset with `npm run changeset` in the same pull request as the change it describes. The
release workflow turns accumulated changesets into a version pull request, and merging that pull
request publishes the bumped packages to GitHub Packages.
