#!/usr/bin/env bash
set -euo pipefail

require_main() {
  if [[ "${GITHUB_EVENT_NAME:-}" != workflow_dispatch || "${GITHUB_REF:-}" != refs/heads/main ]]; then
    echo "Releases can only run through a manual dispatch from main." >&2
    return 1
  fi
  if [[ ! "${GITHUB_SHA:-}" =~ ^[a-f0-9]{40}$ ]]; then
    echo "Missing or invalid workflow commit SHA." >&2
    return 1
  fi
  case "${RELEASE_TYPE:-alpha}" in
    alpha|beta|patch|minor|major) ;;
    *) echo "Invalid release type: $RELEASE_TYPE" >&2; return 1 ;;
  esac
}

# npm's SemVer library supplies ordering and increments, not lexical tag sorting.
select_version() {
  node - "$@" <<'NODE'
const fs = require("node:fs");
const assert = require("node:assert/strict");
const semver = require("semver");
const [baseline, type, sha, registryFile, tagsFile, mainSha] = process.argv.slice(2);
assert.ok(["alpha", "beta", "patch", "minor", "major"].includes(type), "Invalid release type.");
assert.equal(semver.valid(baseline), baseline, "Invalid source version.");
const registry = JSON.parse(fs.readFileSync(registryFile, "utf8"));
assert.ok(registry.versions && registry["dist-tags"], "Invalid registry metadata.");
const tags = fs.readFileSync(tagsFile, "utf8").trim().split("\n").filter(Boolean).map(line => {
  const [name, object, peeled, subject] = line.split("|");
  const version = name.slice(1);
  assert.equal(semver.valid(version), version, `Invalid release tag: ${name}`);
  return {version, sha: peeled || object, type: subject?.replace(/^promptlings-release:/, "")};
});
const versions = [baseline, ...Object.keys(registry.versions), ...tags.map(tag => tag.version)];
for (const version of versions) assert.equal(semver.valid(version), version, `Invalid version: ${version}`);
const highest = versions.sort(semver.rcompare)[0];
const previous = tags.filter(tag => tag.sha === sha && tag.type === type).sort((a, b) => semver.rcompare(a.version, b.version))[0];
if (previous) {
  assert.ok(semver.gte(previous.version, highest), "This release was superseded. Run from current main instead.");
  console.log(previous.version);
} else {
  assert.equal(sha, mainSha, "New releases require the current main tip. Start a new run from main.");
  const prerelease = type === "alpha" || type === "beta";
  let version = semver.inc(highest, prerelease ? "prerelease" : type, type);
  // Returning from beta to alpha starts the next patch's prerelease, never a downgrade.
  if (prerelease && !semver.gt(version, highest)) version = semver.inc(highest, "prepatch", type);
  assert.ok(semver.gt(version, highest), "Release version must advance.");
  console.log(version);
}
NODE
}

registry_metadata() {
  curl --fail-with-body --silent --show-error --retry 3 --retry-all-errors \
    --connect-timeout 10 --max-time 30 --retry-max-time 120 \
    --header 'Cache-Control: no-cache' \
    "https://registry.npmjs.org/promptlings?release_check=$(date +%s%N)" \
    --output "$directory/registry.json"
}

source_state() {
  if [[ "$(git rev-parse HEAD)" != "$GITHUB_SHA" ]]; then
    echo "Checkout differs from the selected main commit." >&2
    return 1
  fi
  git fetch origin '+refs/heads/main:refs/remotes/origin/main' --tags
  if ! git merge-base --is-ancestor "$GITHUB_SHA" origin/main; then
    echo "The selected commit is not on main." >&2
    return 1
  fi
  git for-each-ref --format='%(refname:strip=2)|%(objectname)|%(*objectname)|%(contents:subject)' \
    'refs/tags/v*' > "$directory/tags.txt"
}

