import { spawnSync } from "node:child_process";
import { accessSync, appendFileSync, constants, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pins } from "./pins.js";
import { capture, fail, packageBin, powershell, prependPath, run, runBuffered, succeeds, which, windows } from "./run.js";

// WinGet reports an already-current package as "no applicable update". Node may surface it unsigned.
const wingetCurrent = [0, -1978335189, 2316632107];

// First string value printed by `reg query`, with %VARIABLE% references expanded from the environment.
export function regString(output, env = process.env) {
  const value = /^\s+.+?\s{4}REG_(?:EXPAND_)?SZ\s{4}(.*)$/m.exec(output ?? "")?.[1]?.trim();
  return value ? value.replace(/%([^%]+)%/g, (whole, name) => env[name] ?? whole) : null;
}

const regQuery = (key, args) => {
  const result = spawnSync("reg", ["query", key, ...args], { encoding: "utf8", windowsHide: true });
  return result.status === 0 ? regString(result.stdout) : null;
};

function refreshWindowsPath() {
  const machine = regQuery("HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment", ["/v", "Path"]);
  const user = regQuery("HKCU\\Environment", ["/v", "Path"]);
  prependPath(...[machine, user].filter(Boolean).join(";").split(";"));
}

// Document rendering needs either Microsoft Word or LibreOffice.
function windowsWordPath() {
  for (const hive of ["HKLM", "HKCU"]) {
    const path = regQuery(`${hive}\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Winword.exe`, ["/ve"]);
    if (path && existsSync(path)) return path;
  }
  return null;
}

const windowsOffice = () => join(process.env.ProgramFiles || "C:\\Program Files", "LibreOffice", "program");

// Selects the WinGet packages whose commands are not already usable. Probes are functions so unneeded ones never run.
export function windowsPackageIds(options, present) {
  const packages = [["Python.Python.3.12", present.python], ["Git.Git", present.git], ["GitHub.cli", present.gh],
    ["astral-sh.uv", present.uv]];
  if (options.hyperframes || options.demo) packages.push(["Gyan.FFmpeg", present.ffmpeg]);
  if (options.demo) {
    packages.push(["oschwartz10612.Poppler", present.poppler], ["Microsoft.VisualStudioCode", present.code],
      ["TheDocumentFoundation.LibreOffice", present.office]);
  }
  return packages.filter(([, found]) => !found()).map(([id]) => id);
}

// First word of each listed line: package names from `brew list --versions`.
export const listedNames = (output) => new Set(output.split(/\r?\n/).map((line) => line.trim().split(/\s+/)[0]).filter(Boolean));

// Packages that `dpkg-query -W -f '${Package} ${db:Status-Status}\n'` reports as installed.
export const dpkgInstalled = (output) => new Set(output.split(/\r?\n/).map((line) => line.trim().split(/\s+/))
  .filter(([name, status]) => name && status === "installed").map(([name]) => name));

function windowsPackages(options) {
  refreshWindowsPath();
  const packages = windowsPackageIds(options, {
    python: () => Boolean(findPython()),
    git: () => which("git"),
    gh: () => which("gh"),
    uv: () => which("uv"),
    ffmpeg: () => which("ffmpeg") && which("ffprobe"),
    poppler: () => which("pdftoppm"),
    code: () => which("code"),
    office: () => windowsWordPath() || which("soffice.com") || existsSync(join(windowsOffice(), "soffice.com")),
  });
  if (!packages.length) { console.log("Native packages are already present."); return; }
  if (!which("winget")) fail("Install Microsoft's App Installer (WinGet): https://aka.ms/getwinget . Then rerun.");
  for (const id of packages) {
    run("winget", ["install", "--id", id, "--exact", "--source", "winget", "--accept-package-agreements",
      "--accept-source-agreements", "--disable-interactivity"], { allow: wingetCurrent });
  }
  refreshWindowsPath();
}

