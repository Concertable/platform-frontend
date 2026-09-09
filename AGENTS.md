# Concertable frontend platform

Publisher for the four tiers every Concertable product surface restores from the package feed:
`@concertable/build-config` (`packages/build-config`), `@concertable/shared` (`packages/shared`),
`@concertable/web` (`packages/web`) and `@concertable/mobile` (`packages/mobile`). Each package's own
`AGENTS.md` carries its inventory and the boundary it adds.

**No standard lives in this repo.** The generic TS/React rules are load-on-demand skills
(`typescript-style`, `contract-naming`, `react-structure`, `server-state`, `client-state`,
`http-layer`, `write-boundary`, `tiered-shared-code`, `stack-defaults`, `routing`, `ui-components`,
`data-tables`, `date-formatting`, `frontend-testing`), and what is true of *this* system is their
same-named counterparts in the `react` plugin. The task you are doing is the trigger to load the
matching pair.

**Product code does not live here.** `@concertable/{customer,b2b,web-b2b}` are product tiers owned by
the product repositories, and the web and mobile apps are package *consumers* rather than boundaries of
this repository — so a tier here must never reach for one of those.

Repository layout, gates and the release flow: [`README.md`](./README.md). `workspaces.cjs` is the one
place the workspace set is declared; `npm run lint` enforces that no tier reaches into another except
through its published package.
