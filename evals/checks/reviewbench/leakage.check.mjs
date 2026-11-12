import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyLeakage, classifyCall, scanTrial } from '../../scoring/leakage.js';
import { collect, loadSuite, perspectiveModes, PR_DIR } from '../../suites/reviewbench/adapter.js';

const TASK = { repo: 'acme/widgets', prNumber: 1, base: 'a'.repeat(40), head: 'b'.repeat(40) };

function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), 'rb-leakage-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function writeEvents(dir, calls) {
  const lines = [];
  calls.forEach(({ toolName, args, success = true }, i) => {
    const toolCallId = `call-${i}`;
    lines.push({ type: 'tool.execution_start', data: { toolCallId, toolName, arguments: args } });
    lines.push({ type: 'tool.execution_complete', data: { toolCallId, success } });
  });
  const path = join(dir, 'events.jsonl');
  writeFileSync(path, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);
  return path;
}

function trial(t, calls, { findings } = {}) {
  const trialDir = join(scratch(t), 'trials', 'acme_widgets_1-bbbbbbbb', 'stock', '1');
  mkdirSync(join(trialDir, 'workspace', PR_DIR), { recursive: true });
  const eventsPath = writeEvents(trialDir, calls);
  if (findings) writeFileSync(join(trialDir, 'workspace', PR_DIR, 'findings.json'), JSON.stringify(findings));
  return { trialDir, record: { status: 'completed', arm: 'stock', trialDir, eventsPath, wallMs: 1200 } };
}

const BENIGN = [
  { toolName: 'powershell', args: { command: 'git --no-pager diff review-base...pr-head -- src/app.js' } },
  { toolName: 'view', args: { path: 'C:\\w\\src\\app.js' } },
  { toolName: 'grep', args: { pattern: 'handleRequest', paths: 'src' } },
];

test('leakage: fetching the PR page with a web tool invalidates the trial', (t) => {
  const dir = scratch(t);
  const scan = scanTrial({ eventsPath: writeEvents(dir, [...BENIGN, { toolName: 'web_fetch', args: { url: 'https://github.com/acme/widgets/pull/1' } }]) });
  assert.equal(scan.invalidated, true);
  assert.equal(scan.source, 'events');
  assert.ok(scan.reasons.some((r) => r.includes('PR, issue, commit or compare page')));
  assert.ok(scan.reasons.some((r) => r.includes('web_fetch web tool')));
});

test('leakage: reading PR comments through gh or the API invalidates the trial', (t) => {
  for (const command of ['gh api repos/acme/widgets/pulls/1/comments', 'gh pr view 1 --comments', 'curl -s https://api.github.com/repos/acme/widgets/pulls/1/comments', 'Invoke-RestMethod https://api.github.com/repos/acme/widgets/issues/1/comments']) {
    const scan = scanTrial({ eventsPath: writeEvents(scratch(t), [{ toolName: 'powershell', args: { command } }]) });
    assert.equal(scan.invalidated, true, command);
  }
});

test('leakage: fetching ReviewBench golden data or contacting a Git remote invalidates the trial', () => {
  assert.ok(classifyCall('web_fetch', { url: 'https://raw.githubusercontent.com/review-bench/ReviewBench/main/golden/x.json' }).some((h) => h.rule === 'benchmark-data'));
  assert.ok(classifyCall('powershell', { command: 'git fetch https://github.com/acme/widgets refs/pull/1/head' }).some((h) => h.rule === 'git-remote'));
  assert.ok(classifyCall('github-mcp-server-pull_request_read', { owner: 'acme', repo: 'widgets', pullNumber: 1 }).some((h) => h.rule === 'github-mcp'));
});

test('leakage: local review work does not invalidate the trial', (t) => {
  const scan = scanTrial({ eventsPath: writeEvents(scratch(t), BENIGN) });
  assert.equal(scan.invalidated, false);
  assert.deepEqual(scan.reasons, []);
  for (const { toolName, args } of BENIGN) assert.deepEqual(classifyCall(toolName, args), [], toolName);
});

