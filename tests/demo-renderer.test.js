import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { renderJobs, resolveManifest, supportedVersion } from "../skills/technical-demo-production/scripts/render-jobs.mjs";

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
  };
}

async function fixture(t, data = manifest) {
  const root = await mkdtemp(path.join(tmpdir(), "demo-render-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "jobs.json");
  await writeFile(file, JSON.stringify(data));
  const browser = path.resolve(root, data.browserExecutable);
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
    { ...manifest, browserExecutable: undefined },
    ...[
      { serveUrl: "bundle" }, { entryPoint: undefined }, { width: 0 }, { fps: 0 },
      { output: undefined }, { output: "" }, { inputProps: [] },
      { stills: [] }, { stills: [-1], stillOutput: "frames" }, { stills: [0] },
    ].map((change) => ({ ...manifest, jobs: [{ ...job, ...change }] })),
    { ...manifest, jobs: [job, job] },
  ]) assert.throws(() => resolveManifest(invalid, path.resolve("jobs.json")));
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
    assert.equal(options.concurrency, 2);
  }
  assert.equal(result.jobs[0].stillCount, 3);
  assert.deepEqual(await f.result(), result);
});

test("stills-only jobs use an existing bundle without encoding", async (t) => {
  const runtime = fakeRuntime();
  const f = await fixture(t, { ...manifest, jobs: [
    { ...job, entryPoint: undefined, serveUrl: "bundle", output: undefined, stills: [0], stillOutput: "frames" },
  ] });
  assert.equal((await renderJobs(f.file, runtime)).status, "complete");
  assert.equal(runtime.calls.some(([name]) => name === "bundle" || name === "media"), false);
  assert.equal(runtime.calls.filter(([name]) => name === "stills").length, 1);
});

test("native-format and frame-range failures never encode", async (t) => {
  for (const change of [{ width: 1280 }, { fps: 60 }, { stills: [60], stillOutput: "frames" }]) {
    const f = await fixture(t, { ...manifest, jobs: [{ ...job, ...change }] });
    const runtime = fakeRuntime();
    const result = await renderJobs(f.file, runtime);
    assert.equal(result.status, "failed");
    assert.equal(runtime.calls.some(([name]) => name === "media"), false);
    assert.equal(runtime.calls.filter(([name]) => name === "close").length, 1);
    assert.equal((await f.result()).status, "failed");
  }
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
