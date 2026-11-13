#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK="$ROOT/contracts/sources.lock.json"
mkdir -p "$ROOT/source-repos"

while IFS=$'\t' read -r key full_name sha path sparse_dirs; do
  target="$ROOT/$path"
  mkdir -p "$(dirname "$target")"
  if [[ ! -d "$target/.git" ]]; then
    git init "$target"
    git -C "$target" remote add origin "https://github.com/$full_name.git"
  fi
  git -C "$target" fetch --filter=blob:none --depth=1 origin "$sha"
  git -C "$target" sparse-checkout init --cone
  read -r -a directories <<< "$sparse_dirs"
  git -C "$target" sparse-checkout set "${directories[@]}"
  git -C "$target" checkout --detach FETCH_HEAD
done < <(node -e '
  const x=require(process.argv[1]);
  const sparse = {
    backend: [".github/workflows", "cmd/api", "cmd/fresh-api", "internal/freshapi", "internal/freshfeed", "internal/freshstorage", "internal/media", "internal/mediaassertion", "internal/datacentreclient", "internal/algorithmclient", "internal/federationclient", "internal/federationoutbox", "internal/virtualstorage", "deploy/self-hosted", "migrations", "docs"],
    "data-centre": ["backend", "backend/services/platform", "backend/services/media", "docs/platform", ".github/workflows", "vps", "scripts"],
    cdn: [".github", "internal/edge", "cloudflare", "docs"],
    "flutter-client": ["docs", "lib/core", "lib/features/auth", "lib/features/discovery", "lib/features/feed", "lib/features/federation", "lib/features/profile", "lib/features/posts", "lib/features/settings", "lib/features/wallet", "lib/features/tv", "test/core", "test/features/auth", "test/features/discovery", "test/features/feed", "test/features/federation", "test/features/posts", "test/features/profile", "test/features/settings", "test/features/tv", "test/features/wallet"],
    federation: ["internal/httpapi", "internal/backend", "internal/store", "internal/worker", "api", "docs"],
    algorithm: ["testagram-feed"]
  };
  for (const [key,r] of Object.entries(x.repositories)) {
    console.log([key,r.fullName,r.ref,r.checkoutPath,(sparse[key] || []).join(" ")].join("\t"));
  }
' "$LOCK")
