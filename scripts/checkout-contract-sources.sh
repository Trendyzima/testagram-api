#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK="$ROOT/contracts/sources.lock.json"
BRIDGE="$ROOT/contracts/registry/seven-organ-bridge.json"
mkdir -p "$ROOT/source-repos"

while IFS=$'\t' read -r key full_name sha path sparse_dirs main_commit; do
  target="$ROOT/$path"
  mkdir -p "$(dirname "$target")"
  if [[ ! -d "$target/.git" ]]; then
    git init "$target"
    git -C "$target" remote add origin "https://github.com/$full_name.git"
  fi

  # Re-runs must start from a clean detached candidate before constructing the
  # same synthetic merge tree used by GitHub's PR merge calculation.
  git -C "$target" merge --abort >/dev/null 2>&1 || true
  git -C "$target" reset --hard >/dev/null 2>&1 || true
  git -C "$target" clean -fd >/dev/null 2>&1 || true
  git -C "$target" fetch --filter=blob:none origin "$sha" "$main_commit"
  git -C "$target" sparse-checkout init --cone
  read -r -a directories <<< "$sparse_dirs"
  git -C "$target" sparse-checkout set "${directories[@]}"
  git -C "$target" checkout --detach "$sha"

  # Fail immediately if the candidate and pinned mainline cannot produce a
  # clean merge. The cross-repo checker verifies every declared sourcePath
  # against this exact merge tree after the sparse checkout is materialized.
  git -C "$target" merge-tree --write-tree "$sha" "$main_commit" >/dev/null
  if ! git -C "$target" merge-base --is-ancestor "$main_commit" "$sha"; then
    git -C "$target" -c user.name="Testagram Contract Check" -c user.email="contract-check@testagram.invalid" \
      merge --no-commit --no-ff "$main_commit"
  fi
  echo "$key: candidate $sha checked against mainline merge $main_commit"
done < <(node -e '
  const x=require(process.argv[1]);
  const b=require(process.argv[2]);
  const main = new Map(b.repositories.map(repo => [repo.id, repo.mainCommit]));
  const sparse = {
    backend: [".github/workflows", "admin-console", "tests", "cmd/api", "internal/nativeauth", "internal/media", "internal/mediaassertion", "internal/datacentreclient", "internal/algorithmclient", "internal/federationclient", "internal/federationoutbox", "internal/virtualstorage", "deploy/self-hosted", "migrations", "docs", "scripts"],
    "data-centre": ["backend", "backend/services/platform", "backend/services/media", "docs", ".github/workflows", "vps", "scripts"],
    cdn: [".github", "cmd", "internal/edge", "cloudflare", "docs", "tests"],
    "flutter-client": [".github/workflows", "docs", "lib/app", "lib/core", "lib/features/auth", "lib/features/discovery", "lib/features/feed", "lib/features/federation", "lib/features/knowledge", "lib/features/monetization", "lib/features/messaging", "lib/features/calls", "lib/features/profile", "lib/features/posts", "lib/features/settings", "lib/features/wallet", "lib/features/tv", "test", "test/core", "test/features/auth", "test/features/discovery", "test/features/feed", "test/features/federation", "test/features/knowledge", "test/features/monetization", "test/features/posts", "test/features/profile", "test/features/settings", "test/features/tv", "test/features/wallet", "tool"],
    federation: ["internal/httpapi", "internal/backend", "internal/store", "internal/worker", "api", "docs"],
    algorithm: ["testagram-feed", "docs"]
  };
  for (const [key,r] of Object.entries(x.repositories)) {
    const mainCommit = main.get(key);
    if (!/^[0-9a-f]{40}$/.test(mainCommit || "")) throw new Error(key + ": missing immutable mainCommit");
    console.log([key,r.fullName,r.ref,r.checkoutPath,(sparse[key] || []).join(" "),mainCommit].join("\t"));
  }
' "$LOCK" "$BRIDGE")
