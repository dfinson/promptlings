import { access, rename, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { supportedVersion } from "./demo-runtime.mjs";

// Run only from installer setup, with cwd set to the managed runtime's package root.
const root = process.cwd();
const require = createRequire(path.join(root, "package.json"));
const version = require("@remotion/renderer/package.json").version;
if (version !== supportedVersion) throw new Error(`Expected renderer ${supportedVersion}, found ${version}`);
const { ensureBrowser } = require("@remotion/renderer");
const browser = await ensureBrowser({ chromeMode: "headless-shell" });
await access(browser.path);
const record = path.join(root, "browser.json");
const temporary = `${record}.${process.pid}.tmp`;
await writeFile(temporary, JSON.stringify({ version, browserExecutable: browser.path }, null, 2));
await rename(temporary, record);
console.log(`Remotion Headless Shell: ${browser.path}`);
