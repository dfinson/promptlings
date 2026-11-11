import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { defaultConcurrency, loadRuntime, probeHardwareEncoder, renderJobs, resolveBrowser, resolveManifest, runtimeWebpackOverride, supportedVersion } from "../skills/technical-demo-production/scripts/render-jobs.mjs";

const job = { id: "Film", entryPoint: "src/index.ts", width: 1920, height: 1080, fps: 30, output: "renders/film.mp4" };
const manifest = { root: ".", browserExecutable: "browser/chrome", concurrency: 2, jobs: [job] };

function fakeRuntime() {
  const calls = [];
  const track = (name, value) => async (options) => { calls.push([name, options]); return value; };
  return {
    calls, version: supportedVersion,
    openBrowser: track("open", { connection: { send: track("cdp") }, close: track("close") }),
    bundle: track("bundle", "bundled"),
    selectComposition: track("select", { width: 1920, height: 1080, fps: 30, durationInFrames: 60 }),
    renderFrames: track("stills"),
    renderMedia: track("media"),
    RenderInternals: {
      callFf: async (options) => { calls.push(["probe", options]); throw new Error("No hardware encoder on test host"); },
    },
    makeCancelSignal: () => {
      let callback;
      return {
        cancelSignal: (listener) => { callback = listener; },
        cancel: () => { calls.push(["cancel"]); callback?.(); },
      };
    },
  };
}

