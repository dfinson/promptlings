import { spawn as spawnAsync, spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { delimiter, dirname, extname, join } from "node:path";
import { createRequire } from "node:module";

export const windows = process.platform === "win32";

export class InstallError extends Error {}
export const fail = (message) => { throw new InstallError(message); };

export function which(name) {
  const extensions = windows && !extname(name)
    ? (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";")
    : [""];
  for (const directory of (process.env.PATH || "").split(delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = join(directory, name + extension);
      // lstat, because stat fails with EACCES on Windows app execution aliases such as winget.exe.
      try {
        const entry = lstatSync(candidate);
        if (entry.isFile() || entry.isSymbolicLink()) return candidate;
      } catch { /* absent */ }
    }
  }
  return null;
}

// Windows cannot spawn npm's .cmd shims without a shell, so their arguments are quoted for cmd.exe.
export function quoteForCmd(argument) {
  if (/["%]/.test(argument)) fail(`Unsupported character in Windows shim argument: ${argument}`);
  return /^[\w\-.:/\\=@,+]+$/.test(argument) ? argument : `"${argument}"`;
}

function spawn(command, args, options = {}) {
  const resolved = which(command) || command;
  const spawnOptions = {
    cwd: options.cwd,
    env: options.env || process.env,
    encoding: "utf8",
    stdio: options.capture ? ["inherit", "pipe", options.silent ? "pipe" : "inherit"] : "inherit",
    maxBuffer: 64 * 1024 * 1024,
  };
  if (windows && /\.(cmd|bat)$/i.test(resolved)) {
    return spawnSync([resolved, ...args].map(quoteForCmd).join(" "), { ...spawnOptions, shell: true });
  }
  return spawnSync(resolved, args, spawnOptions);
}

// Runs a command with inherited output and fails on an unexpected exit code.
export function run(command, args = [], options = {}) {
  if (!options.quiet) console.log(`+ ${command} ${args.join(" ")}`);
  const result = spawn(command, args, options);
  if (result.error) fail(`Could not run ${command}: ${result.error.message}`);
  const allowed = options.allow || [0];
  if (!allowed.includes(result.status)) fail(`Command failed (${result.status}): ${command} ${args.join(" ")}`);
  return result;
}

// Runs an executable concurrently with others, collecting stdout and stderr together so the caller can print them in order.
export function runBuffered(executable, args = [], options = {}) {
  return new Promise((resolve) => {
    let output = "";
    const child = spawnAsync(executable, args, { cwd: options.cwd, env: options.env || process.env, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", (error) => resolve({ status: null, output: `${output}${error.message}\n` }));
    child.on("close", (status) => resolve({ status, output }));
  });
}

export const capture = (command, args = [], options = {}) =>
  run(command, args, { ...options, capture: true }).stdout.trim();

export function succeeds(command, args = []) {
  const result = spawn(command, args, { capture: true });
  return !result.error && result.status === 0;
}

export function powershell(script, options = {}) {
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  return run("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
    { quiet: true, ...options });
}

const require = createRequire(import.meta.url);

function packageRoot(name) {
  try { return dirname(require.resolve(`${name}/package.json`)); } catch { /* not exported */ }
  let directory = dirname(require.resolve(name));
  while (directory !== dirname(directory)) {
    const manifest = join(directory, "package.json");
    if (existsSync(manifest) && JSON.parse(readFileSync(manifest, "utf8")).name === name) return directory;
    directory = dirname(directory);
  }
  return fail(`Cannot locate the ${name} package.`);
}

// Resolves a pinned dependency's CLI so it runs with the current Node.js on every OS.
export function packageBin(name, binName = name) {
  const root = packageRoot(name);
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const path = join(root, typeof manifest.bin === "string" ? manifest.bin : manifest.bin[binName]);
  if (!existsSync(path)) fail(`Missing ${name} executable: ${path}`);
  return path;
}

export function runPackage(name, args, options = {}) {
  console.log(`+ ${name} ${args.join(" ")}`);
  return run(process.execPath, [packageBin(name), ...args], { ...options, quiet: true });
}

export function prependPath(...directories) {
  process.env.PATH = [...directories, ...(process.env.PATH || "").split(delimiter)]
    .filter((entry, index, all) => entry && all.indexOf(entry) === index).join(delimiter);
}