test('leakage: a call the permission layer denied is a warning, not an invalidation', (t) => {
  const scan = scanTrial({ eventsPath: writeEvents(scratch(t), [...BENIGN, { toolName: 'web_fetch', args: { url: 'https://github.com/acme/widgets/pull/1' }, success: false }]) });
  assert.equal(scan.invalidated, false);
  assert.equal(scan.warnings.length, 2);
  assert.ok(scan.warnings.every((w) => w.startsWith('denied: ')));
});

test('leakage: writing findings that mention gh pr or a PR URL with a file tool does not invalidate; running gh pr in a shell still does', (t) => {
  const patch = [
    '*** Begin Patch',
    '*** Add File: .reviewbench/findings.json',
    '+{"findings": [{"file": "main.go", "start_line": 9, "message": "the extension shells out to `gh pr view` without --repo"}]}',
    '*** Add File: .reviewbench/review-evidence.txt',
    '+PR: 32',
    '+Source: https://github.com/o/r/pull/1',
    '*** End Patch',
  ].join('\n');
  const written = [
    { toolName: 'apply_patch', args: patch },
    { toolName: 'create', args: { path: '.reviewbench/notes.md', file_text: 'see gh pr view 1 and https://github.com/o/r/pull/1' } },
    { toolName: 'edit', args: { path: 'notes.md', old_str: 'x', new_str: 'gh api repos/o/r/pulls/1/comments' } },
  ];
  const scan = scanTrial({ eventsPath: writeEvents(scratch(t), [...BENIGN, ...written]) });
  assert.equal(scan.invalidated, false, scan.reasons.join('\n'));
  for (const { toolName, args } of written) assert.deepEqual(classifyCall(toolName, args), [], toolName);

  const shell = scanTrial({ eventsPath: writeEvents(scratch(t), [...BENIGN, ...written, { toolName: 'powershell', args: { command: 'gh pr view 1' } }]) });
  assert.equal(shell.invalidated, true);
  assert.equal(shell.reasons.length, 1);
  assert.match(shell.reasons[0], /^powershell runs gh/);
  assert.ok(classifyCall('bash', { command: 'gh pr view 1' }).some((h) => h.rule === 'gh-cli'));
  assert.ok(classifyCall('some_new_tool', { input: 'gh pr view 1' }).some((h) => h.rule === 'gh-cli'), 'unknown tools are still scanned');
});