function macPackages(options, temporary) {
  if (!which("brew")) {
    run("curl", ["-fsSL", "https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh", "-o", join(temporary, "homebrew.sh")]);
    run("/bin/bash", [join(temporary, "homebrew.sh")]);
  }
  const prefix = process.arch === "arm64" ? "/opt/homebrew" : "/usr/local";
  const brew = `${prefix}/bin/brew`;
  if (!existsSync(brew)) fail("Homebrew was not installed at its standard location.");
  prependPath(`${prefix}/bin`, `${prefix}/sbin`);
  const shellenv = `eval "$(${brew} shellenv)"`;
  const profile = join(homedir(), (process.env.SHELL || "").endsWith("/zsh") ? ".zprofile" : ".bash_profile");
  const current = existsSync(profile) ? readFileSync(profile, "utf8") : "";
  if (!current.split("\n").includes(shellenv)) appendFileSync(profile, `\n${shellenv}\n`);
  const packages = ["python@3.12", "git", "gh", "uv"];
  if (options.hyperframes || options.demo) packages.push("ffmpeg");
  if (options.demo) packages.push("poppler");
  const listed = listedNames(run(brew, ["list", "--versions", ...packages],
    { capture: true, silent: true, quiet: true, allow: [0, 1] }).stdout);
  const missing = packages.filter((name) => !listed.has(name));
  if (missing.length) run(brew, ["install", ...missing]);
  else console.log("Homebrew packages are already present.");
  const casks = [];
  if (options.demo) {
    if (!which("code") && !existsSync("/Applications/Visual Studio Code.app")) casks.push("visual-studio-code");
    if (!which("soffice") && !existsSync("/Applications/LibreOffice.app") && !existsSync("/Applications/Microsoft Word.app")) {
      casks.push("libreoffice");
    }
  }
  if (casks.length) run(brew, ["install", "--cask", ...casks]);
}

function linuxPackages(options, temporary) {
  const release = Object.fromEntries(readFileSync("/etc/os-release", "utf8").split("\n")
    .map((line) => line.match(/^(\w+)=(.*)$/)).filter(Boolean).map(([, key, value]) => [key, value.replace(/^"|"$/g, "")]));
  if (release.ID !== "ubuntu" && release.ID !== "debian") fail("Supported Linux distributions: Ubuntu 24.04+ and Debian 12+.");
  if (parseInt(release.VERSION_ID, 10) < (release.ID === "ubuntu" ? 24 : 12)) fail("Upgrade to Ubuntu 24.04+ or Debian 12+.");
  if (process.arch !== "x64") fail("The default Chrome-based Playwright recipe requires Linux x86_64.");
  if (process.getuid() === 0) fail("Run as your normal user. The installer uses sudo for system packages.");
  const packages = ["ca-certificates", "curl", "git", "gh", "python3", "python3-venv"];
  if (options.hyperframes || options.demo) packages.push("ffmpeg");
  if (options.demo) packages.push("poppler-utils");
  if (options.demo && !which("soffice")) packages.push("libreoffice-writer", "libreoffice-impress");
  const chrome = "google-chrome-stable";
  const installed = dpkgInstalled(run("dpkg-query", ["-W", "-f", "${Package} ${db:Status-Status}\\n", ...packages, chrome],
    { capture: true, silent: true, quiet: true, allow: [0, 1] }).stdout);
  const missing = packages.filter((name) => !installed.has(name));
  const needCode = options.demo && !which("code");
  const needChrome = (options.playwright || options.hyperframes) && !installed.has(chrome);
  if (missing.length || needCode || needChrome) run("sudo", ["apt-get", "update"]);
  if (missing.length) run("sudo", ["apt-get", "install", "-y", ...missing]);
  else console.log("APT packages are already present.");
  // curl honors the environment's proxy settings.
  const deb = (url, name) => {
    const path = join(temporary, name);
    run("curl", ["-fsSL", url, "-o", path]);
    run("sudo", ["apt-get", "install", "-y", path]);
  };
  if (needCode) deb("https://update.code.visualstudio.com/latest/linux-deb-x64/stable", "code.deb");
  if (needChrome) deb("https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb", "chrome.deb");
  if (!which("uv") && !existsSync(join(homedir(), ".local", "bin", "uv"))) {
    run("curl", ["-fsSL", "https://astral.sh/uv/install.sh", "-o", join(temporary, "uv.sh")]);
    run("sh", [join(temporary, "uv.sh")], { env: { ...process.env, UV_NO_MODIFY_PATH: "1" } });
  }
}

