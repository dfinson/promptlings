import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { superviseRender } from "../skills/technical-demo-production/scripts/render-supervisor.mjs";
import { loadRuntime, renderJobs } from "../skills/technical-demo-production/scripts/render-jobs.mjs";

const execute = promisify(execFile);
const runtimeRoot = process.env.PROMPTLINGS_TEST_RUNTIME;

async function active(pid) {
  try { process.kill(pid, 0); }
  catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }

  if (process.platform === "win32") return true;
  const { stdout } = await execute("ps", ["-axo", "pid=,stat="]);
  return stdout.trim().split("\n").some((line) => {
    const [id, state] = line.trim().split(/\s+/);
    return Number(id) === pid && !state.startsWith("Z");
  });
}

for (const mode of ["stalled", "crashed"]) {
  test(`native browser and encoder stop when their worker is ${mode}`, { skip: !runtimeRoot }, async (t) => {
    const root = await mkdtemp(path.join(runtimeRoot, "containment-test-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const file = path.join(root, "jobs.json");
    const script = path.join(root, "native-worker.mjs");
    const state = path.join(root, "native-processes.json");
    await writeFile(file, "{}");
    await writeFile(script, `
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {loadRuntime} from ${JSON.stringify(new URL("../skills/technical-demo-production/scripts/render-jobs.mjs", import.meta.url).href)};
const root = ${JSON.stringify(runtimeRoot)};
const runtime = await loadRuntime(root, root);
const {browserExecutable} = JSON.parse(await readFile(path.join(root, 'browser.json'), 'utf8'));
const browser = await runtime.openBrowser('chrome', {browserExecutable});
await browser.connection.send('Target.createTarget', {url:'about:blank'});
const {value:{processInfo}} = await browser.connection.send('SystemInfo.getProcessInfo');
const encoder = runtime.RenderInternals.callFf({
  bin:'ffmpeg', indent:false, logLevel:'error', binariesDirectory:null,
  args:['-hide_banner','-loglevel','error','-f','image2pipe','-i','pipe:0','-f','null','-'],
  options:{stdin:'pipe',stdout:'pipe',stderr:'pipe',cleanup:false}
});
encoder.catch(() => {});
if (!encoder.pid) throw new Error('Encoder did not start');
await writeFile(${JSON.stringify(state)}, JSON.stringify({
  processes:processInfo.map(({id,type})=>({pid:id,type})).concat({pid:encoder.pid,type:'ffmpeg'})
}));
if (${JSON.stringify(mode)} === 'crashed') process.kill(process.pid, 'SIGKILL');
else process.send({type:'stalled',result:{status:'failed',error:'Native containment test stall',jobs:[],bundles:[]}});
`);
    const result = await superviseRender(script, file);
    assert.equal(result.status, "failed");
    assert.equal(result.shutdownErrors, undefined);
    const { processes } = JSON.parse(await readFile(state, "utf8"));
    assert.ok(processes.some(({ type }) => type === "browser"));
    assert.ok(processes.some(({ type }) => type === "ffmpeg"));
    for (const { pid, type } of processes) assert.equal(await active(pid), false, `${type} ${pid} still active`);
  });
}

test("managed native runtime renders and decodes a complete composition", { skip: !runtimeRoot }, async (t) => {
  const root = await mkdtemp(path.join(runtimeRoot, "render-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "jobs.json");
  const output = path.join(root, "film.mp4");
  await writeFile(path.join(root, "index.tsx"), `
import React from 'react';
import {Composition, registerRoot, useCurrentFrame} from 'remotion';
const Film = () => <div style={{width:32,height:32,background:useCurrentFrame()%2?'red':'blue'}} />;
registerRoot(() => <Composition id="Native" component={Film} width={32} height={32} fps={30} durationInFrames={3} />);
`);
  await writeFile(file, JSON.stringify({
    root, runtimeRoot, concurrency: 1, hardwareAcceleration: "disable",
    jobs: [{ id: "Native", entryPoint: "index.tsx", width: 32, height: 32, fps: 30, output }],
  }));
  const result = await renderJobs(file);
  assert.equal(result.status, "complete", JSON.stringify(result));
  const runtime = await loadRuntime(runtimeRoot, runtimeRoot);
  const options = { indent: false, logLevel: "error", binariesDirectory: null };
  const probe = await runtime.RenderInternals.callFf({
    ...options, bin: "ffprobe",
    args: ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height,nb_frames", "-of", "json", output],
  });
  const [stream] = JSON.parse(probe.stdout).streams;
  assert.equal(stream.codec_name, "h264");
  assert.equal(stream.width, 32);
  assert.equal(stream.height, 32);
  assert.equal(stream.nb_frames, "3");
  await runtime.RenderInternals.callFf({
    ...options, bin: "ffmpeg", args: ["-v", "error", "-xerror", "-i", output, "-c:v", "libx264", "-f", "null", "-"],
  });
});
