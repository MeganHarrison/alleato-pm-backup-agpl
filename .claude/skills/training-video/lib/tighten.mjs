// Auto-tighten a screen recording: detect static "dwell" segments (loading
// spinners, long holds) and cap each to maxDwell seconds, keeping all cursor
// motion at full speed. Removes dead time without a uniform speed-up (so
// captions stay readable).
//
// Usage: node lib/tighten.mjs <in.mp4> <out.mp4> [maxDwell=1.3] [minFreeze=1.2]
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import fs from 'node:fs';

const ffmpegCommand = ffmpegPath || 'ffmpeg';
const ffprobeCommand = ffprobeStatic.path || 'ffprobe';

const [inFile, outFile, maxDwellArg, minFreezeArg] = process.argv.slice(2);
if (!inFile || !outFile) { console.error('usage: node lib/tighten.mjs <in.mp4> <out.mp4> [maxDwell] [minFreeze]'); process.exit(1); }
const maxDwell = parseFloat(maxDwellArg || '1.3');
const minFreeze = parseFloat(minFreezeArg || '1.2');

const dur = parseFloat(spawnSync(ffprobeCommand, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nk=1:nw=1', inFile]).stdout.toString().trim());

// 1) detect frozen (static) segments
const det = spawnSync(ffmpegCommand, ['-i', inFile, '-vf', `freezedetect=n=-45dB:d=${minFreeze}`, '-map', '0:v', '-f', 'null', '-'], { encoding: 'utf8' });
const log = det.stderr || '';
const freezes = [];
let cur = null;
for (const line of log.split('\n')) {
  let m = line.match(/freeze_start:\s*([\d.]+)/); if (m) { cur = { start: parseFloat(m[1]) }; continue; }
  m = line.match(/freeze_end:\s*([\d.]+)/); if (m && cur) { cur.end = parseFloat(m[1]); freezes.push(cur); cur = null; }
}
if (cur) { cur.end = dur; freezes.push(cur); }

// 2) drop the portion of each freeze beyond maxDwell
const drops = freezes.filter((f) => f.end - f.start > maxDwell).map((f) => [f.start + maxDwell, f.end]);
// merge overlapping drops
drops.sort((a, b) => a[0] - b[0]);
const merged = [];
for (const d of drops) { const last = merged[merged.length - 1]; if (last && d[0] <= last[1] + 0.05) last[1] = Math.max(last[1], d[1]); else merged.push([...d]); }

// 3) keep = complement of drops
const keeps = [];
let t = 0;
for (const [ds, de] of merged) { if (ds > t) keeps.push([t, ds]); t = Math.max(t, de); }
if (t < dur) keeps.push([t, dur]);

const keptSecs = keeps.reduce((s, [a, b]) => s + (b - a), 0);
console.log(`freezes: ${freezes.length}, dropping ${(dur - keptSecs).toFixed(1)}s, keeping ${keptSecs.toFixed(1)}s of ${dur.toFixed(1)}s`);

// 4) build select filter and encode
const sel = keeps.map(([a, b]) => `between(t,${a.toFixed(3)},${b.toFixed(3)})`).join('+');
const vf = `select='${sel}',setpts=N/FRAME_RATE/TB`;
const r = spawnSync(ffmpegCommand, ['-y', '-i', inFile, '-vf', vf, '-an', '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', '30', outFile], { stdio: 'inherit' });
if (r.status !== 0) { console.error('encode failed'); process.exit(1); }
console.log(`\n✅ ${outFile} (${(fs.statSync(outFile).size / 1024 | 0)} KB)`);
