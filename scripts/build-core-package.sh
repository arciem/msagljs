#!/usr/bin/env bash
# Build and pack @msagl/core from this checkout.
#
# Usage: build-core-package.sh <output directory>
#
# Adapted from the consuming application's original msagl-setup.sh and msagl-build.sh:
# frozen-lockfile install, clean, lerna build scoped to @msagl/core, npm pack. Differences:
# dependency install scripts are not run, the tarball goes to an explicit output directory
# that must already exist, and nothing outside this checkout and that directory is touched
# (the original also refreshed the application's own node_modules).
#
# Requires Node.js and Yarn 1.x on PATH. Tarball member contents are reproducible for a
# given commit and toolchain; npm and gzip metadata are not.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
output="${1:?usage: build-core-package.sh <output directory>}"
if [[ ! -d "$output" ]]; then
  echo "BUILD ERROR output directory does not exist: $output" >&2
  exit 2
fi
output="$(cd "$output" && pwd -P)"

cd "$repo_root"
echo "--- Installing locked dependencies ---"
yarn install --frozen-lockfile --ignore-scripts --non-interactive

echo "--- Building @msagl/core ---"
rm -f modules/core/*.tsbuildinfo modules/core/dist.min.js
rm -rf modules/core/dist
npx lerna run build --scope=@msagl/core

echo "--- Packing @msagl/core ---"
rm -f modules/core/*.tsbuildinfo
(cd modules/core && npm pack --ignore-scripts --loglevel=error --pack-destination "$output" >/dev/null)
ls "$output"/msagl-core-*.tgz
echo "--- @msagl/core package complete ---"
