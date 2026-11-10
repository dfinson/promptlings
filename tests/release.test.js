import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { packageRoot } from "../lib/content.js";

const script = join(packageRoot, ".github", "scripts", "release.sh");
const bash = process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash";
const shellPath = (path) => path.replaceAll("\\", "/").replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);
const sha = "a".repeat(40);
const otherSha = "b".repeat(40);
const registry = (versions, latest = versions.at(-1)) => ({
  versions: Object.fromEntries(versions.map((version) => [version, {}])),
  "dist-tags": { latest },
});
const tag = (version, commit = otherSha, type = "alpha", annotated = true) =>
  `v${version}|${annotated ? otherSha : commit}|${annotated ? commit : ""}|promptlings-release:${type}\n`;

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "promptlings-release-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function run(code, args = [], env = {}, cwd = packageRoot) {
  assert.ok(process.platform !== "win32" || existsSync(bash), "Git Bash is required for release tests.");
  return spawnSync(bash, ["-c", `source "$1"\n${code}`, "release-test", shellPath(script), ...args], {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 120_000,
  });
}

function select(t, baseline, type, metadata, tags = "") {
  const directory = fixture(t);
  const registryFile = join(directory, "registry.json");
  const tagsFile = join(directory, "tags.txt");
  writeFileSync(registryFile, JSON.stringify(metadata));
  writeFileSync(tagsFile, tags);
  return run('select_version "$2" "$3" "$4" "$5" "$6"',
    [baseline, type, sha, shellPath(registryFile), shellPath(tagsFile)]);
}

test("release Bash parses and only admits manual main runs", () => {
  const syntax = spawnSync(bash, ["-n", shellPath(script)], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr);
  for (const [event, ref, expected] of [
    ["workflow_dispatch", "refs/heads/main", 0],
    ["workflow_dispatch", "refs/heads/feature", 1],
    ["workflow_dispatch", "refs/tags/v1.0.0", 1],
    ["push", "refs/heads/main", 1],
    ["push", "refs/tags/v1.0.0", 1],
    ["pull_request", "refs/heads/main", 1],
  ]) {
    const result = run("require_main", [], {
      GITHUB_EVENT_NAME: event, GITHUB_REF: ref, GITHUB_SHA: sha, RELEASE_TYPE: "alpha",
    });
    assert.equal(result.status, expected, `${event} ${ref}: ${result.stderr}`);
  }
});

test("SemVer selection implements every documented release increment", (t) => {
  for (const [current, type, expected] of [
    ["0.1.0-alpha.5", "alpha", "0.1.0-alpha.6"],
    ["0.1.0-alpha.5", "beta", "0.1.0-beta.0"],
    ["0.1.0-beta.2", "beta", "0.1.0-beta.3"],
    ["0.1.0-beta.2", "alpha", "0.1.1-alpha.0"],
    ["0.1.0", "alpha", "0.1.1-alpha.0"],
    ["0.1.0", "beta", "0.1.1-beta.0"],
    ["0.1.0", "patch", "0.1.1"],
    ["0.1.0", "minor", "0.2.0"],
    ["0.1.0", "major", "1.0.0"],
    ["0.1.0-beta.2", "minor", "0.1.0"],
    ["1.0.0-beta.2", "major", "1.0.0"],
  ]) {
    const result = select(t, "0.1.0-alpha.0", type, registry([current]));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), expected, `${current} ${type}`);
  }
});

test("version selection considers npm, reserved tags and baseline with numeric SemVer ordering", (t) => {
  const result = select(t, "0.1.0-alpha.0", "alpha",
    registry(["0.1.0-alpha.9", "0.1.0-alpha.10"]), tag("0.1.0-alpha.11"));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "0.1.0-alpha.12");
  const baseline = select(t, "2.0.0-alpha.0", "alpha", registry(["0.1.0"]));
  assert.equal(baseline.stdout.trim(), "2.0.0-alpha.1");
});

