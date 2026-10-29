"""Assemble unmarked browser takes and per-cue audio with FFmpeg (Python 3.10+)."""

import argparse
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
from array import array
from itertools import pairwise
from pathlib import Path

RATE, BIN, THRESHOLD = 16000, 160, 10 ** (-40 / 10)


def run(*args, binary=False, cwd=None):
    result = subprocess.run(
        [str(arg) for arg in args], capture_output=True, cwd=cwd,
        text=not binary, check=False,
    )
    if result.returncode:
        message = result.stderr.decode(errors="replace") if binary else result.stderr
        raise ValueError(f"{args[0]} failed: {message[-3000:]}")
    return result.stdout


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def write(path, data):
    Path(path).write_text(json.dumps(data, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def number(value):
    value = float(value)
    if not math.isfinite(value):
        raise ValueError("nonfinite timing value")
    return value


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def probe(path):
    return json.loads(run("ffprobe", "-v", "error", "-show_streams", "-show_format",
                          "-of", "json", path))


def envelope(path):
    pcm = array("h")
    pcm.frombytes(run("ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1",
                      "-ar", RATE, "-f", "s16le", "-", binary=True))
    if sys.byteorder != "little":
        pcm.byteswap()
    if not pcm:
        raise ValueError(f"empty audio: {path}")
    active = []
    for i in range(0, len(pcm), BIN):
        block = pcm[i:i + BIN]
        if sum((sample / 32768) ** 2 for sample in block) / len(block) > THRESHOLD:
            active.append(i / RATE)
    if not active:
        raise ValueError(f"silent audio above -40 dBFS: {path}")
    return active, len(pcm) / RATE


def script(path):
    cues, scene, comment = [], None, False
    for line in Path(path).read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if comment:
            comment = "-->" not in line
            continue
        if line.startswith("<!--"):
            comment = "-->" not in line
            continue
        if line.startswith("## "):
            scene = line[3:].strip()
            if not scene or any(cue["scene"] == scene for cue in cues):
                raise ValueError("empty or duplicate scene")
        elif not line or line.startswith((">", "#")):
            continue
        elif line.startswith("@"):
            match = re.fullmatch(r"@(\S+)\s+(.+)", line)
            if not scene or not match:
                raise ValueError(f"invalid cue: {line}")
            event, text = match.groups()
            cues.append({"scene": scene, "event": event, "text": text})
        elif not cues or cues[-1]["scene"] != scene:
            raise ValueError("text before first cue")
        else:
            cues[-1]["text"] += " " + line
    if not cues:
        raise ValueError("no narration cues")
    return cues


def norm(text):
    return " ".join(text.split())


def load_cues(args):
    index = read(args.index)
    if isinstance(index, dict):
        index = [index]
    entries = {}
    for scene in index:
        for cue in scene.get("cues", []):
            key = (str(scene["scene"]), cue["event"])
            if key in entries:
                raise ValueError(f"duplicate audio index cue: {key}")
            entries[key] = (scene, cue)
    events, last = {}, -math.inf
    for event in read(args.take / "events.json")["events"]:
        timestamp = number(event["ms"]) / 1000 + args.offset
        if event["name"] in events or timestamp < last:
            raise ValueError("duplicate or nonmonotonic event log")
        events[event["name"]], last = timestamp, timestamp
    markers = read(args.take / "markers.json") if (args.take / "markers.json").exists() else {}
    optional = {step["name"] for step in markers.get("skipped", [])}
    cues, skipped, used, last = [], [], set(), -math.inf
    for item in script(args.script):
        key = (item["scene"], item["event"])
        if key in used:
            raise ValueError(f"duplicate narration cue: {key}")
        used.add(key)
        name = f"scene:{item['scene']}" if item["event"] == "scene" else item["event"]
        if name not in events:
            if name not in optional or args.strict:
                raise ValueError(f"missing narrated event: {name}")
            skipped.append(name)
            print(f"Warning: skipped explicitly optional cue {name}", file=sys.stderr)
            continue
        if key not in entries:
            raise ValueError(f"missing audio index cue: {key}")
        scene, clip = entries[key]
        if norm(clip["text"]) != norm(item["text"]):
            raise ValueError(f"text mismatch: {key}")
        if scene.get("voice") != args.voice:
            raise ValueError(f"wrong voice: {key}")
        if args.model is not None and scene.get("model") != args.model:
            raise ValueError(f"wrong model: {key}")
        if args.settings is not None and scene.get("settings") != json.loads(args.settings):
            raise ValueError(f"wrong settings: {key}")
        raw = events[name]
        if raw <= last:
            raise ValueError("narrated events must be strictly ordered")
        last = raw
        audio = (args.index.parent / clip["file"]).resolve()
        active, duration = envelope(audio)
        onset, end = active[0], min(duration, active[-1] + BIN / RATE)
        cues.append({**item, "name": name, "raw": raw, "audio": str(audio),
                     "duration": duration, "onset": onset, "voiceEnd": end,
                     "voice": scene["voice"], "model": scene.get("model"),
                     "settings": scene.get("settings")})
    if not cues:
        raise ValueError("no recorded narration cues remain")
    return cues, skipped


def schedule(args, cues, total):
    fps = args.fps
    frames = math.ceil(total * fps - 1e-7)
    for cue in cues:
        cue["frame"] = math.ceil(cue["raw"] * fps - 1e-7)
        if not 0 <= cue["raw"] < total or not 0 <= cue["frame"] < frames:
            raise ValueError(f"event outside footage: {cue['name']}")
    if any(b["frame"] <= a["frame"] for a, b in pairwise(cues)):
        raise ValueError("narrated events must occupy distinct ordered output frames")
    markers = read(args.take / "markers.json") if (args.take / "markers.json").exists() else {}
    if any(item.get("name") == "error" for item in markers.get("events", [])):
        raise ValueError("take contains a required failure")
    proposed = []
    for wait in markers.get("waits", []):
        if "end" not in wait:
            continue
        a, b = number(wait["start"]) + args.offset, number(wait["end"]) + args.offset
        if not 0 <= a <= b <= total:
            raise ValueError("wait outside footage or reversed")
        if b - a > 2 * args.keep + 1:
            proposed.append((max(1, math.ceil((a + args.keep) * fps)),
                             min(frames - 1, math.floor((b - args.keep) * fps))))
    # Union nested waits, then retain half a second on both sides of every cue.
    merged = []
    for a, b in sorted(proposed):
        if merged and a <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(b, merged[-1][1]))
        else:
            merged.append((a, b))
    cuts = []
    guard = math.ceil(0.5 * fps)
    for a, b in merged:
        start = a
        for cue in cues:
            f = cue["frame"]
            if f + guard <= start or f - guard >= b:
                continue
            if f - guard - start >= fps:
                cuts.append((start, f - guard))
            start = max(start, f + guard)
        if b - start >= fps:
            cuts.append((start, b))
    segments, start, base = [], 0, 0
    for a, b in cuts + [(frames, frames)]:
        if a > start:
            segments.append({"a": start, "b": a, "base": base})
            base += a - start
        start = b
    holds, previous_file_end, previous_voice_end = {}, 0, -args.gap
    accumulated = 0
    for cue in cues:
        f = cue["frame"]
        segment = next(s for s in segments if s["a"] <= f < s["b"])
        natural = (segment["base"] + f - segment["a"] + accumulated) / fps
        lead = max(0.2, cue["onset"])
        if lead >= 0.3:
            raise ValueError("audio onset is too late for drift [0, 0.3); trim its leading silence")
        needed = max(previous_voice_end + args.gap - lead,
                     previous_file_end - lead + cue["onset"])
        hold = max(0, math.ceil((needed - natural) * fps - 1e-7))
        if hold and f == 0:
            raise ValueError("cannot hold before the first captured frame")
        if hold:
            holds[f] = holds.get(f, 0) + hold
            accumulated += hold
        event_t = natural + hold / fps
        file_start = event_t + lead - cue["onset"]
        cue.update(eventT=event_t, fileStart=file_start,
                   fileEnd=file_start + cue["duration"], audioStart=event_t + lead,
                   audioEnd=file_start + cue["voiceEnd"], drift=lead, hold=hold / fps)
        previous_file_end, previous_voice_end = cue["fileEnd"], cue["audioEnd"]
    pieces = []
    for segment in segments:
        points = [segment["a"], *sorted(f for f in holds if segment["a"] < f < segment["b"]),
                  segment["b"]]
        pieces.extend({"a": a, "b": b, "pad": 0} for a, b in pairwise(points))
    for f, hold in holds.items():
        previous = [piece for piece in pieces if piece["b"] <= f]
        if not previous:
            raise ValueError("no preceding frame available for hold")
        previous[-1]["pad"] += hold
    needed_end = math.ceil((max(cue["fileEnd"] for cue in cues) + 0.5) * fps)
    pieces[-1]["pad"] += max(0, needed_end - base - accumulated)
    output = 0
    for piece in pieces:
        piece["out"] = output
        output += piece["b"] - piece["a"] + piece["pad"]
    badges = []
    for a, b in cuts:
        piece = next(piece for piece in pieces if piece["a"] == b)
        badges.append({"start": piece["out"] / fps, "seconds": (b - a) / fps})
    return pieces, cuts, badges, output / fps


def check_windows(cues, duration):
    previous_end = 0
    for cue in cues:
        start, end, event = (number(cue[key]) for key in ("audioStart", "audioEnd", "eventT"))
        if not 0 <= event <= start < end <= duration + 1e-7:
            raise ValueError("out-of-range voice window")
        if start < previous_end - 1e-7:
            raise ValueError("overlapping voice windows")
        if not 0 <= start - event < 0.3:
            raise ValueError("voice onset drift outside [0, 0.3)")
        previous_end = end


def verify(movie, cues, out):
    duration = number(probe(movie)["format"]["duration"])
    identity = {"finalPath": str(movie.resolve()), "sha256": sha(movie)}
    try:
        check_windows(cues, duration)
        for cue in cues:
            if not 0 <= number(cue["fileStart"]) < number(cue["fileEnd"]) <= duration + 1e-7:
                raise ValueError("out-of-range audio file window")
    except ValueError as error:
        write(out / "verification.json", {**identity, "passed": False, "error": str(error)})
        raise
    active, decoded_duration = envelope(movie)
    results = []
    for i, cue in enumerate(cues):
        # Include early speech, excluding the previous cue's final quantization bins.
        a = max(0, cues[i - 1]["audioEnd"] + 2 * BIN / RATE if i else cue["eventT"] - 1)
        b = min(decoded_duration, cue["fileEnd"] + 0.03)
        found = [time for time in active if a <= time < b]
        onset = found[0] if found else None
        drift = onset - cue["eventT"] if found else None
        results.append({"event": cue["name"], "eventT": cue["eventT"], "onset": onset,
                        "end": min(decoded_duration, found[-1] + 0.01) if found else None,
                        "drift": drift, "passed": drift is not None and 0 <= drift < 0.3})
    for previous, current in pairwise(results):
        if (previous["end"] is not None and current["onset"] is not None
                and previous["end"] > current["onset"] + 1e-7):
            previous["passed"] = current["passed"] = False
    report = {**identity,
              "visualClock": "recording assumption; inspect event frames, not proven by audio",
              "passed": all(item["passed"] for item in results), "cues": results}
    write(out / "verification.json", report)
    if not report["passed"]:
        raise ValueError("encoded audio onset verification failed; see verification.json")


def contact_sheet(movie, cues, out):
    scenes = set()
    for i, cue in enumerate(cues):
        target = out / f"event-{i + 1:03}.png"
        run("ffmpeg", "-v", "error", "-ss", f"{cue['eventT']:.6f}", "-i", movie,
            "-frames:v", "1", "-update", "1", target)
        if cue["scene"] not in scenes:
            scenes.add(cue["scene"])
            run("ffmpeg", "-v", "error", "-i", target, "-vf",
                "scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2",
                "-frames:v", "1", "-update", "1", out / f"scene-{len(scenes):03}.png")
    count = len(scenes)
    run("ffmpeg", "-v", "error", "-framerate", "1", "-i", out / "scene-%03d.png",
        "-vf", f"tile={min(3, count)}x{math.ceil(count / 3)}", "-frames:v", "1",
        "-update", "1", out / "contact-sheet.png")


def assemble(args):
    cues, skipped = load_cues(args)
    raw = args.take / "raw.webm"
    info = probe(raw)
    video = next(stream for stream in info["streams"] if stream["codec_type"] == "video")
    pieces, cuts, badges, duration = schedule(args, cues, number(info["format"]["duration"]))
    check_windows(cues, duration)
    report = {"capture": str(raw.resolve()), "fps": args.fps, "offset": args.offset,
              "dimensions": [video["width"] + video["width"] % 2,
                             video["height"] + video["height"] % 2], "outSeconds": duration,
              "visualClock": "recording assumption; inspect raw/final frames and adjust --offset",
              "cues": cues, "skipped": skipped,
              "cuts": [{"start": a / args.fps, "end": b / args.fps}
                                    for a, b in cuts], "pieces": pieces}
    write(args.output / "timing.json", report)
    if args.dry:
        print(f"Dry run: {len(cues)} cues, {len(cuts)} cuts, {duration:.3f}s")
        return
    n = len(pieces)
    graph = [f"[0:v]setpts=PTS-STARTPTS,fps={args.fps},pad=ceil(iw/2)*2:ceil(ih/2)*2,split={n}" +
             "".join(f"[s{i}]" for i in range(n))]
    for i, piece in enumerate(pieces):
        graph.append(f"[s{i}]trim=start_frame={piece['a']}:end_frame={piece['b']},"
                     f"setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop={piece['pad']}[v{i}]")
    graph.append("".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[cat]")
    last = "cat"
    font = args.font
    if font is None and os.name == "nt":
        font = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts" / "arial.ttf"
    font_filter = ""
    if badges and font is not None:
        shutil.copyfile(font, args.output / "badge-font.ttf")
        font_filter = "fontfile=badge-font.ttf:"
    for i, badge in enumerate(badges):
        # Only numeric content enters drawtext, never arbitrary application text.
        graph.append(f"[{last}]drawtext={font_filter}text='Skipped {badge['seconds']:.1f}s of waiting':"
                     "fontsize=20:fontcolor=white:box=1:boxcolor=black@0.8:x=16:y=h-th-16:"
                     f"enable='between(t,{badge['start']:.6f},{badge['start'] + 2.5:.6f})'[badge{i}]")
        last = f"badge{i}"
    graph.append(f"[{last}]null[vout]")
    for i, cue in enumerate(cues):
        graph.append(f"[{i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,"
                     f"asetpts=PTS-STARTPTS,adelay={round(cue['fileStart'] * 1000)}:all=1[a{i}]")
    graph.append("".join(f"[a{i}]" for i in range(len(cues))) +
                 f"amix=inputs={len(cues)}:normalize=0,apad[aout]")
    (args.output / "filters.txt").write_text(";\n".join(graph), encoding="utf-8")
    command = ["ffmpeg", "-v", "error", "-i", str(raw.resolve())]
    for cue in cues:
        command.extend(["-i", cue["audio"]])
    command.extend(["-filter_complex_script", "filters.txt", "-map", "[vout]", "-map", "[aout]",
                    "-t", f"{duration:.6f}", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
                    "movie.mp4"])
    run(*command, cwd=args.output)
    movie = args.output / "movie.mp4"
    verify(movie, cues, args.output)
    contact_sheet(movie, cues, args.output)
    print(f"Rendered and audio-checked {movie}")


def joined(movie, timeline, output):
    cues = []
    for part in read(timeline)["parts"]:
        offset = number(part["offset"])
        if offset < 0:
            raise ValueError("negative joining offset")
        report = read(timeline.parent / part["report"])
        check_windows(report["cues"], number(report["outSeconds"]))
        for source in report["cues"]:
            cue = dict(source)
            for key in ("eventT", "fileStart", "fileEnd", "audioStart", "audioEnd"):
                cue[key] = number(cue[key]) + offset
            cues.append(cue)
    if not cues:
        raise ValueError("no joined cues")
    cues.sort(key=lambda cue: cue["audioStart"])
    verify(movie, cues, output)
    print(f"Joined-file audio check passed: {movie}")


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--verify-joined":
        parser = argparse.ArgumentParser(description="Verify an existing joined file with actual part offsets")
        parser.add_argument("--verify-joined", type=Path, required=True)
        parser.add_argument("timeline", type=Path)
        parser.add_argument("output", type=Path)
        args = parser.parse_args()
        args.output.mkdir()
        joined(args.verify_joined, args.timeline, args.output)
        return
    parser = argparse.ArgumentParser(description=__doc__)
    for field in ("take", "script", "index", "output"):
        parser.add_argument(field, type=Path)
    parser.add_argument("--voice", required=True)
    parser.add_argument("--model")
    parser.add_argument("--settings", help="JSON object of the unchanged synthesis settings")
    parser.add_argument("--font", type=Path, help="font file for wait badges if system fonts are unavailable")
    parser.add_argument("--dry", action="store_true")
    parser.add_argument("--strict", action="store_true", help="also fail on explicitly skipped optional cues")
    parser.add_argument("--offset", type=number, default=0.0)
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--gap", type=number, default=0.25)
    parser.add_argument("--keep", type=number, default=1.5, help="seconds retained at each end of a wait")
    args = parser.parse_args()
    if args.fps <= 0 or args.gap < 0 or args.keep < 0:
        parser.error("fps must be positive; gap and keep must be nonnegative")
    args.output.mkdir()
    assemble(args)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError, StopIteration) as error:
        sys.exit(f"assemble: {error}")
