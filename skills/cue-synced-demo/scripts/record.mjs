import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

function installCursor() {
  const install = () => {
    const cursor = document.createElement("div");
    cursor.style.cssText = "position:fixed;left:-40px;top:-40px;width:14px;height:14px;" +
      "border:2px solid white;border-radius:50%;background:#2229;z-index:2147483647;pointer-events:none";
    document.documentElement.append(cursor);
    addEventListener("mousemove", (event) => {
      (document.querySelector("dialog[open]") || document.documentElement).append(cursor);
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
    }, true);
    addEventListener("mousedown", () => { cursor.style.background = "#e44646"; }, true);
    addEventListener("mouseup", () => { cursor.style.background = "#2229"; }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", install);
  else install();
}

export async function startRecorder({
  chromium, directory, viewport = { width: 1280, height: 720 },
  launchOptions = {}, contextOptions = {}, cursor = false,
}) {
  // An exclusive directory reserves the take before launching anything.
  mkdirSync(directory);
  let browser, context, page, origin, finished;
  const events = [], markers = { events: [], waits: [], skipped: [] };
  const seen = new Map();
  const seconds = () => (performance.now() - origin) / 1000;
  const save = () => {
    writeFileSync(join(directory, "events.json"), JSON.stringify({
      clock: "monotonic milliseconds after page creation; inspect video offset",
      events,
    }, null, 2));
    writeFileSync(join(directory, "markers.json"), JSON.stringify(markers, null, 2));
  };
  const ev = (name) => {
    if (typeof name !== "string" || !name.trim()) throw new Error("event name required");
    const n = (seen.get(name) || 0) + 1;
    seen.set(name, n);
    const unique = n === 1 ? name : `${name}#${n}`;
    if (events.some((event) => event.name === unique)) throw new Error(`event collision: ${unique}`);
    const event = { name: unique, ms: seconds() * 1000 };
    events.push(event);
    save();
    return event;
  };
  const waitSpan = async (name, action) => {
    const span = { name, start: seconds() };
    markers.waits.push(span);
    ev(`${name}.start`);
    const result = await action(span);
    span.end = seconds();
    span.seconds = span.end - span.start;
    ev(`${name}.done`);
    return result;
  };
  const optional = async (name, action) => {
    try { return await action(); }
    catch (error) {
      markers.skipped.push({ name, t: seconds(), message: String(error) });
      save();
      return undefined;
    }
  };
  const finish = (error) => {
    if (finished) return finished;
    finished = (async () => {
      if (error) {
        markers.events.push({ name: "error", t: origin === undefined ? 0 : seconds(), message: String(error) });
        if (page) await page.screenshot({ path: join(directory, "error.png") }).catch(() => {});
      }
      save();
      const video = page?.video();
      try { if (context) await context.close(); }
      finally { if (browser) await browser.close(); }
      if (video) renameSync(await video.path(), join(directory, "raw.webm"));
    })();
    return finished;
  };
  try {
    browser = await chromium.launch(launchOptions);
    context = await browser.newContext({
      ...contextOptions, viewport, recordVideo: { dir: directory, size: viewport },
    });
    if (cursor) await context.addInitScript(installCursor);
    page = await context.newPage();
    origin = performance.now();
    save();
    return { browser, context, page, ev, waitSpan, optional, finish };
  } catch (error) {
    await finish(error);
    throw error;
  }
}

export async function record({ flow, ...options }) {
  const recorder = await startRecorder(options);
  try {
    await flow(recorder);
    await recorder.finish();
  } catch (error) {
    try { await recorder.finish(error); }
    catch (finishError) { throw new AggregateError([error, finishError], "capture failed"); }
    throw error;
  }
}
