import { mkdirSync } from "node:fs";
import { join } from "node:path";

export const tokenVariable = "COPILOT_GITHUB_TOKEN";

// The only parent variables a trial inherits. Credentials, home locations and model routing are not among them.
const passthrough = new Set([
  "PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "SYSTEMDRIVE", "OS",
  "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE", "PROGRAMDATA", "PROGRAMFILES",
  "PROGRAMFILES(X86)", "PROGRAMW6432", "COMMONPROGRAMFILES", "COMMONPROGRAMFILES(X86)",
  "LANG", "LC_ALL", "LC_CTYPE", "TERM", "TZ",
  "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "SSL_CERT_DIR",
]);

const forbidden = /^COPILOT_PROVIDER_/i;

export function homePaths(home) {
  return {
    home,
    copilotHome: join(home, ".copilot"),
    temp: join(home, "tmp"),
  };
}

// Builds the complete environment for a Copilot or installer process whose home is `home`.
export function isolatedEnv(home, extra = {}, parent = process.env) {
  for (const key of Object.keys(extra)) {
    if (forbidden.test(key)) throw new Error(`${key} routes model calls outside Copilot and is never set.`);
  }
  const paths = homePaths(home);
  mkdirSync(paths.copilotHome, { recursive: true });
  mkdirSync(paths.temp, { recursive: true });
  const env = {};
  for (const key of Object.keys(parent)) {
    if (passthrough.has(key.toUpperCase()) && parent[key] !== undefined) env[key] = parent[key];
  }
  Object.assign(env, {
    HOME: home,
    USERPROFILE: home,
    COPILOT_HOME: paths.copilotHome,
    XDG_CONFIG_HOME: join(home, ".config"),
    XDG_DATA_HOME: join(home, ".local", "share"),
    XDG_STATE_HOME: join(home, ".local", "state"),
    XDG_CACHE_HOME: join(home, ".cache"),
    APPDATA: join(home, "AppData", "Roaming"),
    LOCALAPPDATA: join(home, "AppData", "Local"),
    TEMP: paths.temp,
    TMP: paths.temp,
    TMPDIR: paths.temp,
    COPILOT_TELEMETRY_DISABLED: "true",
    COPILOT_AUTO_UPDATE: "false",
    NO_COLOR: "1",
  });
  for (const key of ["XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_STATE_HOME", "XDG_CACHE_HOME", "APPDATA", "LOCALAPPDATA"]) {
    mkdirSync(env[key], { recursive: true });
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null) env[key] = String(value);
  }
  return env;
}