test("retries reuse their annotated tag, including a failed publish's reserved version", (t) => {
  for (const versions of [["0.1.0-alpha.5"], ["0.1.0-alpha.5", "0.1.0-alpha.6"]]) {
    const result = select(t, "0.1.0-alpha.5", "alpha", registry(versions), tag("0.1.0-alpha.6", sha));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "0.1.0-alpha.6");
  }
  const beta = select(t, "0.1.0-alpha.5", "beta", registry(["0.1.0-alpha.6"]), tag("0.1.0-alpha.6", sha));
  assert.equal(beta.stdout.trim(), "0.1.0-beta.0", "A different release type can promote the same commit.");
});

test("invalid inputs and superseded retries fail instead of publishing a downgrade", (t) => {
  for (const result of [
    select(t, "invalid", "alpha", registry(["0.1.0"])),
    select(t, "0.1.0", "invalid", registry(["0.1.0"])),
    select(t, "0.1.0", "alpha", registry(["0.1.0"]), tag("invalid")),
    select(t, "0.1.0", "alpha", registry(["invalid"])),
    select(t, "0.1.0-alpha.5", "alpha", registry(["0.1.0-alpha.7"]), tag("0.1.0-alpha.6", sha)),
    select(t, "0.1.0-alpha.5", "alpha", registry(["0.1.0-alpha.6"]),
      tag("0.1.0-alpha.6", sha) + tag("0.1.0-alpha.7")),
  ]) assert.notEqual(result.status, 0, result.stdout);
});

test("package recovery requires identical published bytes and validates the downloaded archive", (t) => {
  const directory = fixture(t);
  const version = "0.1.0-alpha.6";
  const bytes = Buffer.from("archive fixture");
  const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  const pack = {
    name: "promptlings", version, filename: `promptlings-${version}.tgz`, integrity,
    shasum: createHash("sha1").update(bytes).digest("hex"),
  };
  writeFileSync(join(directory, pack.filename), bytes);
  writeFileSync(join(directory, "pack.json"), JSON.stringify([pack]));
  const metadata = registry([version]);
  metadata.versions[version].dist = { integrity };
  writeFileSync(join(directory, "registry.json"), JSON.stringify(metadata));
  const check = () => run('directory="$2"\ncheck_package', [shellPath(directory)], { RELEASE_VERSION: version });
  assert.equal(check().stdout.trim(), "published");
  metadata.versions[version].dist.integrity = "sha512-other";
  writeFileSync(join(directory, "registry.json"), JSON.stringify(metadata));
  assert.notEqual(check().status, 0);
  delete metadata.versions[version];
  writeFileSync(join(directory, "registry.json"), JSON.stringify(metadata));
  assert.equal(check().stdout.trim(), "unpublished");
  writeFileSync(join(directory, pack.filename), "corrupted");
  assert.notEqual(check().status, 0);
});

test("all entry points reject non-main dispatch before external commands", (t) => {
  const directory = fixture(t);
  for (const command of ["prepare", "publish", "verify"]) {
    const result = run('git() { echo "unexpected git call"; return 99; }\nnpm() { echo "unexpected npm call"; return 99; }\nmain "$2"',
      [command], { GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/feature",
        GITHUB_SHA: sha, RUNNER_TEMP: directory, RELEASE_TYPE: "alpha" });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /unexpected/);
    assert.ok(!existsSync(join(directory, "promptlings-release")));
  }
});

