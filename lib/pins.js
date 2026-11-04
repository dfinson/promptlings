// Pinned upstream tools. The publishers (skills, rulesync, add-mcp) are pinned as package dependencies.
// BMAD and Spec-Kit versions must match skills/promptlings-repo-init/scripts; tests enforce it.
export const pins = {
  bmad: "bmad-method@6.12.4",
  speckit: "git+https://github.com/github/spec-kit.git@v1.2.5",
  memory: "basic-memory==0.24.1",
  mcpRemote: "mcp-remote@0.15.2",
  playwright: "@playwright/cli@0.1.22",
  hyperframes: "hyperframes@0.8.202",
  diff2html: "diff2html-cli@5.2.15",
  demoTimeExtension: "eliostruyf.vscode-demo-time@2.4.0",
  memorySkills: "https://github.com/basicmachines-co/basic-memory/tree/ac064607a688720cf44037e27ea55552bc5edede/skills",
  playwrightSkills: "https://github.com/microsoft/playwright-cli/tree/b85c7a736bb473bf55b584e54a09ffa698d6d871/skills/playwright-cli",
  demoTimeSkills: "https://github.com/estruyf/vscode-demo-time/tree/96175a9b64a4f6e066720315e8119f8a7ea6cf5e/skills",
  vscodePlaywrightSkill: "https://github.com/microsoft/hve-core/tree/c0726875613fed25bcd7d6d42cc720b96bfe1dda/.github/skills/experimental/vscode-playwright",
  hyperframesSkills: "https://github.com/heygen-com/hyperframes/tree/618c486734b3cbb697bd432bace7e9642e48b6be/skills",
  frontendDesignSkill: "https://github.com/anthropics/skills/tree/41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f/skills/frontend-design",
  // Interactive Presentation's pinned global toolkit.
  experiencePackages: [
    "esbuild@0.28.2", "shiki@4.5.0", "@shikijs/magic-move@4.5.0", "flubber@0.4.2", "roughjs@4.6.6", "d3@7.9.0",
    "@dagrejs/dagre@3.1.3", "axe-core@4.14.0", "lucide-static@1.62.0", "@tabler/icons@3.50.0",
    "@fontsource-variable/inter@5.3.0", "@fontsource/ibm-plex-sans@5.3.0", "@fontsource/ibm-plex-mono@5.3.0",
    "@fontsource-variable/space-grotesk@5.3.0", "@fontsource-variable/jetbrains-mono@5.3.0",
    "@fontsource-variable/fraunces@5.3.0", "@fontsource-variable/newsreader@5.3.0", "@fontsource/instrument-serif@5.3.0",
    "@fontsource-variable/caveat@5.3.0",
  ],
};

// Only targets with a dedicated global rule file. Others share a root file rulesync would replace.
export const ruleTargets = [
  "antigravity-cli", "antigravity-ide", "augmentcode", "bob", "claudecode", "cline", "codebuddy",
  "copilot", "copilotcli", "devin", "firebender", "grokcli", "kilo", "kiro-cli", "kiro-ide",
  "mimocode", "omp", "opencode", "qoder", "qwencode", "tabnine", "zoocode",
].join(",");

export const versionOf = (spec) => spec.slice(spec.lastIndexOf("@") + 1).replace(/^v/, "");
