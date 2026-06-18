#!/usr/bin/env bash
set -euo pipefail

die() { echo "error: $*" >&2; exit 1; }

usage() {
  cat <<'USAGE'
Usage: ./release.sh [--push] [--skip-tests]

Example:
  ./release.sh
  ./release.sh --push

Does:
  - reads the release version from VERSION
  - verifies the working tree is clean
  - runs the Deno runtime suite unless --skip-tests is set
  - creates annotated tag vX.Y.Z
  - creates a GitHub release if gh is installed
  - pushes the tag to origin if gh is not installed
  - pushes commit and tag when --push is set
USAGE
}

PUSH=0
SKIP_TESTS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --push) PUSH=1 ;;
    --skip-tests) SKIP_TESTS=1 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
  shift
done

[[ -f VERSION ]] || die "VERSION file not found"
VERSION="$(tr -d '[:space:]' < VERSION)"
VERSION="${VERSION#v}"
TAG="v$VERSION"

[[ "$VERSION" =~ ^[0-9]+(\.[0-9]+){1,2}([.-][0-9A-Za-z.-]+)?$ ]] \
  || die "version should look like 1.2.3 or v1.2.3"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || die "not inside a git repository"

[[ -z "$(git status --porcelain)" ]] \
  || die "working tree is not clean"

git show-ref --verify --quiet "refs/tags/$TAG" \
  && die "tag already exists: $TAG"

if [[ "$SKIP_TESTS" -eq 0 ]]; then
  deno test --allow-read --no-check
fi

git tag -a "$TAG" -m "$TAG"

TAG_PUSHED=0

if command -v gh >/dev/null 2>&1; then
  gh release create "$TAG" --title "$TAG" --notes "Release $TAG"
else
  echo "gh not found; pushing tag instead"
  git push origin "$TAG"
  TAG_PUSHED=1
fi

if [[ "$PUSH" -eq 1 ]]; then
  git push origin HEAD
  if [[ "$TAG_PUSHED" -eq 0 ]]; then
    git push origin "$TAG"
  fi
fi

echo "Released $TAG"