// rb-qual-2 false positives, verbatim from the events files: literal data inside inline scripts.
const QUAL2_K1LOW_ENSEMBLE = "@'\nimport hashlib, json, subprocess, sys\nfrom pathlib import Path\nsys.stdout.reconfigure(encoding='utf-8')\ndef git(*args):\n return subprocess.run(['git', *args], capture_output=True, check=True, timeout=30).stdout\nbase = '5f3765a9ef25d9c5a57699418bed105d9ac54691'\nhead = 'f98281938e63acd1d2df9b89d6af98dcf58c9fa8'\nfor ref, expected in [('HEAD',head), ('pr-head',head), ('review-base',base)]:\n actual = git('rev-parse',ref).decode().strip()\n print(f'{ref}: {actual}; unchanged={actual == expected}')\n assert actual == expected\nassert git('merge-base',base,head).decode().strip() == base\nfor name in ['cmd/root.go', 'internal/github/github.go', '.github/workflows/ci.yml', 'Makefile']:\n local = Path(name).read_bytes().replace(b'\\r\\n',b'\\n')\n committed = git('show',f'{head}:{name}').replace(b'\\r\\n',b'\\n')\n print(f'{name}: workspace matches reviewed head={local == committed}; sha256={hashlib.sha256(local).hexdigest()}')\n assert local == committed\npatch = git('--no-pager','diff','--no-ext-diff',base,head).replace(b'\\r\\n',b'\\n')\nsupplied = Path('.reviewbench/diff.patch').read_bytes().replace(b'\\r\\n',b'\\n')\nprint(f'Supplied patch matches committed patch={patch == supplied}; sha256={hashlib.sha256(patch).hexdigest()}')\nassert patch == supplied\npr = json.loads(Path('.reviewbench/pr.json').read_text(encoding='utf-8'))\nassert pr['base'] == base and pr['head'] == head and pr['pr_number'] == 9\nassert pr['title'] == 'feat: skip Copilot review request when existing review is newer than last commit'\nfor text in ['CheckCopilotReviewStatus()', \"review's `commit_id`\", 'current PR head SHA', \"gh api --paginate --jq '.[]'\", 'json.Decoder']:\n assert text in pr['body'], text\nprint('Local PR identity and cited requirements unchanged')\nprint('Working tree status:',git('--no-optional-locks','status','--short').decode().strip() or 'clean')\nprint('Original new-side hunk ranges: cmd/root.go modified 70-84; internal/github/github.go modified 3-9 and 72-121')\n'@ | python -";
const QUAL2_FIGLET_ENSEMBLE = "$env:NODE_NO_WARNINGS='1'; @'\nconst fs=require('fs'); const vm=require('vm'); const assert=require('assert/strict'); const {stripTypeScriptTypes}=require('node:module');\nconst messages=[], external=[], events=[];\nconst vscode={workspace:{getConfiguration(){return {get(key){return {fontDirectory:'',layoutMode:'smush'}[key];}};}},window:{activeTextEditor:null},Uri:{parse(url){const u=new URL(url);return {scheme:u.protocol.slice(0,-1),authority:u.host};}},env:{async openExternal(uri){external.push(uri);}}};\nconst font={};const deps={vscode,path:require('path'),fs:{async readFile(){return 'font content';}},FIGLetFontManager:{availableFonts:[],async setFontDirectory(){}},FIGFont:{async getDefault(){return font;}},FIGLetRenderer:class {render(t){events.push('render');return t;}},LayoutMode:{FullSize:-1,Kerning:0,Smushing:1},BannerUtils:{async insertBanner(){events.push('insert');}},console};\nlet code=fs.readFileSync('FIGLet.VSCodeExtension/src/FigletPanel.ts','utf8').replace(/^import .*;\\r?\\n/gm,'').replace(/export /g,'');\nconst FigletPanel=vm.runInNewContext(stripTypeScriptTypes(code,{mode:'transform'})+';FigletPanel',deps);\nconst panel=Object.create(FigletPanel.prototype);\npanel._context={extensionPath:'.',globalState:{get(key){assert.equal(key,'lastFontUsed');return 'custom-font';},async update(key,value){assert.equal(key,'lastFontUsed');assert.equal(value,'custom-font');await Promise.resolve();events.push('state-updated');}}};\npanel._editor={document:{languageId:'python'}};panel._panel={webview:{async postMessage(msg){messages.push(msg);}}};\n(async()=>{\n await panel._sendInitData();assert.equal(messages[0].defaultFont,'custom-font');console.log('INIT',JSON.stringify(messages[0]));\n for (const url of ['https://github.com/PaulStSmith/figlet-comment-generator/issues','http://github.com/issues','https://example.com/']) await panel._handleMessage({type:'openExternal',url});\n assert.equal(external.length,1);console.log('EXTERNAL',JSON.stringify(external));\n await panel._insertBanner({type:'ok',text:'Hi',font:'custom-font',layoutMode:'smush',language:'python'});\n assert.equal(events.join(','),'state-updated,render,insert');console.log('INSERT ORDER',events.join(' -> '));\n})().catch(e=>{console.error(e);process.exitCode=1;});\n'@ | node -";