async function fixture(t, data = manifest) {
  const root = await mkdtemp(path.join(tmpdir(), "demo-render-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "jobs.json");
  await writeFile(file, JSON.stringify(data));
  const browser = path.resolve(root, data.browserExecutable ?? "browser/chrome");
  await mkdir(path.dirname(browser), { recursive: true });
  await writeFile(browser, "Test runtime does not execute this fixture.");
  return { root, file, browser, result: () => readFile(path.join(root, "jobs-result.json"), "utf8").then(JSON.parse) };
}

test("manifest paths are relative to its explicit root and HTTP URLs stay URLs", () => {
  const file = path.resolve("production", "batch", "jobs.json");
  const actual = resolveManifest({ ...manifest, root: ".." }, file);
  assert.equal(actual.jobs[0].entryPoint, path.resolve("production", "src/index.ts"));
  const remote = resolveManifest({ ...manifest, jobs: [{ ...job, entryPoint: undefined, serveUrl: "https://example.test/film" }] }, file);
  assert.equal(remote.jobs[0].serveUrl, "https://example.test/film");
  const local = resolveManifest({ ...manifest, jobs: [{ ...job, entryPoint: undefined, serveUrl: "bundle" }] }, file);
  assert.equal(local.jobs[0].serveUrl, path.resolve("production", "batch", "bundle"));
});

test("invalid manifests fail before production starts", () => {
  for (const invalid of [
    { ...manifest, concurrency: 0 }, { ...manifest, jobs: [] }, { ...manifest, root: 42 },
    { ...manifest, browserExecutable: "" }, { ...manifest, runtimeRoot: "" },
    { ...manifest, hardwareAcceleration: "if-possible" }, { ...manifest, videoBitrate: "invalid" },
    { ...manifest, videoBitrate: "0M" }, { ...manifest, gl: "magic" },
    { ...manifest, videoBitrate: "30000000" },
    { ...manifest, port: 0 }, { ...manifest, port: 65536 },
    { ...manifest, stallTimeoutSeconds: 0 }, { ...manifest, stallTimeoutSeconds: 1.5 },
    { ...manifest, stallTimeoutSeconds: 86401 },
    ...[
      { serveUrl: "bundle" }, { entryPoint: undefined }, { width: 0 }, { fps: 0 },
      { output: undefined }, { output: "" }, { inputProps: [] },
      { stills: [] }, { stills: [-1], stillOutput: "frames" }, { stills: [0] },
      { frameRange: [2, 1] }, { frameRange: [-1, 5] }, { frameRange: [0] },
      { frameRange: [0, 1.5] }, { frameRange: [0, 1], output: undefined, stills: [0], stillOutput: "frames" },
    ].map((change) => ({ ...manifest, jobs: [{ ...job, ...change }] })),
    { ...manifest, jobs: [job, job] },
  ]) assert.throws(() => resolveManifest(invalid, path.resolve("jobs.json")));
});

test("installed runtime supplies a browser and bundler modules without project installs", async (t) => {
  const f = await fixture(t, { ...manifest, browserExecutable: undefined });
  const runtime = { ...fakeRuntime(), runtimeRoot: path.join(f.root, "managed-runtime") };
  await mkdir(runtime.runtimeRoot);
  await writeFile(path.join(runtime.runtimeRoot, "browser.json"), JSON.stringify({
    version: supportedVersion, browserExecutable: f.browser,
  }));
  const open = runtime.openBrowser;
  runtime.openBrowser = (name, options) => open(options);
  const result = await renderJobs(f.file, runtime);
  assert.equal(result.status, "complete");
  assert.equal(result.runtimeRoot, runtime.runtimeRoot);
  assert.equal(runtime.calls.find(([name]) => name === "open")[1].browserExecutable, f.browser);
  const override = runtime.calls.find(([name]) => name === "bundle")[1].webpackOverride;
  const config = override({ resolve: { modules: ["node_modules"], alias: { react: "pinned-react" } } });
  assert.deepEqual(config.resolve.modules, ["node_modules", path.join(runtime.runtimeRoot, "node_modules")]);
  assert.equal(config.resolve.alias.react, "pinned-react");
});

test("browser records fail explicitly when missing, mismatched or not absolute", async (t) => {
  const f = await fixture(t);
  const runtime = { runtimeRoot: f.root };
  await assert.rejects(resolveBrowser({}, runtime), /Cannot read installed browser record/);
  for (const record of [
    { version: "wrong", browserExecutable: f.browser },
    { version: supportedVersion, browserExecutable: "relative-browser" },
  ]) {
    await writeFile(path.join(f.root, "browser.json"), JSON.stringify(record));
    await assert.rejects(resolveBrowser({}, runtime), /Invalid installed browser record/);
  }
  assert.equal(await resolveBrowser({ browserExecutable: f.browser }, runtime), f.browser);
  assert.deepEqual(runtimeWebpackOverride(f.root)({}).resolve.modules, ["node_modules", path.join(f.root, "node_modules")]);
});

test("an explicitly selected runtime never falls back past a missing or wrong package", async (t) => {
  const f = await fixture(t);
  const root = path.join(f.root, "runtime");
  await mkdir(path.join(root, "node_modules", "remotion"), { recursive: true });
  await assert.rejects(loadRuntime(f.root, root), /Cannot load remotion/);
  await writeFile(path.join(root, "node_modules", "remotion", "package.json"), JSON.stringify({ version: "4.0.540" }));
  await assert.rejects(loadRuntime(f.root, root), /Expected remotion 4.0.539, found 4.0.540/);
});

test("a batch shares one browser and one bundle while passing distinct props", async (t) => {
  const runtime = fakeRuntime();
  const f = await fixture(t, { ...manifest, jobs: [
    { ...job, inputProps: { title: "First" }, stills: [0, 29, 30], stillOutput: "frames" },
    { ...job, inputProps: { title: "Second" }, output: "renders/second.mp4" },
  ] });
  const result = await renderJobs(f.file, runtime);
  assert.equal(result.status, "complete");
  for (const name of ["open", "bundle", "cdp", "close"]) assert.equal(runtime.calls.filter(([n]) => n === name).length, 1, name);
  const media = runtime.calls.filter(([n]) => n === "media").map(([, options]) => options);
  assert.deepEqual(media.map((options) => options.inputProps.title), ["First", "Second"]);
  for (const options of media) {
    assert.equal(options.scale, 1);
    assert.equal(options.crf, 18);
    assert.equal(options.x264Preset, "veryfast");
    assert.equal(options.hardwareAcceleration, "disable");
    assert.equal(options.concurrency, 2);
  }
  assert.equal(result.jobs[0].stillCount, 3);
  assert.equal(runtime.calls.filter(([name]) => name === "probe").length, 1);
  assert.match(result.jobs[0].encodingReason, /No hardware encoder/);
  assert.deepEqual(await f.result(), result);
});

test("stills-only jobs use an existing bundle without encoding", async (t) => {
  const runtime = fakeRuntime();
  const f = await fixture(t, { ...manifest, jobs: [
    { ...job, entryPoint: undefined, serveUrl: "bundle", output: undefined, stills: [0], stillOutput: "frames" },
  ] });
  assert.equal((await renderJobs(f.file, runtime)).status, "complete");
  assert.equal(runtime.calls.some(([name]) => ["bundle", "media", "probe"].includes(name)), false);
  assert.equal(runtime.calls.filter(([name]) => name === "stills").length, 1);
});

test("native-format and frame-range failures never encode", async (t) => {
  for (const change of [{ width: 1280 }, { fps: 60 }, { stills: [60], stillOutput: "frames" }, { frameRange: [0, 60] }]) {
    const f = await fixture(t, { ...manifest, jobs: [{ ...job, ...change }] });
    const runtime = fakeRuntime();
    const result = await renderJobs(f.file, runtime);
    assert.equal(result.status, "failed");
    assert.equal(runtime.calls.some(([name]) => name === "media"), false);
    assert.equal(runtime.calls.filter(([name]) => name === "close").length, 1);
    assert.equal((await f.result()).status, "failed");
  }
});

test("automatic workers respect available CPU and memory without copying a host's count", () => {
  const gib = 1024 ** 3;
  assert.equal(defaultConcurrency(1, gib / 2), 1);
  assert.equal(defaultConcurrency(4, 16 * gib), 2);
  assert.equal(defaultConcurrency(64, 3 * gib), 1);
  assert.equal(defaultConcurrency(64, 64 * gib), 4);
  const resolved = resolveManifest({ ...manifest, concurrency: undefined }, path.resolve("jobs.json"));
  assert.ok(resolved.concurrency >= 1 && resolved.concurrency <= 4);
  assert.equal(resolved.hardwareAcceleration, "auto");
  assert.equal(resolved.gl, null);
});

test("hardware availability requires a real encode using platform-specific backends", async () => {
  for (const platform of ["win32", "linux", "darwin"]) {
    let options;
    const runtime = { RenderInternals: { callFf: async (value) => { options = value; } } };
    const result = await probeHardwareEncoder(runtime, job, platform);
    assert.equal(result.available, true);
    assert.equal(result.encoder, platform === "darwin" ? "h264_videotoolbox" : "h264_nvenc");
    assert.ok(options.args.includes(result.encoder));
    assert.ok(options.args.includes("scale=1920:1080"));
    assert.ok(options.args.includes("pipe:0"));
    assert.ok(!options.args.includes("-encoders"));
    assert.equal(options.options.input.subarray(1, 4).toString(), "PNG");
    assert.equal(options.options.timeout, 15000);
    assert.equal(options.args.includes("-allow_sw"), platform === "darwin");
  }
  const runtime = fakeRuntime();
  const unsupported = await probeHardwareEncoder(runtime, job, "unsupported");
  assert.equal(unsupported.available, false);
  assert.equal(runtime.calls.length, 0);
});

test("auto mode uses a successful hardware probe without CRF or x264 preset", async (t) => {
  const runtime = fakeRuntime();
  runtime.RenderInternals.callFf = async () => {};
  const f = await fixture(t);
  const result = await renderJobs(f.file, runtime);
  assert.equal(result.status, "complete");
  const options = runtime.calls.find(([name]) => name === "media")[1];
  assert.equal(options.hardwareAcceleration, "required");
  assert.equal(options.videoBitrate, "30000k");
  assert.ok(!("crf" in options));
  assert.ok(!("x264Preset" in options));
  assert.equal(result.jobs[0].encoding.videoBitrate, "30000k");
});

test("required hardware fails before rendering when the driver cannot encode", async (t) => {
  const f = await fixture(t, { ...manifest, hardwareAcceleration: "required" });
  const runtime = fakeRuntime();
  const result = await renderJobs(f.file, runtime);
  assert.equal(result.status, "failed");
  assert.match(result.error, /Hardware encoding required but probe failed/);
  assert.ok(!runtime.calls.some(([name]) => name === "media"));
  assert.equal(runtime.calls.filter(([name]) => name === "close").length, 1);
});

test("hardware defaults scale with the native pixel rate and probe each distinct format", async (t) => {
  const runtime = fakeRuntime();
  const probes = [];
  runtime.RenderInternals.callFf = async (options) => { probes.push(options); };
  runtime.selectComposition = async ({ inputProps }) => ({ ...inputProps, durationInFrames: 60 });
  const formats = [{ width: 3840, height: 2160, fps: 60 }, { width: 64, height: 64, fps: 30 }];
  const f = await fixture(t, { ...manifest, jobs: formats.map((format, index) => ({
    ...job, ...format, inputProps: format, output: `renders/${index}.mp4`,
  })) });
  const result = await renderJobs(f.file, runtime);
  assert.equal(result.status, "complete");
  assert.deepEqual(result.jobs.map((item) => item.encoding.videoBitrate), ["240000k", "1000k"]);
  assert.equal(probes.length, 2);
});

test("explicit software encoding skips detection and retains the original quality profile", async (t) => {
  const f = await fixture(t, { ...manifest, hardwareAcceleration: "disable" });
  const runtime = fakeRuntime();
  const result = await renderJobs(f.file, runtime);
  assert.equal(result.status, "complete");
  assert.ok(!runtime.calls.some(([name]) => name === "probe"));
  assert.deepEqual(result.jobs[0].encoding, { hardwareAcceleration: "disable", crf: 18, x264Preset: "veryfast" });
});

test("a hardware failure after a successful probe is preserved rather than rerendered silently", async (t) => {
  const f = await fixture(t);
  const runtime = fakeRuntime();
  runtime.RenderInternals.callFf = async () => {};
  let attempts = 0;
  runtime.renderMedia = async () => { attempts++; throw new Error("GPU lost during render"); };
  const result = await renderJobs(f.file, runtime);
  assert.equal(result.status, "failed");
  assert.equal(result.error, "GPU lost during render");
  assert.equal(attempts, 1);
});

test("frame ranges, graphics, bitrate and port reach the matching render APIs", async (t) => {
  const runtime = fakeRuntime();
  runtime.RenderInternals.callFf = async () => {};
  const open = runtime.openBrowser;
  runtime.openBrowser = (name, options) => open(options);
  const f = await fixture(t, { ...manifest, port: 55431, gl: "angle", videoBitrate: "20M", jobs: [
    { ...job, frameRange: [10, 29], stills: [10], stillOutput: "frames" },
  ] });
  const result = await renderJobs(f.file, runtime);
  assert.equal(result.status, "complete");
  for (const [name, options] of runtime.calls) {
    if (["open", "select", "stills", "media"].includes(name)) assert.equal(options.chromiumOptions.gl, "angle", name);
    if (["select", "stills", "media"].includes(name)) assert.equal(options.port, 55431, name);
  }
  const media = runtime.calls.find(([name]) => name === "media")[1];
  assert.deepEqual(media.frameRange, [10, 29]);
  assert.equal(media.videoBitrate, "20M");
  assert.equal(result.jobs[0].progress.totalFrames, 20);
});

test("stalled renders are cancelled with progress and shutdown evidence retained", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "Date"] });
  const runtime = fakeRuntime();
  runtime.renderMedia = async ({ onProgress, cancelSignal }) => {
    onProgress({ renderedFrames: 3, encodedFrames: 1, stitchStage: "encoding" });
    const cancelled = new Promise((resolve, reject) => cancelSignal(() => reject(new Error("cancelled"))));
    t.mock.timers.tick(120000);
    return cancelled;
  };
  const f = await fixture(t);
  const result = await renderJobs(f.file, runtime);
  assert.equal(result.status, "failed");
  assert.match(result.error, /No render or encoding progress for 120s/);
  assert.equal(result.jobs[0].progress.renderedFrames, 3);
  assert.equal(runtime.calls.filter(([name]) => name === "cancel").length, 1);
  assert.equal(runtime.calls.filter(([name]) => name === "close").length, 1);
  t.mock.timers.tick(120000);
  assert.equal(runtime.calls.filter(([name]) => name === "cancel").length, 1);
});

