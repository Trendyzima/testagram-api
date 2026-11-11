#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK="$ROOT/contracts/sources.lock.json"
mkdir -p "$ROOT/source-repos"

while IFS=$'\t' read -r key full_name sha path; do
  target="$ROOT/$path"
  mkdir -p "$(dirname "$target")"
  if [[ ! -d "$target/.git" ]]; then
    git init "$target"
    git -C "$target" remote add origin "https://github.com/$full_name.git"
  fi
  git -C "$target" fetch --depth=1 origin "$sha"
  git -C "$target" checkout --detach FETCH_HEAD
done < <(node -e '
  const x=require(process.argv[1]);
  for (const [key,r] of Object.entries(x.repositories)) {
    console.log([key,r.fullName,r.ref,r.checkoutPath].join("\t"));
  }
' "$LOCK")
