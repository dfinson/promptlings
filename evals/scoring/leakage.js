import { existsSync, readFileSync } from 'node:fs';

/**
 * Transcript audit for benchmark leakage. A trial whose tool calls reach PR pages, PR or issue
 * comments, commits on the upstream host, or the benchmark's own golden data is invalidated.
 * Tool-call arguments are scanned (not tool output or model prose), so reading a URL in the diff
 * does not count; issuing a request for it does. Text rules apply to tools that can run commands
 * or reach the network; local file tools are exempt because writing text contacts nothing.
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

/** Classifies one tool call. Returns matching rule ids with reasons. */
export function classifyCall(toolName, args) {
  const hits = [];
  if (!LOCAL_FILE_TOOL.test(toolName ?? '')) {
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