check_package() {
  node - "$directory" "$RELEASE_VERSION" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const {createHash} = require("node:crypto");
const [directory, version] = process.argv.slice(2);
const [pack] = JSON.parse(fs.readFileSync(path.join(directory, "pack.json")));
assert.equal(pack.name, "promptlings");
assert.equal(pack.version, version);
assert.equal(pack.filename, `promptlings-${version}.tgz`);
const bytes = fs.readFileSync(path.join(directory, pack.filename));
assert.equal(`sha512-${createHash("sha512").update(bytes).digest("base64")}`, pack.integrity);
assert.equal(createHash("sha1").update(bytes).digest("hex"), pack.shasum);
const published = JSON.parse(fs.readFileSync(path.join(directory, "registry.json"))).versions[version];
if (published) {
  assert.equal(published.dist.integrity, pack.integrity, "npm contains different bytes for this version.");
  console.log("published");
} else {
  console.log("unpublished");
}
NODE
}

main() {
  require_main
  local command="${1:?Expected prepare, publish or verify}"
  local directory="${RUNNER_TEMP:?Missing runner temporary directory}/promptlings-release"
  local type="${RELEASE_TYPE:-alpha}"
  mkdir -p "$directory"
  case "$command" in
    prepare)
      source_state
      registry_metadata
      local version
      version=$(select_version "$(node -p 'require("./package.json").version')" "$type" \
        "$GITHUB_SHA" "$directory/registry.json" "$directory/tags.txt" "$(git rev-parse origin/main)")
      echo "version=$version" >> "${GITHUB_OUTPUT:?Missing workflow output}"
      echo "Selected $version ($type) from main commit $GITHUB_SHA"
      ;;
    publish)
      source_state
      registry_metadata
      local expected tag
      expected=$(select_version "$(node -p 'require("./package.json").version')" "$type" \
        "$GITHUB_SHA" "$directory/registry.json" "$directory/tags.txt" "$(git rev-parse origin/main)")
      if [[ "${RELEASE_VERSION:?Missing release version}" != "$expected" ]]; then
        echo "Release state changed since preparation. Start a new run from main." >&2
        return 1
      fi
      tag="v$RELEASE_VERSION"
      if git show-ref --verify --quiet "refs/tags/$tag"; then
        if [[ "$(git rev-parse "$tag^{commit}")" != "$GITHUB_SHA" ]]; then
          echo "$tag points to a different commit." >&2
          return 1
        fi
      else
        git -c user.name=github-actions -c user.email=github-actions@users.noreply.github.com \
          tag -a "$tag" "$GITHUB_SHA" -m "promptlings-release:$type"
      fi
      git push origin "refs/tags/$tag"
      npm version "$RELEASE_VERSION" --no-git-tag-version --ignore-scripts --allow-same-version
      npm pack --ignore-scripts --pack-destination "$directory" --json > "$directory/pack.json"
      local status
      status=$(check_package)
      if [[ "$status" == published ]]; then
        echo "Identical $RELEASE_VERSION is already published. Continuing to verification."
      else
        npm publish "$directory/promptlings-$RELEASE_VERSION.tgz" \
          --ignore-scripts --access public --provenance --tag latest
      fi
      ;;
    verify)
      local verified=false
      for attempt in {1..30}; do
        if registry_metadata && node - "$directory/registry.json" "${RELEASE_VERSION:?Missing release version}" <<'NODE'
const fs = require("node:fs");
const assert = require("node:assert/strict");
const registry = JSON.parse(fs.readFileSync(process.argv[2]));
assert.equal(registry["dist-tags"].latest, process.argv[3], "npm latest has not reached the release.");
assert.ok(registry.versions[process.argv[3]]?.dist?.integrity, "The release archive is not available yet.");
NODE
        then
          verified=true
          break
        fi
        echo "Registry verification $attempt/30 has not succeeded." >&2
        if (( attempt < 30 )); then sleep 10; fi
      done
      if [[ "$verified" != true ]]; then
        echo "Registry verification failed. Rerun the failed verification job." >&2
        return 1
      fi
      npm pack "promptlings@$RELEASE_VERSION" --registry=https://registry.npmjs.org --prefer-online \
        --ignore-scripts --pack-destination "$directory" --json > "$directory/pack.json"
      [[ "$(check_package)" == published ]]
      node -e 'const fs=require("node:fs");fs.writeFileSync(process.argv[2],JSON.stringify(JSON.parse(fs.readFileSync(process.argv[1]))["dist-tags"],null,2)+"\n")' \
        "$directory/registry.json" "$directory/dist-tags.json"
      echo "Verified npm latest=$RELEASE_VERSION and the downloaded archive hashes."
      ;;
    *) echo "Unknown release command: $command" >&2; return 1 ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main "$@"; fi
