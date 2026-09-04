// Wall-clock benchmark for the JS decoder, mirrors amr.Main bench (java/).
// Usage: node bench-js.mjs <in.amr> [<in.amr> ...]
import fs from 'node:fs';
import { AmrNbDecoder } from '../src/index.js';

const files = process.argv.slice(2);
if (files.length < 1) {
  console.error('usage: node bench-js.mjs <in.amr> [<in.amr> ...]');
  process.exit(2);
}

const datas = files.map(f => fs.readFileSync(f));
const FRAME_SIZE = [13, 14, 16, 18, 20, 21, 27, 32, 6, 1, 1, 1, 1, 1, 1, 1];
let totalFrames = 0;
for (const d of datas) {
  let off = d.length >= 6 && String.fromCharCode(...d.subarray(0, 6)) === '#!AMR\n' ? 6 : 0;
  while (off + 1 <= d.length) {
    const size = FRAME_SIZE[(d[off] >> 3) & 0x0f];
    if (off + size > d.length) break;
    off += size;
    totalFrames++;
  }
}
const audioSec = totalFrames * 0.02;

const decodeAll = () => { for (const d of datas) new AmrNbDecoder().decodeAll(d); };

decodeAll(); // pass 1: warm up
let best = Infinity;
for (let pass = 0; pass < 3; pass++) {
  const t0 = process.hrtime.bigint();
  decodeAll();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (ms < best) best = ms;
}

const rt = audioSec / (best / 1000);
const summary = `frames=${totalFrames} audio=${audioSec.toFixed(0)}s elapsed=${best.toFixed(1)}ms realtime=${rt.toFixed(0)}x ms/frame=${(best / totalFrames).toFixed(3)} samples/s=${(totalFrames * 160 / (best / 1000)).toFixed(0)}`;
console.log(`JS bench: ${summary}`);
console.log(`::warning title=amr-js-bench::${summary}`);