test("release reserves the real main SHA, stamps and packs without committing, and safely retries", (t) => {
  const directory = fixture(t);
  const remote = join(directory, "remote.git");
  const checkout = join(directory, "checkout");
  const artifacts = join(directory, "artifacts");
  mkdirSync(checkout);
  const git = (...args) => {
    const result = spawnSync("git", args, { cwd: checkout, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git("init", "--bare", remote);
  git("init", "-b", "main");
  git("config", "user.name", "Release Test");
  git("config", "user.email", "release-test@example.invalid");
  git("remote", "add", "origin", remote);
  const manifest = { name: "promptlings", version: "0.1.0-alpha.5", files: ["index.js"] };
  writeFileSync(join(checkout, "package.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(join(checkout, "npm-shrinkwrap.json"), JSON.stringify({
    name: manifest.name, version: manifest.version, lockfileVersion: 3, requires: true,
    packages: { "": { name: manifest.name, version: manifest.version } },
  }, null, 2));
  writeFileSync(join(checkout, "index.js"), "export const example = true;\n");
  git("add", ".");
  git("commit", "-m", "Fixture main");
  git("push", "origin", "main");
  const commit = git("rev-parse", "HEAD");
  const metadataFile = join(directory, "registry.json");
  writeFileSync(metadataFile, JSON.stringify(registry(["0.1.0-alpha.5"])));
  const output = join(directory, "outputs");
  const calls = join(directory, "publish-calls");
  const env = {
    GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main", GITHUB_SHA: commit,
    RELEASE_TYPE: "alpha", RELEASE_VERSION: "0.1.0-alpha.6", RUNNER_TEMP: shellPath(artifacts),
    GITHUB_OUTPUT: shellPath(output), NODE_PATH: join(packageRoot, "node_modules"),
    REGISTRY_FIXTURE: shellPath(metadataFile), PUBLISH_CALLS: shellPath(calls),
  };
  const mocks = `
registry_metadata() { cp "$REGISTRY_FIXTURE" "$directory/registry.json"; }
npm() {
  if [[ "$1" == publish ]]; then
    printf '%s\\n' "$*" >> "$PUBLISH_CALLS"
  else
    command npm "$@"
  fi
}
`;
  const prepare = run(`${mocks}\nmain prepare`, [], env, checkout);
  assert.equal(prepare.status, 0, prepare.stderr);
  assert.equal(readFileSync(output, "utf8").trim(), "version=0.1.0-alpha.6");
  const publish = run(`${mocks}\nmain publish`, [], env, checkout);
  assert.equal(publish.status, 0, publish.stderr);
  assert.equal(git("rev-parse", "v0.1.0-alpha.6^{commit}"), commit);
  assert.match(git("ls-remote", "--tags", "origin"), /refs\/tags\/v0\.1\.0-alpha\.6\^\{\}/);
  assert.equal(git("rev-parse", "HEAD"), commit, "No version commit was created.");
  assert.equal(git("show", "HEAD:package.json"), JSON.stringify(manifest, null, 2));
  const stamped = JSON.parse(readFileSync(join(checkout, "package.json")));
  const shrinkwrap = JSON.parse(readFileSync(join(checkout, "npm-shrinkwrap.json")));
  assert.equal(stamped.version, env.RELEASE_VERSION);
  assert.equal(shrinkwrap.version, env.RELEASE_VERSION);
  assert.equal(shrinkwrap.packages[""].version, env.RELEASE_VERSION);
  const publishedCalls = readFileSync(calls, "utf8");
  assert.match(publishedCalls, /--provenance --tag latest/);
  const [pack] = JSON.parse(readFileSync(join(artifacts, "promptlings-release", "pack.json")));
  const metadata = registry(["0.1.0-alpha.5", env.RELEASE_VERSION]);
  metadata.versions[env.RELEASE_VERSION].dist = { integrity: pack.integrity };
  writeFileSync(metadataFile, JSON.stringify(metadata));
  const retry = run(`${mocks}\nmain publish`, [], env, checkout);
  assert.equal(retry.status, 0, retry.stderr);
  assert.match(retry.stdout, /already published/);
  assert.equal(readFileSync(calls, "utf8"), publishedCalls, "Retry must not publish twice.");
  metadata.versions[env.RELEASE_VERSION].dist.integrity = "sha512-conflict";
  writeFileSync(metadataFile, JSON.stringify(metadata));
  const conflict = run(`${mocks}\nmain publish`, [], env, checkout);
  assert.notEqual(conflict.status, 0);
  assert.match(conflict.stderr, /different bytes/);
  assert.equal(readFileSync(calls, "utf8"), publishedCalls, "A package conflict must never reach npm publish.");
  assert.equal(git("rev-parse", "origin/main"), commit);
  git("switch", "-c", "feature");
  writeFileSync(join(checkout, "index.js"), "export const example = false;\n");
  git("add", "index.js");
  git("commit", "-m", "Unmerged feature");
  const offMain = run(`${mocks}\nmain prepare`, [], { ...env, GITHUB_SHA: git("rev-parse", "HEAD") }, checkout);
  assert.notEqual(offMain.status, 0);
  assert.match(offMain.stderr, /not on main/);
  assert.equal(readFileSync(calls, "utf8"), publishedCalls);
});

test("verification retries stale registry data, verifies bytes and never publishes", (t) => {
  const directory = fixture(t);
  const version = "0.1.0-alpha.6";
  const archive = Buffer.from("published archive fixture");
  const pack = {
    name: "promptlings", version, filename: `promptlings-${version}.tgz`,
    integrity: `sha512-${createHash("sha512").update(archive).digest("base64")}`,
    shasum: createHash("sha1").update(archive).digest("hex"),
  };
  const release = join(directory, "promptlings-release");
  mkdirSync(release);
  writeFileSync(join(release, pack.filename), archive);
  const packFixture = join(directory, "pack-fixture.json");
  writeFileSync(packFixture, JSON.stringify([pack]));
  const stale = join(directory, "stale.json");
  const fresh = join(directory, "fresh.json");
  writeFileSync(stale, JSON.stringify(registry(["0.1.0-alpha.5"])));
  const metadata = registry([version]);
  metadata.versions[version].dist = { integrity: pack.integrity };
  writeFileSync(fresh, JSON.stringify(metadata));
  const env = {
    GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main", GITHUB_SHA: sha,
    RELEASE_VERSION: version, RELEASE_TYPE: "alpha", RUNNER_TEMP: shellPath(directory),
    STALE: shellPath(stale), FRESH: shellPath(fresh), PACK: shellPath(packFixture),
  };
  const result = run(`
reads=0
registry_metadata() {
  reads=$((reads + 1))
  if (( reads < 3 )); then cp "$STALE" "$directory/registry.json"
  else cp "$FRESH" "$directory/registry.json"; fi
}
sleep() { :; }
npm() {
  [[ "$1" == pack && "$2" == "promptlings@$RELEASE_VERSION" ]]
  cat "$PACK"
}
main verify
echo "metadata-reads=$reads"
`, [], env);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /metadata-reads=3/);
  assert.equal(JSON.parse(readFileSync(join(release, "dist-tags.json"))).latest, version);
  const failed = run(`
registry_metadata() { echo "registry offline" >&2; return 1; }
sleep() { :; }
npm() { echo "unexpected npm call"; return 99; }
main verify
`, [], env);
  assert.equal(failed.status, 1);
  assert.equal((failed.stderr.match(/Registry verification \d+\/30/g) ?? []).length, 30);
  assert.match(failed.stderr, /Rerun the failed verification job/);
  assert.doesNotMatch(failed.stdout, /unexpected/);
});

test("workflow is manual-only, serialized, SHA-pinned and gates write permissions behind tests", () => {
  const workflow = readFileSync(resolve(packageRoot, ".github", "workflows", "publish.yml"), "utf8");
  assert.match(workflow, /workflow_dispatch:\s+inputs:\s+release_type:/);
  assert.match(workflow, /default: alpha/);
  assert.match(workflow, /options: \[alpha, beta, patch, minor, major\]/);
  assert.doesNotMatch(workflow, /^\s+(push|pull_request|workflow_run):/m);
  assert.match(workflow, /group: npm-release\s+cancel-in-progress: false/);
  assert.match(workflow, /publish:[\s\S]*needs: \[prepare, test\][\s\S]*github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /verify:[\s\S]*needs: \[prepare, publish\]/);
  assert.doesNotMatch(workflow, /always\(\)/);
  assert.equal((workflow.match(/ref: \$\{\{ github.sha \}\}/g) ?? []).length, 4);
  assert.equal((workflow.match(/contents: write/g) ?? []).length, 1);
  assert.match(workflow, /test "\$GITHUB_REF" = refs\/heads\/main/);
});
