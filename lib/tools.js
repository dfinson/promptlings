import { accessSync, appendFileSync, constants, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pins } from "./pins.js";
import { capture, fail, powershell, prependPath, run, succeeds, which, windows } from "./run.js";

// WinGet reports an already-current package as "no applicable update". Node may surface it unsigned.
const wingetCurrent = [0, -1978335189, 2316632107];

function refreshWindowsPath() {
  const persisted = powershell(
    '[Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")',
    { capture: true },
  ).stdout.trim();
  prependPath(...persisted.split(";"));
}

// Document rendering needs either Microsoft Word or LibreOffice.
function windowsWordPath() {
  const script = `foreach ($hive in "HKLM:", "HKCU:") {
  $path = (Get-ItemProperty -LiteralPath "$hive\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Winword.exe" -ErrorAction SilentlyContinue).'(default)'
  if ($path -and (Test-Path -LiteralPath $path)) { $path; break }
}`;
  return powershell(script, { capture: true }).stdout.trim() || null;
}

const windowsOffice = () => join(process.env.ProgramFiles || "C:\\Program Files", "LibreOffice", "program");

function windowsPackages(options) {
  if (!which("winget")) fail("Install Microsoft's App Installer (WinGet): https://aka.ms/getwinget . Then rerun.");
  const packages = ["Python.Python.3.12", "Git.Git", "GitHub.cli", "astral-sh.uv"];
  if (options.hyperframes || options.demo) packages.push("Gyan.FFmpeg");
  if (options.demo) {
    packages.push("oschwartz10612.Poppler");
    if (!which("code")) packages.push("Microsoft.VisualStudioCode");
    if (!windowsWordPath() && !which("soffice.com") && !existsSync(join(windowsOffice(), "soffice.com"))) {
      packages.push("TheDocumentFoundation.LibreOffice");
    }
  }
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
  run(brew, ["install", ...packages]);
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
  run("sudo", ["apt-get", "update"]);
  const packages = ["ca-certificates", "curl", "git", "gh", "python3", "python3-venv"];
  if (options.hyperframes || options.demo) packages.push("ffmpeg");
  if (options.demo) packages.push("poppler-utils");
  if (options.demo && !which("soffice")) packages.push("libreoffice-writer", "libreoffice-impress");
  run("sudo", ["apt-get", "install", "-y", ...packages]);
  // curl honors the environment's proxy settings.
  const deb = (url, name) => {
    const path = join(temporary, name);
    run("curl", ["-fsSL", url, "-o", path]);
    run("sudo", ["apt-get", "install", "-y", path]);
  };
  if (options.demo && !which("code")) deb("https://update.code.visualstudio.com/latest/linux-deb-x64/stable", "code.deb");
  if (options.playwright || options.hyperframes) {
    deb("https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb", "chrome.deb");
  }
  run("curl", ["-fsSL", "https://astral.sh/uv/install.sh", "-o", join(temporary, "uv.sh")]);
  run("sh", [join(temporary, "uv.sh")], { env: { ...process.env, UV_NO_MODIFY_PATH: "1" } });
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

function npmGlobal(packages) {
  if (!packages.length) return;
  const prefix = capture("npm", ["prefix", "--global"], { quiet: true });
  const modules = windows ? prefix : join(prefix, "lib");
  let writable = true;
  try { accessSync(modules, constants.W_OK); } catch { writable = false; }
  if (writable) { run("npm", ["install", "--global", ...packages]); return; }
  // System Node.js installs need root for global packages. sudo would otherwise reset PATH and lose node.
  run("sudo", ["--preserve-env=npm_config_registry,NPM_CONFIG_REGISTRY", "env", `PATH=${process.env.PATH}`,
    "npm", "install", "--global", ...packages]);
}

export function skillsAdd(runSkills, sources) {
  for (const source of sources) {
    runSkills(["add", source, "--global", "--skill", "*", "--yes", "--copy"], { env: { ...process.env, DISABLE_TELEMETRY: "1" } });
  }
}

function playwrightSmoke(temporary) {
  run("playwright-cli", ["install-browser", "chrome"]);
  const session = `-s=promptlings-install-${process.pid}`;
  try {
    run("playwright-cli", [session, "open", "about:blank"], { cwd: temporary });
    const title = capture("playwright-cli",
      [session, "eval", "() => { document.title = 'promptlings'; return document.title; }", "--raw"], { cwd: temporary });
    if (title.replace(/^"|"$/g, "") !== "promptlings") fail(`Playwright CLI browser smoke check failed: ${title}`);
  } finally {
    run("playwright-cli", [session, "close"], { cwd: temporary });
  }
}

function hyperframesCheck() {
  run("ffmpeg", ["-version"]);
  run("ffprobe", ["-version"]);
  run("hyperframes", ["browser", "ensure"]);
  const report = JSON.parse(capture("hyperframes", ["doctor", "--json"]));
  const failed = ["FFmpeg", "FFprobe", "Chrome"].filter((name) => !report.checks.some((check) => check.name === name && check.ok));
  if (failed.length) fail(`HyperFrames prerequisites failed: ${failed.join(", ")}`);
  run("hyperframes", ["--version"]);
}

function demoCheck() {
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
  run("code", ["--version"]);
  run("code", ["--install-extension", pins.demoTimeExtension]);
  const office = windows ? "soffice.com" : "soffice";
  if (which(office)) run(office, ["--version"]);
  else if (windows && windowsWordPath()) console.log("Document rendering: Microsoft Word.");
  else if (process.platform === "darwin" && existsSync("/Applications/Microsoft Word.app")) console.log("Document rendering: Microsoft Word.");
  else fail("Document rendering needs Microsoft Word or LibreOffice.");
  run("pdftoppm", ["-v"]);
  run("ffmpeg", ["-version"]);
  run("diff2html", ["--version"]);
}

// System packages, global command-line tools, external skills and their smoke checks.
export function installTools(options, temporary, runSkills) {
  if (options.systemPackages) systemPackages(options, temporary);
  prependPath(join(homedir(), ".local", "bin"));
  for (const command of ["uv", "git", "gh"]) if (!which(command)) fail(`Missing prerequisite: ${command}.`);
  if (!findPython()) fail("Python 3.11+ is required. Install it normally or rerun without --no-system-packages.");
  run("git", ["--version"]);
  run("gh", ["--version"]);
  npmGlobal([
    options.bmad && pins.bmad,
    options.playwright && pins.playwright,
    options.hyperframes && pins.hyperframes,
    options.demo && pins.diff2html,
  ].filter(Boolean));
  if (options.speckit) uvToolInstall(pins.speckit);
  uvToolPath();
  if (options.speckit) run("specify", ["version"]);
  if (options.bmad) run("bmad-method", ["--version"]);
  if (options.skills) {
    skillsAdd(runSkills, [
      options.playwright && pins.playwrightSkills,
      options.hyperframes && pins.hyperframesSkills,
      options.demo && pins.demoTimeSkills,
      options.demo && pins.vscodePlaywrightSkill,
    ].filter(Boolean));
  }
  if (options.playwright) playwrightSmoke(temporary);
  if (options.hyperframes) hyperframesCheck();
  if (options.demo) demoCheck();
}
