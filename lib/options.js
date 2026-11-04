import { fail } from "./run.js";

export const commands = ["install", "publish", "memory", "tools"];
export const reviewAgents = ["the-nitcracker", "pr-walkthrough", "sparring-partner"];
// This agent needs the toolchain: publish alone cannot satisfy it.
export const experienceAgent = "interactive-presentation";

const toggles = {
  "--no-system-packages": "systemPackages",
  "--no-skills": "skills",
  "--no-readside": "readside",
  "--no-memory": "memory",
  "--no-startup": "startup",
  "--no-playwright": "playwright",
  "--no-hyperframes": "hyperframes",
  "--no-demo": "demo",
};

// Toggles each command honors. install runs every phase, so it accepts all of them.
const commandToggles = {
  tools: ["systemPackages", "playwright", "hyperframes", "demo", "skills"],
  publish: ["readside", "memory"],
  memory: ["startup", "skills"],
};

const removedFlags = {
  "--project": "Repository installs were removed. Promptlings installs to user-level locations only.",
  "--project-only": "Repository installs were removed. Promptlings installs to user-level locations only.",
  "--shared-frameworks": "Shared frameworks were removed with BMAD and Spec-Kit.",
  "--no-bmad": "BMAD was removed. Spec Master and the spec-delivery skill replace it.",
  "--no-speckit": "Spec-Kit was removed. Spec Master and the spec-delivery skill replace it.",
  "--integration": "Integration selection was removed. Agents publish to every detected client.",
  "--no-dependencies": "--no-dependencies was removed. Use the publish command to skip the toolchain.",
};

export const usage = `Usage: npx promptlings [command] [options]

Commands:
  install   Toolchain, agents and skills, then Basic Memory (default)
  publish   Agents and bundled skills only. Needs nothing beyond Node.js
  memory    Basic Memory, its skills, MCP registration and login startup
  tools     System packages, applications and external skills

Agent selection (default: all):
  --all, --review, --agents NAME,NAME, --list

Options:
  --yes, -y            Approve the printed plan without a prompt
  --dry-run            Print the plan without downloading or writing
  --memory-port PORT   Basic Memory loopback port (default 8000)
  --no-system-packages, --no-skills, --no-readside, --no-memory, --no-startup,
  --no-playwright, --no-hyperframes, --no-demo
  --version, --help`;

export function parseArgs(argv, allAgents) {
  const options = {
    command: "install", agents: allAgents, yes: false, dryRun: false, memoryPort: 8000,
    list: false, help: false, version: false,
  };
  for (const key of Object.values(toggles)) options[key] = true;
  let selections = 0;
  const args = [...argv];
  if (args.length && !args[0].startsWith("-")) {
    options.command = args.shift();
    if (!commands.includes(options.command)) fail(`Unknown command: ${options.command}. Use --help.`);
  }
  const value = (flag) => {
    const next = args.shift();
    if (!next || next.startsWith("-")) fail(`${flag} requires a value.`);
    return next;
  };
  while (args.length) {
    const arg = args.shift();
    if (arg in removedFlags) fail(`${arg}: ${removedFlags[arg]}`);
    if (arg in toggles) {
      const allowed = commandToggles[options.command];
      if (allowed && !allowed.includes(toggles[arg])) fail(`${arg} does not apply to the ${options.command} command.`);
      options[toggles[arg]] = false;
      continue;
    }
    switch (arg) {
      case "--all": options.agents = allAgents; selections++; break;
      case "--review": options.agents = reviewAgents; selections++; break;
      case "--agents": options.agents = value(arg).split(","); selections++; break;
      case "--yes": case "-y": options.yes = true; break;
      case "--dry-run": options.dryRun = true; break;
      case "--memory-port": {
        const port = value(arg);
        if (!/^\d{1,5}$/.test(port) || +port < 1 || +port > 65535) fail("Invalid memory port.");
        options.memoryPort = +port;
        break;
      }
      case "--list": options.list = true; break;
      case "--help": case "-h": options.help = true; break;
      case "--version": case "-v": options.version = true; break;
      default: fail(`Unknown option: ${arg}. Use --help.`);
    }
  }
  if (selections > 1) fail("Choose only one of --all, --review or --agents.");
  const unknown = options.agents.filter((name) => !allAgents.includes(name));
  if (!options.agents.length || unknown.length) fail(`Unknown agent: ${unknown.join(", ") || "(empty)"}. Use --list.`);
  if (options.command === "memory" && !options.memory) fail("The memory command cannot be combined with --no-memory.");
  options.notices = [];
  if (options.command === "publish" && options.agents.includes(experienceAgent)) {
    if (selections) fail(`${experienceAgent} requires its dependencies. Use the install command or deselect the agent.`);
    options.agents = options.agents.filter((name) => name !== experienceAgent);
    options.notices.push(`${experienceAgent} skipped: it requires dependencies and the publish command skips them.`);
  }
  options.experience = phases(options).tools && options.agents.includes(experienceAgent);
  if (options.experience) {
    options.playwright = true;
    options.notices.push(`${experienceAgent}: installs Playwright CLI, the skills CLI, its design skills and the pinned experience toolkit regardless of opt-outs.`);
  }
  return options;
}

// Which phases a command runs. Basic Memory needs its installed command, so publish alone skips it.
export function phases(options) {
  const { command } = options;
  return {
    tools: command === "install" || command === "tools",
    publish: command === "install" || command === "publish",
    memory: options.memory && (command === "install" || command === "memory"),
  };
}