test("frame advances reset the configurable watchdog and completed jobs clear it", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "Date"] });
  const runtime = fakeRuntime();
  runtime.renderMedia = async ({ onProgress }) => {
    t.mock.timers.tick(5000);
    onProgress({ renderedFrames: 30, encodedFrames: 0, stitchStage: "encoding" });
    t.mock.timers.tick(5000);
    onProgress({ renderedFrames: 60, encodedFrames: 30, stitchStage: "encoding" });
    t.mock.timers.tick(5000);
    onProgress({ renderedFrames: 60, encodedFrames: 60, stitchStage: "encoding" });
  };
  const f = await fixture(t, { ...manifest, stallTimeoutSeconds: 10 });
  const result = await renderJobs(f.file, runtime);
  assert.equal(result.status, "complete");
  t.mock.timers.tick(10000);
  assert.ok(!runtime.calls.some(([name]) => name === "cancel"));
  assert.equal(result.jobs[0].progress.encodedFrames, 60);
});

test("unsupported versions never open the browser", async (t) => {
  const f = await fixture(t);
  const runtime = { ...fakeRuntime(), version: "4.0.540" };
  const result = await renderJobs(f.file, runtime);
  assert.equal(result.status, "failed");
  assert.match(result.error, /4\.0\.539/);
  assert.equal(runtime.calls.length, 0);
});

