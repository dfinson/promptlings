// Independent acceptance at the actual integration worktree, preserving original observations.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export function runCommand(cwd, argv) {
  return new Promise((complete) => {
    const child = spawn(argv[0], argv.slice(1), {
      cwd, windowsHide: true,
      env: { ...process.env, GIT_PAGER: "cat", GIT_TERMINAL_PROMPT: "0", PYTHONDONTWRITEBYTECODE: "1",
        GIT_AUTHOR_DATE: "2026-11-04T00:00:00Z", GIT_COMMITTER_DATE: "2026-11-04T00:00:00Z" },
    });
    let stdout = "", stderr = "", error, timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 120000);
    timer.unref();
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.once("error", (failure) => { error = failure.message; });
    child.once("close", (exit, signal) => {
      clearTimeout(timer);
      complete({ argv, cwd, exit, stdout, stderr,
        error: error ?? (timedOut ? "Command exceeded 120 seconds" :
          signal ? `Process terminated by ${signal}` : undefined) });
    });
  });
}

async function git(cwd, ...args) {
  const result = await runCommand(cwd, ["git", ...args]);
  if (result.exit !== 0) throw new Error(JSON.stringify(result));
  return result.stdout.trim();
}

export async function verifyDelivery(directory, result) {
  const repo = resolve(directory, "repo");
  let integration = repo;
  const audit = readFileSync(join(directory, "audit.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
  for (const event of audit) {
    if (!event.argv?.includes("merge") || !event.argv.some((part) => part.endsWith("gate.py")) ||
        !event.stdout?.trim().startsWith("{")) continue;
    const report = JSON.parse(event.stdout);
    if (!report.integration_head) continue;
    const location = report.evidence?.[0]?.cwd;
    if (!location) throw new Error("Merge evidence lacks its integration worktree");
    const target = resolve(location);
    const fromRepo = relative(repo, target);
    if (fromRepo && (isAbsolute(fromRepo) || fromRepo === ".." || fromRepo.startsWith(`..${sep}`))) {
      throw new Error("Integration evidence points outside this fixture");
    }
    integration = target;
  }
  const expectedBlob = await git(integration, "rev-parse", `${result.approved}:acceptance.py`);
  const actualBlob = await git(integration, "hash-object", "--path=acceptance.py", "acceptance.py");
  const acceptanceUnchanged = actualBlob === expectedBlob;
  const final = {
    head: await git(integration, "rev-parse", "HEAD"),
    main: await git(integration, "rev-parse", "main"),
    branch: await git(integration, "branch", "--show-current"),
    status: await git(integration, "status", "--porcelain"),
    log: await git(integration, "log", "--all", "--format=%H %P %s"),
    diff: await git(integration, "diff", result.approved, "--"),
  };
  const acceptance = acceptanceUnchanged ? await runCommand(integration, ["python", "acceptance.py"]) : {
    argv: ["python", "acceptance.py"], cwd: integration, exit: null,
    error: "Acceptance differs from its approved Git content. Refusing to execute the changed script.",
  };
  return {
    integration, selection: integration === repo ? "fixture root" : "recorded merge worktree",
    expectedAcceptanceBlob: expectedBlob, actualAcceptanceBlob: actualBlob, acceptanceUnchanged,
    mainUnchanged: final.main === (result.mainAtStart ?? result.approved), final, acceptance,
  };
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  if (!process.argv.includes("--run") || !process.argv[3]) {
    throw new Error("Use --run <existing external benchmark directory>");
  }
  const directory = resolve(process.argv[3]);
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const fromRoot = relative(root, directory);
  if (!fromRoot || (!isAbsolute(fromRoot) && fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`))) {
    throw new Error("Delivery verification must use an external benchmark directory");
  }
  for (const name of readdirSync(directory)) {
    const trial = join(directory, name);
    const path = join(trial, "result.json");
    if (!existsSync(path)) continue;
    const result = JSON.parse(readFileSync(path, "utf8"));
    if (!["single", "multi"].includes(result.kind)) continue;
    if (result.error || !result.approved || !result.final) {
      console.log(JSON.stringify({ run: name, evidence: "Incomplete generation, not a delivery verdict" }));
      continue;
    }
    const destination = join(trial, "delivery-verification.json");
    if (existsSync(destination)) {
      console.log(JSON.stringify({ run: name, evidence: "Existing verification preserved" }));
      continue;
    }
    const verification = await verifyDelivery(trial, result);
    writeFileSync(destination, JSON.stringify(verification, null, 2));
    console.log(JSON.stringify({ run: name, integration: verification.integration,
      head: verification.final.head, e2e: verification.acceptance.exit,
      acceptanceUnchanged: verification.acceptanceUnchanged, mainUnchanged: verification.mainUnchanged }));
  }
}