test('leakage: gh text and PR URLs that are only string literals in inline scripts do not invalidate', (t) => {
  for (const [name, command] of [['k1LoW_gh-copilot-review_9 ensemble', QUAL2_K1LOW_ENSEMBLE], ['PaulStSmith_figlet-comment-generator_32 ensemble', QUAL2_FIGLET_ENSEMBLE]]) {
    assert.deepEqual(classifyCall('powershell', { command }), [], name);
    const scan = scanTrial({ eventsPath: writeEvents(scratch(t), [...BENIGN, { toolName: 'powershell', args: { command } }]) });
    assert.equal(scan.invalidated, false, name);
  }
  for (const command of ['echo "gh pr view 1"', 'rg -n "gh pr view" src', 'Select-String -Pattern "https://github.com/o/r/pull/1" notes.md', '# gh pr view 1', "python - <<'EOF'\nprint('gh pr view 1')\nEOF"]) {
    assert.deepEqual(classifyCall('powershell', { command }), [], command);
  }
});

test('leakage: gh, HTTP clients and network calls that execute in a shell invalidate with exactly one reason', (t) => {
  const cases = {
    'gh pr view 1': 'gh-cli',
    '& gh api repos/o/r/pulls/1': 'gh-cli',
    'curl https://github.com/o/r/pull/1': 'http-client',
    'python -c "import subprocess; subprocess.run([\'gh\',\'pr\',\'view\',\'1\'])"': 'gh-cli',
    'python -c "import urllib.request; urllib.request.urlopen(\'https://github.com/o/r/pull/1\')"': 'github-pr-page',
    'node -e "fetch(\'https://api.github.com/repos/o/r/pulls/1\')"': 'github-pr-api',
    // Command position after separators, prefixes and quoting, and shells fed a body.
    'git status && gh pr diff 3': 'gh-cli',
    "$env:GH_TOKEN='x'; gh pr view 1": 'gh-cli',
    '& "C:\\Program Files\\GitHub CLI\\gh.exe" pr view 1': 'gh-cli',
    'bash -c "gh pr view 1"': 'gh-cli',
    'echo "x $(gh pr view 1)"': 'gh-cli',
    "@'\ngh pr view 1\n'@ | pwsh -": 'gh-cli',
    "cat <<'EOF' | bash\ngh pr view 1\nEOF": 'gh-cli',
    'node -e "require(\'child_process\').spawn(\'gh\', [\'pr\',\'view\',\'1\'])"': 'gh-cli',
    'git -C repo --no-pager fetch origin': 'git-remote',
  };
  for (const [command, rule] of Object.entries(cases)) {
    assert.deepEqual(classifyCall('powershell', { command }).map((h) => h.rule), [rule], command);
    const scan = scanTrial({ eventsPath: writeEvents(scratch(t), [{ toolName: 'powershell', args: { command } }]) });
    assert.equal(scan.invalidated, true, command);
    assert.equal(scan.reasons.length, 1, command);
  }
});