export function systemPackages(options, temporary) {
  if (windows) windowsPackages(options);
  else if (process.platform === "darwin") macPackages(options, temporary);
  else if (process.platform === "linux") linuxPackages(options, temporary);
  else fail("Supported systems: Windows, macOS, Ubuntu 24.04+ and Debian 12+.");
}

export function findPython() {
  const candidates = windows ? ["python", "python3"] : ["python3.12", "python3", "python"];
  return candidates.find((name) => which(name) && succeeds(name, ["-c", "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)"]));
}

export function uvToolInstall(spec) {
  run("uv", ["tool", "install", "--force", "--python", "3.12", spec]);
}

export function uvToolPath() {
  run("uv", ["tool", "update-shell"]);
  if (windows) refreshWindowsPath();
  prependPath(capture("uv", ["tool", "dir", "--bin"]));
}

const splitSpec = (spec) => {
  const at = spec.lastIndexOf("@");
  return at > 0 ? [spec.slice(0, at), spec.slice(at + 1)] : [spec, ""];
};

function installedManifest(root, name) {
  const manifest = join(root, name, "package.json");
  if (!existsSync(manifest)) return null;
  try { return JSON.parse(readFileSync(manifest, "utf8")); } catch { return null; }
}

// Pinned specs not installed at exactly their pinned version under the global root.
export function npmMissing(root, specs) {
  return specs.filter((spec) => {
    const [name, version] = splitSpec(spec);
    const actual = installedManifest(root, name);
    return !actual || actual.name !== name || (version && actual.version !== version);
  });
}

let npmRoot;
const globalRoot = () => (npmRoot ??= capture("npm", ["root", "--global"], { quiet: true }).trim());

function npmGlobal(specs) {
  if (!specs.length) return;
  const packages = npmMissing(globalRoot(), specs);
  if (!packages.length) { console.log("Global npm packages are already at their pinned versions."); return; }
  const prefix = capture("npm", ["prefix", "--global"], { quiet: true });
  const modules = windows ? prefix : join(prefix, "lib");
  let writable = true;
  try { accessSync(modules, constants.W_OK); } catch { writable = false; }
  if (writable) { run("npm", ["install", "--global", ...packages]); return; }
  // System Node.js installs need root for global packages. Pass a minimal PATH that still finds this node,
  // and keep the user's proxy and npm settings, which sudo drops with the environment and HOME.
  const npm = which("npm");
  const path = [dirname(process.execPath), dirname(npm), "/usr/bin", "/bin"].join(":");
  const userConfig = join(homedir(), ".npmrc");
  run("sudo", ["--preserve-env=npm_config_registry,NPM_CONFIG_REGISTRY,HTTPS_PROXY,https_proxy,HTTP_PROXY,http_proxy,NO_PROXY,no_proxy",
    "env", `PATH=${path}`, npm, "install", "--global",
    ...(existsSync(userConfig) ? ["--userconfig", userConfig] : []), ...packages]);
}

export function skillsAdd(runSkills, sources) {
  for (const source of pendingSkillSources(sources)) {
    runSkills(["add", source, "--global", "--skill", "*", "--yes", "--copy"], { env: { ...process.env, DISABLE_TELEMETRY: "1" } });
  }
}

export const skillLockPath = (env = process.env) =>
  env.XDG_STATE_HOME ? join(env.XDG_STATE_HOME, "skills", ".skill-lock.json") : join(homedir(), ".agents", ".skill-lock.json");

const readJson = (path) => { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; } };

