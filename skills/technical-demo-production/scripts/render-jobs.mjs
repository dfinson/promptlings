import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

export const supportedVersion = "4.0.539";

export function resolveManifest(manifest, manifestPath) {
  const text = (value) => typeof value === "string" && value.trim().length > 0;
  if (!manifest || !Array.isArray(manifest.jobs) || !manifest.jobs.length) {
    throw new Error("jobs must be a nonempty array");
  }
  if (!Number.isInteger(manifest.concurrency) || manifest.concurrency < 1) {
    throw new Error("concurrency must be a positive integer");
  }
  if (manifest.root !== undefined && !text(manifest.root)) throw new Error("root must be a path");
  if (!text(manifest.browserExecutable)) {
    throw new Error("browserExecutable must identify the approved browser");
  }
  const root = path.resolve(path.dirname(manifestPath), manifest.root ?? ".");
  const outputs = new Set();
  const outputPath = (value) => {
    if (!text(value)) throw new Error("Output paths must be nonempty strings");
    const resolved = path.resolve(root, value);
    if (outputs.has(resolved)) throw new Error(`Duplicate output path: ${resolved}`);
    outputs.add(resolved);
    return resolved;
  };
  const jobs = manifest.jobs.map((job) => {
    if (!job || !text(job.id)) throw new Error("Each job needs a composition id");
    if (Number(text(job.entryPoint)) + Number(text(job.serveUrl)) !== 1) {
      throw new Error("Each job needs exactly one entryPoint or serveUrl");
    }
    if (!Number.isInteger(job.width) || job.width < 1 || !Number.isInteger(job.height) || job.height < 1
      || !Number.isFinite(job.fps) || job.fps <= 0) throw new Error("Each job needs native width, height and fps");
    if (job.inputProps !== undefined && (!job.inputProps || Array.isArray(job.inputProps)
      || typeof job.inputProps !== "object")) throw new Error("inputProps must be an object");
    if (job.stills !== undefined && (!Array.isArray(job.stills) || !job.stills.length
      || job.stills.some((frame) => !Number.isInteger(frame) || frame < 0))) {
      throw new Error("stills must be a nonempty array of nonnegative frame numbers");
    }
    if (job.output === undefined && !job.stills) throw new Error("Each job needs output or stills");
    return {
      ...job,
      entryPoint: text(job.entryPoint) ? path.resolve(root, job.entryPoint) : undefined,
      serveUrl: text(job.serveUrl)
        ? (/^https?:\/\//i.test(job.serveUrl) ? job.serveUrl : path.resolve(root, job.serveUrl))
        : undefined,
      output: job.output === undefined ? undefined : outputPath(job.output),
      stillOutput: job.stills ? outputPath(job.stillOutput) : undefined,
      inputProps: job.inputProps ?? {},
    };
  });
  return {
    root, concurrency: manifest.concurrency, jobs,
    browserExecutable: path.resolve(root, manifest.browserExecutable),
  };
}

async function loadRuntime(root) {
  const require = createRequire(path.join(root, "package.json"));
  for (const name of ["remotion", "@remotion/bundler", "@remotion/renderer"]) {
    const version = require(`${name}/package.json`).version;
    if (version !== supportedVersion) {
      throw new Error(`Expected ${name} ${supportedVersion}, found ${version}`);
    }
  }
  const bundler = await import(pathToFileURL(require.resolve("@remotion/bundler")).href);
  const renderer = await import(pathToFileURL(require.resolve("@remotion/renderer")).href);
  return { ...bundler, ...renderer, version: supportedVersion };
}

export async function renderJobs(manifestPath, runtime) {
  manifestPath = path.resolve(manifestPath);
  const manifest = resolveManifest(JSON.parse(await readFile(manifestPath, "utf8")), manifestPath);
  const resultsPath = path.join(path.dirname(manifestPath), `${path.parse(manifestPath).name}-result.json`);
  const results = {
    startedAt: new Date().toISOString(), status: "running",
    concurrency: manifest.concurrency, bundles: [], jobs: [],
  };
  const started = performance.now();
  const elapsed = () => Number(((performance.now() - started) / 1000).toFixed(3));
  const save = () => writeFile(resultsPath, JSON.stringify(results, null, 2));
  const message = (error) => error instanceof Error ? error.message : String(error);
  const bundles = new Map();
  let browser;
  let active;
  try {
    runtime ??= await loadRuntime(manifest.root);
    results.version = runtime.version;
    if (runtime.version !== supportedVersion) throw new Error(`Expected Remotion ${supportedVersion}, found ${runtime.version}`);
    await access(manifest.browserExecutable);
    browser = await runtime.openBrowser("chrome", {
      forceDeviceScaleFactor: 1,
      browserExecutable: manifest.browserExecutable,
    });
    for (const [index, job] of manifest.jobs.entries()) {
      active = { id: job.id, status: "running", beginSeconds: elapsed() };
      results.jobs.push(active);
      let serveUrl = job.serveUrl;
      if (job.entryPoint) {
        if (!bundles.has(job.entryPoint)) {
          const begin = elapsed();
          console.log("BUNDLE", job.entryPoint);
          const output = await runtime.bundle({
            entryPoint: job.entryPoint, rootDir: manifest.root,
            outDir: path.join(path.dirname(manifestPath), `${path.parse(manifestPath).name}-bundle-${index}`),
          });
          bundles.set(job.entryPoint, output);
          results.bundles.push({ entryPoint: job.entryPoint, serveUrl: output, seconds: elapsed() - begin });
        }
        serveUrl = bundles.get(job.entryPoint);
      }
      const { inputProps } = job;
      const composition = await runtime.selectComposition({
        serveUrl, id: job.id, inputProps, puppeteerInstance: browser,
      });
      if (composition.width !== job.width || composition.height !== job.height || composition.fps !== job.fps) {
        throw new Error(`Unexpected native format for ${job.id}: ${composition.width}x${composition.height}@${composition.fps}`);
      }
      if (job.stills?.some((frame) => frame >= composition.durationInFrames)) {
        throw new Error(`Still frame outside ${job.id} duration: ${composition.durationInFrames}`);
      }
      Object.assign(active, {
        nativeWidth: composition.width, nativeHeight: composition.height, fps: composition.fps,
        durationFrames: composition.durationInFrames, serveUrl,
      });
      const common = { serveUrl, composition, inputProps, puppeteerInstance: browser, scale: 1, concurrency: manifest.concurrency };
      if (job.stills) {
        const begin = elapsed();
        await mkdir(job.stillOutput, { recursive: true });
        await runtime.renderFrames({
          ...common, frames: job.stills, outputDir: job.stillOutput, imageFormat: "png",
          onStart: () => console.log("STILLS", job.id, job.stills.length), onFrameUpdate: () => {},
        });
        active.stillSeconds = elapsed() - begin;
        active.stillCount = job.stills.length;
        active.stillOutput = job.stillOutput;
      }
      if (job.output) {
        const begin = elapsed();
        let lastProgress = -1;
        await mkdir(path.dirname(job.output), { recursive: true });
        await runtime.renderMedia({
          ...common, outputLocation: job.output, codec: "h264", crf: 18, x264Preset: "veryfast",
          onProgress: ({ progress }) => {
            const step = Math.floor(progress * 10);
            if (step > lastProgress) {
              console.log("RENDER", job.id, `${step * 10}%`);
              lastProgress = step;
            }
          },
        });
        active.renderSeconds = elapsed() - begin;
        active.output = job.output;
      }
      active.status = "complete";
      active.readySeconds = elapsed();
      await save();
      console.log("READY", job.id, active.readySeconds);
      active = undefined;
    }
    results.status = "complete";
  } catch (error) {
    results.status = "failed";
    results.error = message(error);
    if (active) active.status = "failed";
    console.error(error);
  } finally {
    const begin = elapsed();
    if (browser) {
      // This connection is version-specific, guarded before the browser opens.
      for (const close of [() => browser.connection.send("Browser.close"), () => browser.close({ silent: true })]) {
        try {
          await close();
        } catch (error) {
          results.status = "failed";
          (results.shutdownErrors ??= []).push(message(error));
          console.error("Browser shutdown failed:", error);
        }
      }
    }
    results.shutdownSeconds = elapsed() - begin;
    results.totalSeconds = elapsed();
    await save();
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (!process.argv[2]) throw new Error("Usage: node render-jobs.mjs <manifest.json>");
    const result = await renderJobs(process.argv[2]);
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== "complete") process.exitCode = 1;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