test('leakage: generated CLI args for every ReviewBench arm allow shell together with every deny-tool and deny-url entry', async (t) => {
  const runnerPath = fileURLToPath(new URL('../../runner/index.js', import.meta.url));
  if (!existsSync(runnerPath)) {
    t.skip('core runner (evals/runner/index.js) is not in this tree');
    return;
  }
  const { buildArgs } = await import(pathToFileURL(runnerPath).href);
  const suite = loadSuite();
  for (const suiteArm of suite.arms) {
    assert.deepEqual(suiteArm.tools.allow, ['write', 'shell'], suiteArm.id);
    // The runner sets plugin.path after fetching the pinned checkout; buildArgs refuses a plugin arm without it.
    const pluginPath = suiteArm.plugin ? scratch(t) : null;
    const arm = suiteArm.plugin ? { ...suiteArm, plugin: { ...suiteArm.plugin, path: pluginPath } } : suiteArm;
    const { args } = buildArgs({ prompt: 'p', arm, limits: arm.limits, trialDir: scratch(t) });
    const pluginDirs = args.flatMap((a, i) => (a === '--plugin-dir' ? [args[i + 1]] : a.startsWith('--plugin-dir=') ? [a.slice('--plugin-dir='.length)] : []));
    if (arm.id === 'hve-code-review') assert.deepEqual(pluginDirs, [pluginPath], `${arm.id} passes its prepared checkout once`);
    else assert.deepEqual(pluginDirs, [], `${arm.id} passes no --plugin-dir`);
    assert.ok(args.includes('--allow-tool=shell'), `${arm.id} allows shell`);
    assert.ok(!args.some((a) => a.startsWith('--allow-tool=shell(')), `${arm.id} has no narrowed shell allow`);
    assert.ok(args.includes('--sandbox'), `${arm.id} runs sandboxed`);
    for (const d of ['web_fetch', 'web_search', 'github-mcp-server', 'shell(gh:*)', 'shell(curl:*)', 'shell(git fetch:*)']) assert.ok(arm.tools.deny.includes(d), `${arm.id} keeps deny ${d}`);
    for (const d of arm.tools.deny) assert.ok(args.includes(`--deny-tool=${d}`), `${arm.id} passes --deny-tool=${d}`);
    for (const u of arm.tools.denyUrl) assert.ok(args.includes(`--deny-url=${u}`), `${arm.id} passes --deny-url=${u}`);
    assert.equal(args.filter((a) => a.startsWith('--deny-tool=')).length, arm.tools.deny.length);
    assert.equal(args.filter((a) => a.startsWith('--deny-url=')).length, arm.tools.denyUrl.length);
  }
});

test('leakage: a call with no recorded outcome counts as executed', (t) => {
  const dir = scratch(t);
  const path = join(dir, 'events.jsonl');
  writeFileSync(path, `${JSON.stringify({ type: 'tool.execution_start', data: { toolCallId: 'x', toolName: 'powershell', arguments: { command: 'gh pr diff 1' } } })}\n{"type":"tool.execution_comp`);
  assert.equal(scanTrial({ eventsPath: path }).invalidated, true);
});

test('leakage: a transcript-only trial that names a PR URL in a request is invalidated', (t) => {
  const dir = scratch(t);
  const transcriptPath = join(dir, 'transcript.md');
  writeFileSync(transcriptPath, 'Reviewing the diff.\n> curl https://api.github.com/repos/acme/widgets/pulls/1/reviews\n');
  const scan = scanTrial({ transcriptPath });
  assert.equal(scan.invalidated, true);
  assert.equal(scan.source, 'transcript');
});

test('leakage: a trial with nothing to audit is invalidated', () => {
  const scan = scanTrial({ eventsPath: join(tmpdir(), 'rb-no-such-events.jsonl') });
  assert.equal(scan.invalidated, true);
  assert.equal(scan.source, 'none');
});

test('leakage: applyLeakage marks the record invalidated with the first reason', () => {
  const scan = { invalidated: true, reasons: ['r1', 'r2'], warnings: [], source: 'events' };
  const out = applyLeakage({ status: 'completed' }, scan);
  assert.equal(out.status, 'invalidated');
  assert.equal(out.reason, 'leakage: r1 (+1 more)');
  assert.equal(applyLeakage({ status: 'completed' }, { ...scan, invalidated: false, reasons: [] }).status, 'completed');
});

test('leakage: collect invalidates a leaking trial and does not produce a candidate', (t) => {
  const findings = { findings: [{ file: 'src/app.js', start_line: 3, message: 'null check missing' }] };
  const { trialDir, record } = trial(t, [...BENIGN, { toolName: 'powershell', args: { command: 'gh api repos/acme/widgets/pulls/1/comments' } }], { findings });
  const out = collect(record, TASK);
  assert.equal(out.status, 'invalidated');
  assert.equal(out.invalidated, true);
  assert.match(out.reason, /^leakage: /);
  assert.equal(existsSync(join(trialDir, 'candidate.json')), false);
});

