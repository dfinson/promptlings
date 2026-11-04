// Opt-in native discovery and execution check, not an SDK preload.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, cpSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (!args.includes("--run")) {
  console.log("Opt-in native smoke: --run --trial <completed single trial> --packet <candidate JSON> --cli <CLI JS entry> --output <new external directory>");
  process.exit(0);
}
const option = (name) => {
  if (!args.includes(name) || !args[args.indexOf(name) + 1]) throw new Error(`Missing ${name}`);
  return resolve(args[args.indexOf(name) + 1]);
};
const trial = option("--trial");
const packet = JSON.parse(readFileSync(option("--packet"), "utf8"));
const cli = option("--cli");
const output = option("--output");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const body = (text) => text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
const canonical = (text) => text.replace(/# Spec delivery: (checked|staged) candidate/, "# Spec Delivery").trim().split(/\s+/).join(" ");
const sourceAgent = readFileSync(join(root, "agents", "orchestration", "spec-master.agent.md"), "utf8");
const sourceMethod = readFileSync(join(root, "skills", "spec-delivery", "SKILL.md"), "utf8");
if (canonical(body(sourceAgent)) !== canonical(packet.agent) || canonical(body(sourceMethod)) !== canonical(packet.method)) {
  throw new Error("The installed source does not match the candidate. Integrate the candidate before native verification");
}
const outputFromRoot = relative(root, output);
if (!outputFromRoot || (!isAbsolute(outputFromRoot) && outputFromRoot !== ".." && !outputFromRoot.startsWith(`..${sep}`))) {
  throw new Error("Native smoke artifacts must be outside the repository");
}
if (existsSync(output)) throw new Error("Use a new output directory");
mkdirSync(output, { recursive: true });
const repo = join(output, "repo");
const env = { ...process.env, COPILOT_HOME: join(output, "copilot-home"), GIT_PAGER: "cat",
  GIT_TERMINAL_PROMPT: "0", PYTHONDONTWRITEBYTECODE: "1" };
function run(argv, cwd = repo, timeout = 120000) {
  const result = spawnSync(argv[0], argv.slice(1), { cwd, env, encoding: "utf8", timeout, windowsHide: true });
  return { argv, exit: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", error: result.error?.message };
}
function checked(argv, cwd = repo) {
  const result = run(argv, cwd);
  if (result.exit !== 0) throw new Error(JSON.stringify(result));
  return result.stdout.trim();
}
function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}
const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const prior = JSON.parse(readFileSync(join(trial, "result.json"), "utf8"));
if (prior.kind !== "single") throw new Error("The native smoke requires a single-lane fixture");
checked(["git", "clone", "--quiet", "--no-hardlinks", "--no-checkout", join(trial, "repo"), repo], output);
checked(["git", "switch", "-c", "native-setup", prior.approved]);
checked(["git", "branch", "main", prior.approved]);
checked(["git", "remote", "remove", "origin"]);
checked(["git", "config", "user.name", "Benchmark"]);
checked(["git", "config", "user.email", "benchmark@example.invalid"]);
write(join(repo, ".git", "info", "exclude"), ".gate-worktrees/\n.lanes/\n.base-check/\n");
for (const name of ["spec-delivery", "design-writing", "reasoning-first-writing"]) {
  cpSync(join(root, "skills", name), join(repo, ".github", "skills", name), {
    recursive: true, filter: (path) => !/(__pycache__|\.pyc$)/.test(path),
  });
}
write(join(repo, ".github", "agents", "spec-master.agent.md"), sourceAgent);
const methodPath = join(repo, ".github", "skills", "spec-delivery", "SKILL.md");
checked(["git", "add", ".github"]);
checked(["git", "commit", "-qm", "Install exact local candidate for native discovery"]);
const approved = checked(["git", "rev-parse", "HEAD"]);
checked(["git", "tag", "spec/native/approved", approved]);
checked(["git", "switch", "-c", "native-delivery"]);
const main = checked(["git", "rev-parse", "main"]);
const acceptanceHash = hash(join(repo, "acceptance.py"));
const manifest = { approved, main, methodHash: hash(methodPath),
  agentHash: hash(join(repo, ".github", "agents", "spec-master.agent.md")),
  gateHash: hash(join(repo, ".github", "skills", "spec-delivery", "scripts", "gate.py")),
  packetHash: createHash("sha256").update(JSON.stringify(packet)).digest("hex"), acceptanceHash,
  sourceInstructionsMatchPacket: true,
  helperMatchesPacket: readFileSync(join(repo, ".github", "skills", "spec-delivery", "scripts", "gate.py"), "utf8") === packet.resources["skills/spec-delivery/scripts/gate.py"] };
if (!manifest.helperMatchesPacket) throw new Error("The installed helper differs from the frozen candidate");
write(join(output, "manifest.json"), JSON.stringify(manifest, null, 2));
const registry = run([process.execPath, cli, "skill", "list"]);
write(join(output, "registry.json"), JSON.stringify(registry, null, 2));
if (registry.exit !== 0) throw new Error("Native skill registry failed. Inspect registry.json");
const original = readFileSync(join(trial, "input.txt"), "utf8").split("Host adapter:")[0];
const prompt = original.replaceAll(prior.approved, approved) +
  "\nUse the project-local spec-delivery skill through native skill discovery, not a quoted substitute. " +
  "Record its actual source path and hash. The immutable approval tag is spec/native/approved. " +
  "Use .gate-worktrees as the authorized scratch directory, excluded from Git status as in the SDK fixture. " +
  "Stay inside this disposable repository. Do not install global customizations or contact another repository.";
write(join(output, "input.txt"), prompt);
const stdout = openSync(join(output, "native.jsonl"), "w");
const stderr = openSync(join(output, "native-stderr.txt"), "w");
let execution;
try {
  const result = spawnSync(process.execPath, [cli, "--agent", "spec-master", "--trust-folder",
  "--no-custom-instructions", "--disable-builtin-mcps", "--allow-all-tools", "--no-ask-user",
  "--sync-session=off", "--output-format", "json", "--log-dir", join(output, "logs"),
    "--usage-output-file", join(output, "usage.json"), "-p", prompt], {
    cwd: repo, env, timeout: 600000, windowsHide: true, stdio: ["ignore", stdout, stderr],
  });
  execution = { exit: result.status, error: result.error?.message };
} finally {
  closeSync(stdout);
  closeSync(stderr);
}
const acceptance = run(["python", "acceptance.py"]);
const final = { exit: execution.exit, error: execution.error, acceptance,
  head: checked(["git", "rev-parse", "HEAD"]), mainUnchanged: checked(["git", "rev-parse", "main"]) === main,
  acceptanceUnchanged: hash(join(repo, "acceptance.py")) === acceptanceHash,
  status: checked(["git", "status", "--porcelain"]),
  diff: checked(["git", "diff", "--name-only", approved, "HEAD"]),
  history: checked(["git", "log", "--oneline", `${approved}..HEAD`]) };
write(join(output, "result.json"), JSON.stringify(final, null, 2));
console.log(JSON.stringify(final, null, 2));
if (execution.exit !== 0 || acceptance.exit !== 0 || !final.mainUnchanged || !final.acceptanceUnchanged) process.exitCode = 1;
