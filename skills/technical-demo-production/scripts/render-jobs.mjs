import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { availableParallelism } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { defaultRuntimeRoot, supportedVersion } from "./demo-runtime.mjs";

export { supportedVersion };

export function defaultConcurrency(cpus = availableParallelism(), memory = process.availableMemory()) {
  return Math.max(1, Math.min(4, Math.floor(cpus / 2), Math.floor(memory / (2 * 1024 ** 3))));
}

export function resolveManifest(manifest, manifestPath) {
  const text = (value) => typeof value === "string" && value.trim().length > 0;
  if (!manifest || !Array.isArray(manifest.jobs) || !manifest.jobs.length) {
    throw new Error("jobs must be a nonempty array");
  }
  if (manifest.concurrency !== undefined && (!Number.isInteger(manifest.concurrency) || manifest.concurrency < 1)) {
    throw new Error("concurrency must be a positive integer");
  }
  if (manifest.root !== undefined && !text(manifest.root)) throw new Error("root must be a path");
  if (manifest.browserExecutable !== undefined && !text(manifest.browserExecutable)) {
    throw new Error("browserExecutable must identify the approved browser when provided");
  }
  if (manifest.runtimeRoot !== undefined && !text(manifest.runtimeRoot)) throw new Error("runtimeRoot must be a path");
  const hardwareAcceleration = manifest.hardwareAcceleration ?? "auto";
  if (!["auto", "required", "disable"].includes(hardwareAcceleration)) {
    throw new Error("hardwareAcceleration must be auto, required or disable");
  }
  if (manifest.videoBitrate !== undefined
    && (typeof manifest.videoBitrate !== "string" || !/^[1-9]\d*[kKM]$/.test(manifest.videoBitrate))) {
    throw new Error("videoBitrate must be a positive integer string ending in k, K or M");
  }
  const gl = manifest.gl ?? null;
  if (![null, "angle", "egl", "swiftshader", "vulkan", "angle-egl", "swangle"].includes(gl)) {
    throw new Error("Unsupported gl backend");
  }
  if (manifest.port !== undefined && (!Number.isInteger(manifest.port) || manifest.port < 1024 || manifest.port > 65535)) {
    throw new Error("port must be an integer from 1024 to 65535");
  }
  const stallTimeoutSeconds = manifest.stallTimeoutSeconds ?? 120;
  if (!Number.isSafeInteger(stallTimeoutSeconds) || stallTimeoutSeconds < 1 || stallTimeoutSeconds > 86400) {
    throw new Error("stallTimeoutSeconds must be an integer from 1 to 86400");
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
    if (job.frameRange !== undefined && (!Array.isArray(job.frameRange) || job.frameRange.length !== 2
      || job.frameRange.some((frame) => !Number.isSafeInteger(frame) || frame < 0)
      || job.frameRange[0] > job.frameRange[1] || job.output === undefined)) {
      throw new Error("frameRange needs an output and inclusive nonnegative [start, end] frames");
    }
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
    root, concurrency: manifest.concurrency ?? defaultConcurrency(), jobs,
    browserExecutable: manifest.browserExecutable === undefined ? undefined : path.resolve(root, manifest.browserExecutable),
    runtimeRoot: manifest.runtimeRoot === undefined ? undefined : path.resolve(root, manifest.runtimeRoot),
    hardwareAcceleration, videoBitrate: manifest.videoBitrate, gl, port: manifest.port, stallTimeoutSeconds,
  };
}

export async function probeHardwareEncoder(runtime, composition, platform = process.platform) {
  const encoder = platform === "darwin" ? "h264_videotoolbox"
    : ["win32", "linux"].includes(platform) ? "h264_nvenc" : null;
  if (!encoder) return { available: false, reason: `No supported H.264 hardware encoder on ${platform}` };
  const { width, height, fps } = composition;
  // One black PNG pixel: bundled FFmpeg supports image2pipe, but not rawvideo or lavfi color.
  const input = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC", "base64");
  try {
    // Pinned Remotion's own FFmpeg and environment, not a system binary or encoder-list check.
    await runtime.RenderInternals.callFf({
      bin: "ffmpeg", indent: false, logLevel: "error", binariesDirectory: null,
      args: ["-hide_banner", "-loglevel", "error", "-f", "image2pipe", "-vcodec", "png",
        "-r", String(fps), "-i", "pipe:0", "-vf", `scale=${width}:${height}`, "-pix_fmt", "yuv420p",
        "-frames:v", "1", "-an", "-c:v", encoder,
        ...(platform === "darwin" ? ["-allow_sw", "0"] : []),
        "-f", "null", "-"],
      options: { input, timeout: 15000 },
    });
    return { available: true, encoder };
  } catch (error) {
    return { available: false, encoder, reason: error.stderr || error.message || String(error) };
  }
}

