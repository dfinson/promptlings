// In-process stand-in for runCopilotOnce used by the panel checks. Each call is recorded; the
// answer labels every item in the prompt with the first label of each dimension the prompt lists.
// Models in unparsableFirst answer in prose unless the prompt carries the JSON-only reminder;
// models in unparsableAlways always answer in prose. Models in toolIntentFirst announce tool use
// unless the prompt forbids announcing it; models in toolIntentAlways always announce it.
export const calls = [];
export const unparsableFirst = new Set();
export const unparsableAlways = new Set();
export const toolIntentFirst = new Set();
export const toolIntentAlways = new Set();
export const TOOL_INTENT = "I'll inspect the workflow file around the cited lines to judge whether these findings describe a real problem.";
const REMINDER = '\nReminder:';
const NO_TOOL_ANNOUNCEMENT = 'Do not announce, plan or attempt tool use';

function valueOf(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function answerFor(prompt) {
  const dims = [...prompt.matchAll(/^- (\w+): one of ([^.]+)\./gm)].map((m) => [m[1], m[2].split(', ')[0]]);
  const ids = [...prompt.matchAll(/^\{"id":"(item-\d{4})"/gm)].map((m) => m[1]);
  return { annotations: ids.map((id) => ({ id, ...Object.fromEntries(dims) })) };
}

export async function runCopilotOnce({ home, cwd, args, env }) {
  if (args.includes('--version')) return { exitCode: 0, stdout: 'GitHub Copilot CLI 9.9.9-fake\n', stderr: '', home };
  const prompt = valueOf(args, '-p') ?? '';
  const model = valueOf(args, '--model');
  calls.push({ home, cwd, args, model, prompt, env: { COPILOT_HOME: env.COPILOT_HOME, HOME: env.HOME, USERPROFILE: env.USERPROFILE } });
  const prose = unparsableAlways.has(model) || (unparsableFirst.has(model) && !prompt.includes(REMINDER));
  const toolIntent = toolIntentAlways.has(model) || (toolIntentFirst.has(model) && !prompt.includes(NO_TOOL_ANNOUNCEMENT));
  const content = toolIntent ? TOOL_INTENT
    : prose ? 'These findings look like logic problems in a single hunk.' : JSON.stringify(answerFor(prompt));
  const events = [
    { type: 'user.message', data: { content: prompt } },
    { type: 'assistant.message', data: { content, toolRequests: [] } },
    { type: 'result', exitCode: 0 },
  ];
  return { exitCode: 0, stdout: `${events.map((e) => JSON.stringify(e)).join('\n')}\n`, stderr: '', home };
}