test('leakage: collect on an audited trial writes the judge candidate', (t) => {
  const findings = { findings: [{ file: './src/app.js', start_line: 3, message: 'null check missing' }] };
  const { trialDir, record } = trial(t, BENIGN, { findings });
  const out = collect(record, TASK);
  assert.equal(out.status, 'completed');
  assert.equal(out.invalidated, false);
  const candidate = JSON.parse(readFileSync(join(trialDir, 'candidate.json'), 'utf8'));
  assert.deepEqual(candidate.pr, { repo: TASK.repo, pr_number: 1, base: TASK.base, head: TASK.head });
  assert.deepEqual(candidate.findings, [{ producer: 'stock', file: 'src/app.js', start_line: 3, end_line: 3, message: 'null check missing' }]);
});

const HVE = 'hve-code-review';
const HVE_COMMIT = '299c0b68741d9bc08106b132043724c23166e2a4';

function hveTrial(t, events, { findings, extraFiles = {}, flags = ['--agent', 'hve-core:code-review'], plugin = { repo: 'microsoft/hve-core', commit: HVE_COMMIT, name: 'hve-core', version: '3.2.2' } } = {}) {
  const trialDir = join(scratch(t), 'trials', 'acme_widgets_1-bbbbbbbb', HVE, '0');
  const workspace = join(trialDir, 'workspace');
  mkdirSync(join(workspace, PR_DIR), { recursive: true });
  const eventsPath = join(trialDir, 'events.jsonl');
  writeFileSync(eventsPath, `${events.map((e) => JSON.stringify(e)).join('\n')}\n`);
  if (findings) writeFileSync(join(workspace, PR_DIR, 'findings.json'), JSON.stringify(findings));
  for (const [rel, body] of Object.entries(extraFiles)) {
    mkdirSync(join(workspace, rel, '..'), { recursive: true });
    writeFileSync(join(workspace, rel), body);
  }
  return { trialDir, workspace, record: { status: 'completed', arm: HVE, trialDir, eventsPath, wallMs: 900, flags, plugin } };
}

function call(id, toolName, args, success = true) {
  return [
    { type: 'tool.execution_start', data: { toolCallId: id, toolName, arguments: args } },
    { type: 'tool.execution_complete', data: { toolCallId: id, success, ...(success ? {} : { error: { code: 'denied', message: 'Permission denied' } }) } },
  ];
}

const HVE_GOOD = [
  ...call('s1', 'skill', { skill: 'code-review' }),
  ...call('v1', 'view', { path: 'C:\\p\\.github\\skills\\coding-standards\\code-review\\references\\perspectives.md' }),
  ...call('g1', 'powershell', { command: 'git --no-pager diff review-base...HEAD' }),
  { type: 'subagent.started', data: { agentName: 'Code Review Functional', agentType: 'Code Review Functional' } },
  { type: 'subagent.started', data: { agentName: 'Code Review Security', agentType: 'Code Review Security' } },
  ...call('w1', 'create', { path: '.reviewbench/findings.json', file_text: '{}' }),
];
const HVE_FINDINGS = { findings: [{ file: 'src/app.js', start_line: 3, message: 'null check missing' }] };

test('leakage: hve-core tracking files are never read as findings', (t) => {
  const extraFiles = {
    '.copilot-tracking/pr/pr-reference.xml': '<pr><file path="src/app.js"/></pr>',
    '.copilot-tracking/reviews/code-reviews/pr-head/functional-findings.json': JSON.stringify(HVE_FINDINGS),
  };
  const missing = hveTrial(t, HVE_GOOD, { extraFiles });
  const out = collect(missing.record, TASK);
  assert.equal(out.status, 'errored');
  assert.match(out.reason, /no findings file/);
  assert.equal(out.qualification.checks['findings-file'].pass, false);

  const present = hveTrial(t, HVE_GOOD, { extraFiles, findings: HVE_FINDINGS });
  const ok = collect(present.record, TASK);
  assert.equal(ok.status, 'completed', ok.reason);
  assert.equal(ok.findingsSource, join(present.workspace, PR_DIR, 'findings.json'));
});

