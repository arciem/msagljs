# Fork notes

This branch carries a small set of changes on top of upstream `microsoft/msagljs` at `@msagl/core` 1.1.23 (commit `5522eb13`). Everything else is upstream.

## Changes

- `RRect` is exported from `@msagl/core`, and `GeomGraph.rrect` is public, so a caller can set the rounded-rectangle bounds of a cluster directly.
- `tsconfig.prod.json` limits `typeRoots` to the repository's own `node_modules/@types`.
- The `console.time` calls in `SplineRouter.run` are commented out.
- Self-loops can be sized and separated. `SplineRouter.SelfLoopSettings` takes an optional `{size, separation, maxWidth}`:
  - `size` is how far the innermost self-loop of a node sticks out of the node.
  - `maxWidth` caps that loop's width; without it the width is half of the node width.
  - `separation` nests the loops of one node. The loop at position `k` among the node's self-loops, in the order the edges were added to the graph, sticks out `k * separation` further and is that much wider on each side. On a node too narrow for that step the horizontal step shrinks, so the loops stay distinct by their height.

  The settings apply to every spline routing path: single self-loops, groups of self-loops routed as multi-edges, and bundled routing. A `BundlingSettings.selfLoopSettings` is also honoured when a `BundleRouter` is used directly; a router's own `SelfLoopSettings` takes precedence and is never written into the caller's `BundlingSettings`. With no settings the original fixed loop is produced unchanged. The rectilinear router is not changed.

  Limits: a self-loop always leaves from the same side of its node, it is not routed around other nodes or edges, and other edges do not avoid it. An edge whose source and target ports coincide without being the same node is treated as a single self-loop, as before.

Tests for the self-loop settings are in `modules/core/test/routing/selfLoops.spec.ts`.

## Building the package

```sh
scripts/build-core-package.sh <existing output directory>
```

The script installs the locked dependencies without running their install scripts, builds `@msagl/core` with Lerna and writes `msagl-core-<version>.tgz` to the output directory. It needs Node.js and Yarn 1.x. The contents of the tarball are reproducible for a given commit and toolchain; the archive's own metadata is not.

## Updating from upstream

Merge upstream rather than rebasing, so the fork's history stays shared with consumers that pin its commits. After a merge, run the self-loop tests and the routing tests, rebuild the package, and check the changes listed above are still present.