test("an absent browser fails explicitly without downloading one", async (t) => {
  const f = await fixture(t);
  const runtime = fakeRuntime();
  await rm(f.browser);
  const result = await renderJobs(f.file, runtime);
  assert.equal(result.status, "failed");
  assert.match(result.error, /ENOENT/);
  assert.equal(runtime.calls.length, 0);
});

test("a configured browser path resolves against the production root", async (t) => {
  const f = await fixture(t, { ...manifest, browserExecutable: "browser/chrome" });
  const runtime = fakeRuntime();
  let executable;
  const open = runtime.openBrowser;
  runtime.openBrowser = async (browser, options) => {
    executable = options.browserExecutable;
    return open(options);
  };
  assert.equal((await renderJobs(f.file, runtime)).status, "complete");
  assert.equal(executable, path.join(f.root, "browser/chrome"));
});

test("render and both shutdown failures retain their separate evidence", async (t) => {
  const f = await fixture(t);
  const runtime = fakeRuntime();
  let closed = false;
  runtime.renderMedia = async () => { throw new Error("encoder failed"); };
  runtime.openBrowser = async () => ({
    connection: { send: async () => { throw new Error("CDP failed"); } },
    close: async () => { closed = true; throw new Error("close failed"); },
  });
  const result = await renderJobs(f.file, runtime);
  assert.equal(closed, true);
  assert.equal(result.status, "failed");
  assert.equal(result.error, "encoder failed");
  assert.deepEqual(result.shutdownErrors, ["CDP failed", "close failed"]);
  assert.equal(result.jobs[0].status, "failed");
  assert.deepEqual(await f.result(), result);
});

test("shutdown failure cannot report a successful batch or lose finished jobs", async (t) => {
  const f = await fixture(t);
  const runtime = fakeRuntime();
  runtime.openBrowser = async () => ({
    connection: { send: async () => {} }, close: async () => { throw new Error("close failed"); },
  });
  const result = await renderJobs(f.file, runtime);
  assert.equal(result.status, "failed");
  assert.equal(result.jobs[0].status, "complete");
  assert.equal((await f.result()).jobs[0].output, path.join(f.root, job.output));
});