test('leakage: hve qualification passes a workflow-mode trial and records the preamble', (t) => {
  const { record } = hveTrial(t, HVE_GOOD, { findings: HVE_FINDINGS });
  const out = collect(record, TASK);
  assert.equal(out.status, 'completed', out.reason);
  assert.equal(out.qualification.passed, true, JSON.stringify(out.qualification.checks));
  assert.deepEqual(Object.keys(out.qualification.checks), ['agent-ran', 'workflow-mode', 'skill-read', 'findings-file', 'perspectives']);
  assert.equal(out.qualification.checks.perspectives.mode, 'dispatched');
  assert.equal(out.qualification.checks.perspectives.observation, true);
  assert.match(out.promptPreamble.text, /workflow\s+autonomy mode/);
  assert.ok(out.promptPreamble.text.includes(TASK.base));
  assert.match(out.promptPreamble.sha256, /^[0-9a-f]{64}$/);
  const stock = collect(trial(t, BENIGN, { findings: HVE_FINDINGS }).record, TASK);
  assert.equal(stock.promptPreamble, undefined);
  assert.equal(stock.qualification, undefined);
});

test('leakage: hve qualification detects inlined perspectives', (t) => {
  const events = [
    ...HVE_GOOD.filter((e) => e.type !== 'subagent.started'),
    ...call('w2', 'create', { path: '.copilot-tracking/reviews/code-reviews/pr-head/functional-findings.json', file_text: '[]' }),
  ];
  const out = collect(hveTrial(t, events, { findings: HVE_FINDINGS }).record, TASK);
  assert.equal(out.qualification.checks.perspectives.mode, 'inlined');
  assert.equal(out.qualification.passed, true);
});

// Amendment 5: perspective handling is a disclosed observation, not a gate.
const HVE_NO_PERSPECTIVES = HVE_GOOD.filter((e) => e.type !== 'subagent.started');

test('leakage: hve qualification passes with perspective mode none and records the mode as an observation', (t) => {
  const out = collect(hveTrial(t, HVE_NO_PERSPECTIVES, { findings: HVE_FINDINGS }).record, TASK);
  assert.equal(out.status, 'completed', out.reason);
  assert.equal(out.qualification.passed, true, JSON.stringify(out.qualification.checks));
  const { perspectives } = out.qualification.checks;
  assert.equal(perspectives.observation, true);
  assert.equal(perspectives.mode, 'none');
  assert.equal('pass' in perspectives, false);
  for (const id of ['agent-ran', 'workflow-mode', 'skill-read', 'findings-file']) assert.equal(out.qualification.checks[id].pass, true, id);
});

test('leakage: hve qualification with perspective mode none still fails when any gating check fails', (t) => {
  const cases = {
    'agent-ran': [HVE_NO_PERSPECTIVES, { flags: ['--agent', 'Code Review'] }],
    'workflow-mode': [[...HVE_NO_PERSPECTIVES, ...call('a1', 'ask_user', { question: 'Which profile?' })], {}],
    'skill-read': [[...HVE_NO_PERSPECTIVES, ...call('v2', 'view', { path: 'C:\\p\\.github\\skills\\coding-standards\\code-review\\SKILL.md' }, false)], {}],
    'findings-file': [HVE_NO_PERSPECTIVES, { findings: undefined }],
  };
  for (const [check, [events, opts]] of Object.entries(cases)) {
    const out = collect(hveTrial(t, events, { findings: HVE_FINDINGS, ...opts }).record, TASK);
    assert.equal(out.qualification.passed, false, check);
    assert.equal(out.qualification.checks[check].pass, false, check);
    assert.equal(out.qualification.checks.perspectives.mode, 'none', check);
  }
});

