# QA: prove it before you ship it

Run all of this on every film. The checks are cheap compared with a client spotting a one-frame pop.

## The seven-step process
1. **List facts vs choices.** Real logos and screens come from files.
2. **Write beats with timestamps** saying what must be visible.
3. **Make a stills sheet before the full render:** every beat, plus 3 frames around every transition.
4. **Render twice and pixel-diff** to prove determinism.
5. **Scan the frame-diff curve** for single-frame pops (spikes 3× their neighbours).
6. **Probe instruments:** brand hex, audio onset vs event (ms), −14 LUFS, video/audio duration match.
7. **Run 3 critique rounds**.
## Commands

```bash
# 0. Container facts: codec, size, fps, duration (video and audio durations must match ±1 frame)
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,duration -of compact out/film.mp4

# 1. Loudness: integrated −14 LUFS (±1), true peak ≤ −1 dBTP
ffmpeg -i out/film.mp4 -af loudnorm=I=-14:TP=-1:LRA=11:print_format=summary -f null - 2>&1 | tail -12
#    normalise if needed (two-pass is better; one pass shown)
ffmpeg -i out/raw.mp4 -c:v copy -af loudnorm=I=-14:TP=-1:LRA=11 -c:a aac -b:a 192k out/film.mp4

# 2. Contact sheet FROM THE FINAL MP4 (not from stills): one tile per 0.5 s
ffmpeg -i out/film.mp4 -vf "fps=2,scale=480:-1,tile=6x5:padding=4:color=black" -frames:v 1 out/contact.png

# 3. Frames around each transition (here at 3.2 s): 3 before, 3 after
ffmpeg -ss 3.1 -i out/film.mp4 -frames:v 7 out/tx_%02d.png

# 4. Determinism: render the same frame twice and diff (must be 0)
npx remotion still src/index.ts MyComp out/qa_a.png --frame=90
npx remotion still src/index.ts MyComp out/qa_b.png --frame=90
python3 - <<'PY'
from PIL import Image, ImageChops
d = ImageChops.difference(Image.open('out/qa_a.png').convert('RGB'), Image.open('out/qa_b.png').convert('RGB'))
print('identical' if d.getbbox() is None else f'DIFF at {d.getbbox()}')
PY

# 5. Single-frame pops: per-frame mean diff; flag spikes > 3× both neighbours
ffmpeg -i out/film.mp4 -vf "signalstats,metadata=print:key=lavfi.signalstats.YDIF" -f null - 2>&1 \
  | grep -o 'YDIF=[0-9.]*' | cut -d= -f2 > out/ydif.txt
python3 -c "
v=[float(x) for x in open('out/ydif.txt')]
print([i for i in range(1,len(v)-1) if v[i]>3*max(v[i-1],v[i+1],0.5)])"

# 6. Audio onset vs visual event (ms): find the onsets, then compare them with the hit frames in the shot list
ffmpeg -i out/film.mp4 -af silencedetect=noise=-30dB:d=0.05 -f null - 2>&1 | grep silence_end
```

## Self-critique (three rounds, written down)
After each render, write answers to these questions before touching the code:
1. **Poster test.** Take the contact sheet. Is every tile a composed frame? Mark any that are mush (mid-fade, half-blurred, empty).
2. **Read test.** Can every line be read at 1× speed? Count the frames each line is fully legible.
3. **Beat test.** Do the cuts land on (or 2 f before) the beat? Is any device used twice in a row?
4. **Budget test.** Count overshoots (≤ 2, none on type), flashes (≤ 2, ≤ 85 %), and accents (1).
5. **Style test.** Does each frame still belong to the chosen NxrStyle? Flag any borrowed palette or font.
6. **Brand test.** Are logos, colours and claims real and exact (hex check with a colour picker on a still)?

Fix the worst three issues, re-render, and repeat. Stop after round 3 unless something is still broken.

## Release checklist
- [ ] H.264 yuv420p (`-pix_fmt yuv420p`) for social, AAC 48 kHz, `+faststart`.
- [ ] The intended aspect ratio (16:9 1920×1080, 9:16 1080×1920, 1:1 1080×1080), and safe areas for captions on 9:16.
- [ ] Frame 0 is a poster (it's the thumbnail on most platforms).
- [ ] Loops: the last frame equals the first (diff them).
- [ ] −14 LUFS integrated, ≤ −1 dBTP.
- [ ] The contact sheet was viewed by a human or agent, not just generated.
