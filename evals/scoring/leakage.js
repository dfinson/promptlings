import { existsSync, readFileSync } from 'node:fs';

/**
 * Transcript audit for benchmark leakage. A trial whose tool calls reach PR pages, PR or issue
 * comments, commits on the upstream host, or the benchmark's own golden data is invalidated.
 * Tool-call arguments are scanned (not tool output or model prose), so reading a URL in the diff
 * does not count; issuing a request for it does. Shell tools are analysed by what they execute:
 * commands in command position, shells fed a body, and process launches or network calls in
 * script source; text that only mentions `gh` or a PR URL does not count. Local file tools are
 * exempt because writing text contacts nothing. Other tools get the plain text rules.
 */

const GITHUB_WEB = /github\.com\/[\w.-]+\/[\w.-]+\/(?:pull|pulls|issues|commit|commits|compare)\b/i;
const GITHUB_API = /api\.github\.com\/(?:repos\/[\w.-]+\/[\w.-]+\/(?:pulls|issues|commits|compare|comments)|search\/(?:issues|commits))/i;
const BENCH_DATA = /review-bench\.ai|github\.com\/review-bench\/reviewbench\b|raw\.githubusercontent\.com\/review-bench\/|review-bench\/reviewbench\/(?:golden|corpus)/i;
const GH_CLI = /(?:^|[\s;&|(`"'])gh(?:\.exe)?\s+(?:pr|api|issue|search|browse|repo\s+view)\b/i;
const HTTP_CLIENT = /(?:^|[\s;&|(`"'])(?:curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)(?:\.exe)?\b[^\n]*\b(?:github(?:usercontent)?\.com|review-bench)/i;
const GIT_REMOTE = /\bgit\s+(?:[\w.-]+\s+)*?(?:fetch|pull|ls-remote|clone)\s+[^\n]*https?:\/\//i;
const WEB_TOOL = /^(?:web_fetch|fetch|web_search|search_web|webfetch|bing_search|browser_\w+)$/i;
const MCP_PR_TOOL = /(?:^|[-_.])(?:github|gh)[-_.].*(?:pull|issue|comment|review|commit)/i;
/**
 * Tools that only read or write local files or report status. Their arguments are file content
 * or patterns, so text naming `gh pr` or a PR URL contacts nothing. Shell tools and any tool not
 * listed here (which may run commands or reach the network) are still scanned.
 */
export const LOCAL_FILE_TOOL = /^(?:apply_patch|create|edit|view|str_replace_editor|str_replace_based_edit_tool|str_replace|insert|write|write_file|create_file|read|read_file|multi_edit|glob|grep|rg|ls|list_dir|list_directory|find_files|search_files|report_intent|task_complete|update_todo|todo_write)$/i;

export const RULES = [
  { id: 'github-pr-page', re: GITHUB_WEB, why: 'requests a GitHub PR, issue, commit or compare page' },
  { id: 'github-pr-api', re: GITHUB_API, why: 'requests GitHub PR, issue, commit or comment data through the API' },
  { id: 'benchmark-data', re: BENCH_DATA, why: 'requests ReviewBench leaderboard or golden data' },
  { id: 'gh-cli', re: GH_CLI, why: 'runs gh against PRs, issues or the API' },
  { id: 'http-client', re: HTTP_CLIENT, why: 'fetches from GitHub with an HTTP client' },
  { id: 'git-remote', re: GIT_REMOTE, why: 'contacts a remote Git host' },
];

function stringify(value) {
  return typeof value === 'string' ? value : JSON.stringify(value ?? '');
}

// ---------------------------------------------------------------------------------------------
// Shell analysis. A shell call contacts the network only through what it executes, so text rules
// apply to commands in command position, not to string literals or script source that merely
// mentions `gh` or a PR URL (rb-qual-2: a python here-string listing "gh api ..." as search text,
// a node here-string passing an issues URL to a mocked vscode).
// ---------------------------------------------------------------------------------------------

/** Tools whose arguments are shell input. Unknown tools keep the plain text rules. */
export const SHELL_TOOL = /^(?:powershell|pwsh|bash|sh|zsh|shell|cmd|terminal|run_in_terminal|run_command|execute_command|run_shell_command|write_powershell|write_bash|write_shell)$/i;

const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh', 'pwsh', 'powershell', 'cmd', 'iex', 'invoke-expression']);
const SHELL_BODY_FLAGS = new Set(['-c', '-command', '/c', '/k', '-commandwithargs']);
const PREFIXES = new Set(['&', '.', 'call', 'sudo', 'env', 'command', 'exec', 'nohup', 'time', 'builtin', 'start-process', 'saps']);
const HTTP_CLIENTS = new Set(['curl', 'wget', 'iwr', 'irm', 'invoke-webrequest', 'invoke-restmethod']);
const GIT_NETWORK = new Set(['fetch', 'pull', 'clone', 'ls-remote', 'push']);
const GIT_VALUE_OPTS = new Set(['-c', '-C', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env']);
const GH_SUBCOMMANDS = new Set(['pr', 'api', 'issue', 'search', 'browse']);
const GITHUB_HOST = /github(?:usercontent)?\.com|review-bench/i;
const MAX_DEPTH = 4;

// Calls in script source that launch a process; the launched command line is analysed as shell.
const LAUNCH = /\b(?:subprocess\s*\.\s*(?:run|call|check_call|check_output|Popen|getoutput|getstatusoutput)|os\s*\.\s*(?:system|popen|exec[lv]p?e?|spawn[lv]p?e?)|child_process\s*\.\s*\w+|spawnSync|spawn|execFileSync|execFile|execSync|execa|exec|Process\s*\.\s*Start|IO\s*\.\s*popen|Open3\s*\.\s*\w+|system|popen|Popen)\s*\(\s*/g;
// Calls in script source that reach the network. A GitHub PR, issue, commit or compare URL, or
// benchmark data, in a script that makes one of these calls is treated as passed to it.
const NET_CALL = /\b(?:urlopen|urlretrieve|Request|requests\s*\.\s*(?:get|post|put|patch|delete|head|request|Session)|httpx\s*\.\s*(?:get|post|put|patch|delete|head|request|stream|Client|AsyncClient)|fetch|https?\s*\.\s*(?:get|request)|axios(?:\s*\.\s*(?:get|post|request))?|HTTPS?Connection|DownloadString|DownloadFile|DownloadData|OpenRead|GetStringAsync|GetAsync|SendAsync|XMLHttpRequest|Net::HTTP|URI\s*\.\s*open)\s*\(/;

function basename(word) {
  return word.replace(/^.*[\\/]/, '').replace(/\.(?:exe|cmd|bat|ps1)$/i, '').toLowerCase();
}

/** Reads a balanced `$( ... )` starting at the `(`; returns [body, index after `)`]. */
function balanced(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')' && --depth === 0) return [s.slice(open + 1, i), i + 1];
  }
  return [s.slice(open + 1), s.length];
}

/**
 * Splits here-string and heredoc bodies out of a shell command. Returns the command with each body
 * removed and the bodies with their consumer (the command reading them) and whether they expand
 * `$(...)`.
 */
function extractBodies(command) {
  const bodies = [];
  let outer = command.replace(/@(['"])[ \t]*\r?\n([\s\S]*?)\r?\n\1@([^\n]*)/g, (_, q, body, rest) => {
    const consumer = /^\s*\|\s*(?:&\s*)?["']?([^\s"'|;)]+)/.exec(rest)?.[1] ?? '';
    bodies.push({ body, consumer: basename(consumer), expands: q === '"' });
    return ` ${rest}`;
  });
  outer = outer.replace(/^([^\n]*?)<<(-?)[ \t]*(['"]?)([A-Za-z_]\w*)\3([^\n]*)\n([\s\S]*?)(?:\n[ \t]*\4[ \t]*(?=\n|$)|$)/gm, (_, before, _dash, q, _tag, rest, body) => {
    // The body feeds the command holding the heredoc, or the end of a pipe that follows it.
    const piped = rest.includes('|') ? rest.split('|').pop() : null;
    const segment = (piped ?? before.split(/[;|&(){}]/).pop()).trim().split(/\s+/).filter((w) => !PREFIXES.has(w.toLowerCase()) && !/^[A-Za-z_]\w*=/.test(w));
    bodies.push({ body, consumer: basename((segment[0] ?? '').replace(/^["']|["']$/g, '')), expands: !q });
    return `${before}${rest}`;
  });
  return { outer, bodies };
}

/**
 * Tokenizes shell text into statement segments of words. Quotes group words; `;`, `|`, `&`, `&&`,
 * `||`, newlines, parentheses and braces end a segment. `$(...)` found anywhere (including inside
 * double quotes) is returned separately for recursive analysis. Comments are dropped.
 */
function tokenize(s) {
  const segments = [];
  const subshells = [];
  let words = [];
  let word = null;
  const endWord = () => {
    if (word !== null) words.push(word);
    word = null;
  };
  const endSegment = () => {
    endWord();
    if (words.length) segments.push(words);
    words = [];
  };
  const add = (text, quoted = false) => {
    if (word === null) word = { text: '', quoted: false };
    word.text += text;
    word.quoted ||= quoted;
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '$' && s[i + 1] === '(') {
      const [body, next] = balanced(s, i + 1);
      subshells.push(body);
      add('$()');
      i = next - 1;
    } else if (c === "'") {
      let j = i + 1;
      let text = '';
      while (j < s.length) {
        if (s[j] === "'" && s[j + 1] === "'") { text += "'"; j += 2; continue; }
        if (s[j] === "'") break;
        text += s[j++];
      }
      add(text, true);
      i = j;
    } else if (c === '"') {
      let j = i + 1;
      let text = '';
      while (j < s.length && s[j] !== '"') {
        // Backslash escapes only what bash lets it escape, so Windows paths keep their separators.
        if ((s[j] === '`' || (s[j] === '\\' && /["$`\\]/.test(s[j + 1] ?? ''))) && j + 1 < s.length) { text += s[j + 1]; j += 2; continue; }
        if (s[j] === '$' && s[j + 1] === '(') {
          const [body, next] = balanced(s, j + 1);
          subshells.push(body);
          j = next;
          continue;
        }
        text += s[j++];
      }
      add(text, true);
      i = j;
    } else if ((c === '`' || c === '\\') && (s[i + 1] === '\n' || s[i + 1] === '\r')) {
      endWord();
      i += s[i + 1] === '\r' && s[i + 2] === '\n' ? 2 : 1;
    } else if (c === '`') {
      add(s[i + 1] ?? '');
      i++;
    } else if (c === '#' && word === null) {
      const end = s.indexOf('\n', i);
      i = end < 0 ? s.length : end - 1;
    } else if (c === '<' && s[i + 1] === '#' && word === null) {
      const end = s.indexOf('#>', i);
      i = end < 0 ? s.length : end + 1;
    } else if (/[;|&\n\r(){}]/.test(c)) {
      endSegment();
    } else if (/\s/.test(c)) {
      endWord();
    } else {
      add(c);
    }
  }
  endSegment();
  return { segments, subshells };
}

/** Classifies one statement by its command word. */
function classifySegment(words, depth, hits) {
  let i = 0;
  while (i < words.length && (PREFIXES.has(words[i].text.toLowerCase()) || (!words[i].quoted && /^[A-Za-z_]\w*=/.test(words[i].text)) || /^-FilePath$/i.test(words[i].text))) i++;
  if (i >= words.length) return;
  const cmd = basename(words[i].text);
  const args = words.slice(i + 1).map((w) => w.text);
  if (cmd === 'gh') {
    const sub = args.filter((a) => !a.startsWith('-'));
    if (sub.some((a) => GH_SUBCOMMANDS.has(a)) || (sub[0] === 'repo' && sub[1] === 'view')) hits.push(hit('gh-cli'));
  } else if (HTTP_CLIENTS.has(cmd)) {
    if (args.some((a) => GITHUB_HOST.test(a))) hits.push(hit('http-client'));
  } else if (cmd === 'git') {
    let j = 0;
    while (j < args.length && args[j].startsWith('-')) j += GIT_VALUE_OPTS.has(args[j]) ? 2 : 1;
    if (GIT_NETWORK.has(args[j])) hits.push(hit('git-remote'));
  } else if (SHELLS.has(cmd)) {
    if (cmd === 'iex' || cmd === 'invoke-expression') {
      for (const a of args) if (!a.startsWith('-')) classifyShell(a, depth + 1, hits);
    } else {
      const k = args.findIndex((a) => SHELL_BODY_FLAGS.has(a.toLowerCase()));
      if (k >= 0 && k + 1 < args.length) classifyShell(args.slice(k + 1).join(' '), depth + 1, hits);
    }
  }
}

/** Parses string literals (and one list of them) that start the argument list of a call. */
function literalArgs(s, start) {
  const parts = [];
  let i = start;
  const literal = () => {
    const m = /^[rRbBuUfF]{0,2}(['"`])/.exec(s.slice(i, i + 3));
    if (!m) return null;
    const q = m[1];
    let j = i + m[0].length;
    let text = '';
    while (j < s.length && s[j] !== q) {
      if (s[j] === '\\' && j + 1 < s.length) { text += s[j + 1]; j += 2; continue; }
      text += s[j++];
    }
    i = j + 1;
    return text;
  };
  const ws = () => { while (/\s/.test(s[i] ?? '')) i++; };
  for (let n = 0; n < 3; n++) {
    ws();
    if (s[i] === '[') {
      i++;
      for (;;) {
        ws();
        const text = literal();
        if (text === null) return parts;
        parts.push(text);
        ws();
        if (s[i] !== ',') break;
        i++;
      }
      ws();
      if (s[i] === ']') i++;
    } else {
      const text = literal();
      if (text === null) return parts;
      parts.push(text);
    }
    ws();
    if (s[i] !== ',') break;
    i++;
  }
  return parts;
}

/** Script source: process launches and network calls only. */
function classifyScript(source, depth, hits) {
  for (const m of source.matchAll(LAUNCH)) {
    const launched = literalArgs(source, m.index + m[0].length);
    if (launched.length) classifyShell(launched.join(' '), depth + 1, hits);
  }
  if (NET_CALL.test(source)) {
    if (BENCH_DATA.test(source)) hits.push(hit('benchmark-data'));
    else if (GITHUB_API.test(source)) hits.push(hit('github-pr-api'));
    else if (GITHUB_WEB.test(source)) hits.push(hit('github-pr-page'));
  }
}

function classifyShell(command, depth, hits) {
  if (depth > MAX_DEPTH || !command) return;
  const { outer, bodies } = extractBodies(command);
  const { segments, subshells } = tokenize(outer);
  for (const words of segments) classifySegment(words, depth, hits);
  for (const sub of subshells) classifyShell(sub, depth + 1, hits);
  for (const { body, consumer, expands } of bodies) {
    if (SHELLS.has(consumer)) classifyShell(body, depth + 1, hits);
    else if (expands) for (const sub of tokenize(body).subshells) classifyShell(sub, depth + 1, hits);
  }
}

function shellText(args) {
  if (typeof args === 'string') return args;
  for (const key of ['command', 'input', 'cmd', 'script', 'commandLine']) if (typeof args?.[key] === 'string') return args[key];
  return stringify(args);
}

const RULE_BY_ID = Object.fromEntries(RULES.map((r) => [r.id, r]));
function hit(id) {
  return { rule: id, why: RULE_BY_ID[id].why };
}

/** Rule hits for one shell command line, one per rule. Exported for checks. */
export function classifyShellCommand(command) {
  const hits = [];
  classifyShell(command, 0, hits);
  // Script rules see the whole input once, so script source anywhere (a here-string, a -c or -e
  // argument, a quoted inline program) is covered whatever consumes it.
  classifyScript(command, 0, hits);
  const seen = new Set();
  return hits.filter((h) => !seen.has(h.rule) && seen.add(h.rule));
}

/** Classifies one tool call. Returns matching rule ids with reasons. */
export function classifyCall(toolName, args) {
  const hits = [];
  if (SHELL_TOOL.test(toolName ?? '')) {
    hits.push(...classifyShellCommand(shellText(args)));
  } else if (!LOCAL_FILE_TOOL.test(toolName ?? '')) {
    const text = stringify(args);
    for (const rule of RULES) if (rule.re.test(text)) hits.push({ rule: rule.id, why: rule.why });
  }
  if (WEB_TOOL.test(toolName ?? '')) hits.push({ rule: 'web-tool', why: `uses the ${toolName} web tool` });
  if (MCP_PR_TOOL.test(toolName ?? '')) hits.push({ rule: 'github-mcp', why: `uses the ${toolName} GitHub tool` });
  return hits;
}

function parseEvents(text) {
  const events = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // A truncated final line from a killed process is expected; the rest still counts.
    }
  }
  return events;
}

/**
 * Scans a trial. Calls that ran (or whose outcome is unknown) invalidate the trial; calls the
 * permission layer refused are recorded as warnings so qualification can see the controls work.
 */
export function scanTrial({ eventsPath, transcriptPath } = {}) {
  const reasons = [];
  const warnings = [];
  if (eventsPath && existsSync(eventsPath)) {
    const events = parseEvents(readFileSync(eventsPath, 'utf8'));
    const outcome = new Map();
    for (const e of events) {
      if (e?.type === 'tool.execution_complete' && e.data?.toolCallId) outcome.set(e.data.toolCallId, e.data.success);
    }
    for (const e of events) {
      if (e?.type !== 'tool.execution_start') continue;
      const { toolCallId, toolName, arguments: args } = e.data ?? {};
      for (const hit of classifyCall(toolName, args)) {
        const entry = `${toolName ?? 'tool'} ${hit.why}: ${stringify(args).slice(0, 200)}`;
        if (outcome.get(toolCallId) === false) warnings.push(`denied: ${entry}`);
        else reasons.push(entry);
      }
    }
    return { invalidated: reasons.length > 0, reasons, warnings, source: 'events' };
  }
  if (transcriptPath && existsSync(transcriptPath)) {
    // Without structured events every matching line counts, because outcomes are unknown.
    for (const line of readFileSync(transcriptPath, 'utf8').split(/\r?\n/)) {
      for (const rule of RULES) if (rule.re.test(line)) reasons.push(`transcript ${rule.why}: ${line.trim().slice(0, 200)}`);
    }
    return { invalidated: reasons.length > 0, reasons, warnings, source: 'transcript' };
  }
  return { invalidated: true, reasons: ['no events or transcript to audit for leakage'], warnings, source: 'none' };
}

/** Returns the trial record marked invalidated when the scan found leakage. */
export function applyLeakage(record, scan) {
  const audited = { ...record, leakage: { reasons: scan.reasons, warnings: scan.warnings, source: scan.source } };
  if (!scan.invalidated) return audited;
  return { ...audited, status: 'invalidated', reason: `leakage: ${scan.reasons[0]}${scan.reasons.length > 1 ? ` (+${scan.reasons.length - 1} more)` : ''}` };
}