test('leakage: perspectiveModes counts each observing arm\'s perspective modes over trials that were not invalidated', (t) => {
  const runDir = scratch(t);
  const write = (task, arm, repeat, collected) => {
    const dir = join(runDir, 'trials', task, arm, String(repeat));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'collected.json'), JSON.stringify(collected));
  };
  const q = (mode) => ({ passed: true, checks: { perspectives: { observation: true, mode, evidence: 'x' } } });
  write('a_1-aaaaaaaa', HVE, 0, { status: 'completed', invalidated: false, qualification: q('none') });
  write('b_2-bbbbbbbb', HVE, 0, { status: 'completed', invalidated: false, qualification: q('none') });
  write('c_3-cccccccc', HVE, 0, { status: 'errored', invalidated: false, qualification: q('dispatched') });
  write('d_4-dddddddd', HVE, 0, { status: 'invalidated', invalidated: true, qualification: q('inlined') });
  write('a_1-aaaaaaaa', 'stock', 0, { status: 'completed', invalidated: false });
  const suite = loadSuite();
  assert.deepEqual(perspectiveModes(runDir, suite), {
    [HVE]: { dispatched: 1, inlined: 0, none: 2, trials: 3, invalidatedExcluded: 1 },
  });
  assert.deepEqual(perspectiveModes(join(runDir, 'absent'), suite), {});
});

test('leakage: hve qualification fails on ask_user, a refused skill read or a wrong plugin', (t) => {
  const cases = {
    'workflow-mode': [...HVE_GOOD, ...call('a1', 'ask_user', { question: 'Which profile?' })],
    'skill-read': [...HVE_GOOD, ...call('v2', 'view', { path: 'C:\\p\\.github\\skills\\coding-standards\\code-review\\SKILL.md' }, false)],
  };
  for (const [check, events] of Object.entries(cases)) {
    const out = collect(hveTrial(t, events, { findings: HVE_FINDINGS }).record, TASK);
    assert.equal(out.qualification.passed, false, check);
    assert.equal(out.qualification.checks[check].pass, false, check);
  }
  const paused = [...HVE_GOOD, { type: 'assistant.message', data: { content: 'Confirm before dispatch: standard profile?' } }];
  assert.equal(collect(hveTrial(t, paused, { findings: HVE_FINDINGS }).record, TASK).qualification.checks['workflow-mode'].pass, false);
  const wrongPlugin = hveTrial(t, HVE_GOOD, { findings: HVE_FINDINGS, plugin: { repo: 'microsoft/hve-core', commit: 'c'.repeat(40), version: '3.2.2' } });
  assert.equal(collect(wrongPlugin.record, TASK).qualification.checks['agent-ran'].pass, false);
  const noAgent = hveTrial(t, HVE_GOOD, { findings: HVE_FINDINGS, flags: [] });
  assert.equal(collect(noAgent.record, TASK).qualification.checks['agent-ran'].pass, false);
  // rb-qual-2: the display name is not an agent id under --plugin-dir; the CLI exits "No such agent".
  const displayName = hveTrial(t, HVE_GOOD, { findings: HVE_FINDINGS, flags: ['--agent', 'Code Review'] });
  assert.equal(collect(displayName.record, TASK).qualification.checks['agent-ran'].pass, false);
  const namespacedSubagents = [
    ...HVE_GOOD.filter((e) => e.type !== 'subagent.started'),
    { type: 'subagent.started', data: { agentName: 'hve-core:code-review-functional', agentType: 'hve-core:code-review-functional' } },
  ];
  const ns = collect(hveTrial(t, namespacedSubagents, { findings: HVE_FINDINGS }).record, TASK).qualification.checks;
  assert.equal(ns.perspectives.mode, 'dispatched');
  assert.equal(ns['agent-ran'].pass, true);
});