// A pinned source counts as installed when the lock holds skills from the same repository, commit and path,
// and each of those skills is still present in the global skills directory.
export function skillSourceInstalled(lock, source, present) {
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/tree\/([^/]+)(?:\/(.+?))?\/?$/.exec(source);
  if (!match) return false;
  const [, repo, ref, path = ""] = match;
  const entries = Object.entries(lock?.skills ?? {}).filter(([, entry]) =>
    entry.sourceType === "github" && entry.ref === ref && Boolean(entry.skillPath)
    && (!path || entry.skillPath.startsWith(`${path}/`))
    && (entry.source === repo || entry.sourceUrl === `https://github.com/${repo}.git`));
  return entries.length > 0 && entries.every(([name]) => present(name));
}

export function pendingSkillSources(sources, lock = readJson(skillLockPath()),
  present = (name) => existsSync(join(homedir(), ".agents", "skills", name, "SKILL.md"))) {
  const pending = sources.filter((source) => !skillSourceInstalled(lock, source, present));
  for (const source of sources) if (!pending.includes(source)) console.log(`= skills already installed: ${source}`);
  return pending;
}

// Folds per-run skill lock entries into the shared lock, keeping each skill's original install time.
export function mergeSkillLocks(shared, runs) {
  const merged = shared && typeof shared.version === "number" && shared.skills ? shared : null;
  const result = merged ?? { version: runs.find(Boolean)?.version ?? 3, skills: {}, dismissed: {} };
  for (const lock of runs) {
    for (const [name, entry] of Object.entries(lock?.skills ?? {})) {
      result.skills[name] = { ...entry, installedAt: result.skills[name]?.installedAt ?? entry.installedAt };
    }
  }
  return result;
}

// The skills CLI rewrites one global lock file per skill, so concurrent runs each get a private lock directory
// and the entries are merged afterwards. Installed skill directories are distinct per skill.
export async function skillsAddConcurrent(sources, runner = (args, options) => runBuffered(process.execPath, [packageBin("skills"), ...args], options)) {
  if (!sources.length) return;
  const states = mkdtempSync(join(tmpdir(), "promptlings-skills-"));
  try {
    console.log(`+ skills add (${sources.length} sources in parallel)`);
    const results = await Promise.all(sources.map((source, index) => {
      const state = join(states, String(index));
      mkdirSync(state);
      return runner(["add", source, "--global", "--skill", "*", "--yes", "--copy"],
        { env: { ...process.env, DISABLE_TELEMETRY: "1", CI: "true", XDG_STATE_HOME: state } })
        .then((result) => ({ ...result, source, lock: join(state, "skills", ".skill-lock.json") }));
    }));
    for (const { source, output } of results) console.log(`+ skills add ${source}\n${output.trimEnd()}`);
    const lockPath = skillLockPath();
    const runs = results.map(({ lock }) => readJson(lock));
    if (runs.some((lock) => lock && Object.keys(lock.skills ?? {}).length)) {
      mkdirSync(dirname(lockPath), { recursive: true });
      writeFileSync(lockPath, JSON.stringify(mergeSkillLocks(readJson(lockPath), runs), null, 2), "utf8");
    }
    const failed = results.filter(({ status }) => status !== 0);
    if (failed.length) fail(`External skill installation failed: ${failed.map(({ source, status }) => `${source} (${status})`).join(", ")}`);
  } finally {
    rmSync(states, { recursive: true, force: true });
  }
}

function demoSetup() {
  if (process.platform === "darwin") {
    const code = "/Applications/Visual Studio Code.app/Contents/Resources/app/bin";
    if (!which("code") && existsSync(join(code, "code"))) prependPath(code);
    if (!which("soffice") && existsSync("/Applications/LibreOffice.app/Contents/MacOS/soffice")) {
      prependPath("/Applications/LibreOffice.app/Contents/MacOS");
    }
  }
  if (windows && !which("soffice.com") && existsSync(join(windowsOffice(), "soffice.com"))) {
    // LibreOffice does not add its program directory to PATH.
    powershell(`$path = [Environment]::GetEnvironmentVariable("Path", "User")
[Environment]::SetEnvironmentVariable("Path", ((@($path, '${windowsOffice().replace(/'/g, "''")}') | Where-Object { $_ }) -join ";"), "User")`);
    prependPath(windowsOffice());
  }
  const [extension, version] = pins.demoTimeExtension.split("@");
  if (existsSync(join(homedir(), ".vscode", "extensions", `${extension.toLowerCase()}-${version}`, "package.json"))) {
    console.log(`= VS Code extension already installed: ${pins.demoTimeExtension}`);
  } else run("code", ["--install-extension", pins.demoTimeExtension]);
}