export async function loadRuntime(root, runtimeRoot) {
  let require = createRequire(path.join(runtimeRoot ?? root, "package.json"));
  if (!runtimeRoot) {
    try { require.resolve("remotion/package.json"); }
    catch (error) {
      if (error.code !== "MODULE_NOT_FOUND") throw error;
      runtimeRoot = defaultRuntimeRoot();
      require = createRequire(path.join(runtimeRoot, "package.json"));
    }
  }
  for (const name of ["remotion", "@remotion/bundler", "@remotion/renderer"]) {
    let version;
    try { version = require(`${name}/package.json`).version; }
    catch (error) {
      throw new Error(`Cannot load ${name} from ${runtimeRoot ?? root}. Run npx promptlings tools to install the demo runtime.`, { cause: error });
    }
    if (version !== supportedVersion) {
      throw new Error(`Expected ${name} ${supportedVersion}, found ${version}`);
    }
  }
  const bundler = await import(pathToFileURL(require.resolve("@remotion/bundler")).href);
  const renderer = await import(pathToFileURL(require.resolve("@remotion/renderer")).href);
  return { ...bundler, ...renderer, version: supportedVersion, runtimeRoot };
}

export async function resolveBrowser(manifest, runtime) {
  if (manifest.browserExecutable) return manifest.browserExecutable;
  const root = runtime.runtimeRoot ?? defaultRuntimeRoot();
  const recordPath = path.join(root, "browser.json");
  let record;
  try { record = JSON.parse(await readFile(recordPath, "utf8")); }
  catch (error) {
    throw new Error(`Cannot read installed browser record ${recordPath}. Run npx promptlings tools or provide browserExecutable.`, { cause: error });
  }
  if (record.version !== supportedVersion || typeof record.browserExecutable !== "string"
    || !path.isAbsolute(record.browserExecutable)) throw new Error(`Invalid installed browser record: ${recordPath}`);
  return record.browserExecutable;
}

export function runtimeWebpackOverride(runtimeRoot) {
  return (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      modules: [...(config.resolve?.modules ?? ["node_modules"]), path.join(runtimeRoot, "node_modules")],
    },
  });
}

