// In-process stand-in for runCopilotOnce used by the panel checks. Each call is recorded; the
// answer labels every item in the prompt with the first label of each dimension the prompt lists.
export const calls = [];

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
  calls.push({ home, cwd, args, model: valueOf(args, '--model'), prompt, env: { COPILOT_HOME: env.COPILOT_HOME, HOME: env.HOME, USERPROFILE: env.USERPROFILE } });
  const events = [
    { type: 'user.message', data: { content: prompt } },
    { type: 'assistant.message', data: { content: JSON.stringify(answerFor(prompt)), toolRequests: [] } },
    { type: 'result', exitCode: 0 },
  ];
  return { exitCode: 0, stdout: `${events.map((e) => JSON.stringify(e)).join('\n')}\n`, stderr: '', home };
}