function installDemoRuntime() {
  const root = join(homedir(), ".promptlings", "runtimes", `remotion-${pins.demoDependencies.remotion}`);
  const manifestPath = join(root, "package.json");
  const expected = { name: "promptlings-demo-runtime", private: true, dependencies: pins.demoDependencies };
  const existing = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  if (existing && existing.name !== expected.name) fail(`Refusing to overwrite an unrelated runtime manifest: ${manifestPath}`);
  const specs = Object.entries(pins.demoDependencies).map(([name, version]) => `${name}@${version}`);
  const changed = JSON.stringify(existing) !== JSON.stringify(expected);
  mkdirSync(root, { recursive: true });
  if (changed) writeFileSync(manifestPath, JSON.stringify(expected, null, 2) + "\n");
  if (changed || npmMissing(join(root, "node_modules"), specs).length) {
    run("npm", ["install", "--no-audit", "--no-fund"], { cwd: root });
  } else console.log("Demo runtime packages are already at their pinned versions.");
  const missing = npmMissing(join(root, "node_modules"), specs);
  if (missing.length) fail(`Demo runtime packages missing or mismatched: ${missing.join(", ")}`);
  run(process.execPath, [
    join(root, "node_modules", "@remotion", "cli", "remotion-cli.js"), "browser", "ensure",
  ], { cwd: root });
  console.log(`Demo runtime: ${root}`);
}

// Confirms each pinned experience package is installed at its exact version under the global root.
export function verifyExperience(root, packages) {
  for (const spec of packages) {
    const [name, version] = splitSpec(spec);
    const manifest = join(root, name, "package.json");
    if (!existsSync(manifest)) fail(`Experience toolkit package missing: ${name}`);
    const actual = JSON.parse(readFileSync(manifest, "utf8"));
    if (actual.name !== name || (version && actual.version !== version)) {
      fail(`Experience toolkit version mismatch: expected ${name}@${version}, found ${actual.name}@${actual.version}`);
    }
  }
}

export function externalSkillSources(options) {
  return [...new Set([
    ...(options.skills ? [
      options.playwright && pins.playwrightSkills,
      options.hyperframes && pins.hyperframesSkills,
      options.demo && pins.demoTimeSkills,
      options.demo && pins.vscodePlaywrightSkill,
      options.demo && pins.motioniteSkills,
    ] : []),
    ...(options.experience ? [pins.frontendDesignSkill, pins.playwrightSkills, pins.hyperframesSkills] : []),
  ].filter(Boolean))];
}

// System packages, global command-line tools, browsers and external skills.
export async function installTools(options, temporary) {
  if (options.systemPackages) systemPackages(options, temporary);
  prependPath(join(homedir(), ".local", "bin"));
  for (const command of ["uv", "git", "gh"]) if (!which(command)) fail(`Missing prerequisite: ${command}.`);
  if (!findPython()) fail("Python 3.11+ is required. Install it normally or rerun without --no-system-packages.");
  npmGlobal([
    options.playwright && pins.playwright,
    options.hyperframes && pins.hyperframes,
    options.demo && pins.diff2html,
    ...(options.experience ? pins.experiencePackages : []),
  ].filter(Boolean));
  if (options.experience) {
    const root = globalRoot();
    verifyExperience(root, pins.experiencePackages);
    console.log(`Experience toolkit: ${root}`);
  }
  uvToolPath();
  await skillsAddConcurrent(pendingSkillSources(externalSkillSources(options)));
  if (options.playwright) run("playwright-cli", ["install-browser", "chrome"]);
  if (options.hyperframes) run("hyperframes", ["browser", "ensure"]);
  if (options.demo) {
    demoSetup();
    installDemoRuntime();
  }
}