export async function renderJobs(manifestPath, runtime) {
  manifestPath = path.resolve(manifestPath);
  const manifest = resolveManifest(JSON.parse(await readFile(manifestPath, "utf8")), manifestPath);
  const resultsPath = path.join(path.dirname(manifestPath), `${path.parse(manifestPath).name}-result.json`);
  const results = {
    startedAt: new Date().toISOString(), status: "running",
    concurrency: manifest.concurrency, bundles: [], jobs: [],
    browserExecutable: manifest.browserExecutable, gl: manifest.gl,
    hardwareAcceleration: manifest.hardwareAcceleration,
    port: manifest.port ?? null, stallTimeoutSeconds: manifest.stallTimeoutSeconds,
  };
  const started = performance.now();
  const elapsed = () => Number(((performance.now() - started) / 1000).toFixed(3));
  const save = () => writeFile(resultsPath, JSON.stringify(results, null, 2));
  const message = (error) => error instanceof Error ? error.message : String(error);
  const bundles = new Map();
  const encoderProbes = new Map();
  let browser;
  let active;
  try {
    runtime ??= await loadRuntime(manifest.root, manifest.runtimeRoot);
    results.version = runtime.version;
    if (runtime.version !== supportedVersion) throw new Error(`Expected Remotion ${supportedVersion}, found ${runtime.version}`);
    const browserExecutable = await resolveBrowser(manifest, runtime);
    results.browserExecutable = browserExecutable;
    results.runtimeRoot = runtime.runtimeRoot ?? manifest.root;
    await access(browserExecutable);
    browser = await runtime.openBrowser("chrome", {
      forceDeviceScaleFactor: 1,
      browserExecutable,
      chromiumOptions: { gl: manifest.gl },
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
            ...(runtime.runtimeRoot ? { webpackOverride: runtimeWebpackOverride(runtime.runtimeRoot) } : {}),
          });
          bundles.set(job.entryPoint, output);
          results.bundles.push({ entryPoint: job.entryPoint, serveUrl: output, seconds: elapsed() - begin });
        }
        serveUrl = bundles.get(job.entryPoint);
      }
      const { inputProps } = job;
      const composition = await runtime.selectComposition({
        serveUrl, id: job.id, inputProps, puppeteerInstance: browser,
        chromiumOptions: { gl: manifest.gl }, port: manifest.port,
      });
      if (composition.width !== job.width || composition.height !== job.height || composition.fps !== job.fps) {
        throw new Error(`Unexpected native format for ${job.id}: ${composition.width}x${composition.height}@${composition.fps}`);
      }
      if (job.stills?.some((frame) => frame >= composition.durationInFrames)) {
        throw new Error(`Still frame outside ${job.id} duration: ${composition.durationInFrames}`);
      }
      if (job.frameRange && job.frameRange[1] >= composition.durationInFrames) {
        throw new Error(`frameRange exceeds ${job.id} duration: ${composition.durationInFrames}`);
      }
      if (job.output && (composition.width % 2 || composition.height % 2)) {
        throw new Error("H.264 output requires even native width and height");
      }
      Object.assign(active, {
        nativeWidth: composition.width, nativeHeight: composition.height, fps: composition.fps,
        durationFrames: composition.durationInFrames, serveUrl,
        frameRange: job.frameRange ?? null,
      });
      const common = {
        serveUrl, composition, inputProps, puppeteerInstance: browser, scale: 1, concurrency: manifest.concurrency,
        chromiumOptions: { gl: manifest.gl }, port: manifest.port,
      };
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
        let probe = { available: false, reason: "Hardware encoding disabled by manifest" };
        if (manifest.hardwareAcceleration !== "disable") {
          const key = `${composition.width}x${composition.height}@${composition.fps}`;
          if (!encoderProbes.has(key)) {
            encoderProbes.set(key, await probeHardwareEncoder(runtime, composition));
          }
          probe = encoderProbes.get(key);
        }
        active.encoding = probe.available
          ? {
            hardwareAcceleration: "required",
            videoBitrate: manifest.videoBitrate ?? `${Math.max(1000,
              Math.round(30000 * composition.width * composition.height * composition.fps / (1920 * 1080 * 30)))}k`,
          }
          : { hardwareAcceleration: "disable", crf: 18, x264Preset: "veryfast" };
        active.encoder = probe.available ? probe.encoder : "libx264";
        if (!probe.available) {
          active.encodingReason = probe.reason;
          console.log("ENCODER", job.id, active.encoder, probe.reason);
          if (manifest.hardwareAcceleration === "required") {
            throw new Error(`Hardware encoding required but probe failed: ${probe.reason}`);
          }
        } else {
          console.log("ENCODER", job.id, active.encoder, active.encoding.videoBitrate);
        }
        const begin = elapsed();
        await mkdir(path.dirname(job.output), { recursive: true });
        const cancellation = runtime.makeCancelSignal();
        let lastAdvance = Date.now();
        let stalled;
        const totalFrames = job.frameRange ? job.frameRange[1] - job.frameRange[0] + 1 : composition.durationInFrames;
        active.progress = { renderedFrames: 0, encodedFrames: 0, totalFrames, stage: "starting" };
        const report = () => console.log("PROGRESS", job.id, JSON.stringify({
          ...active.progress, elapsedSeconds: Number((elapsed() - begin).toFixed(1)),
        }));
        const timer = setInterval(() => {
          report();
          if (!stalled && Date.now() - lastAdvance >= manifest.stallTimeoutSeconds * 1000) {
            stalled = new Error(`No render or encoding progress for ${manifest.stallTimeoutSeconds}s`);
            console.error(stalled.message);
            cancellation.cancel();
          }
        }, Math.min(5000, manifest.stallTimeoutSeconds * 1000));
        report();
        try {
          await runtime.renderMedia({
            ...common, outputLocation: job.output, codec: "h264", ...active.encoding,
            frameRange: job.frameRange, cancelSignal: cancellation.cancelSignal,
            onProgress: ({ renderedFrames, encodedFrames, stitchStage }) => {
              if (renderedFrames > active.progress.renderedFrames || encodedFrames > active.progress.encodedFrames
                || stitchStage !== active.progress.stage) lastAdvance = Date.now();
              active.progress = { renderedFrames, encodedFrames, totalFrames, stage: stitchStage };
            },
          });
          if (stalled) throw stalled;
          report();
        } catch (error) {
          throw stalled ?? error;
        } finally {
          clearInterval(timer);
        }
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
