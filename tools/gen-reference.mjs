// Generates golden fixtures for the pure-JS AMR-NB port:
//   test/fixtures/<name>.amr        IETF storage format (with "#!AMR\n" magic)
//   test/fixtures/<name>.pcm        reference decode, 160 x Int16LE per frame
//   test/fixtures/<name>_bfi<N>.pcm reference decode with bfi=1 every N-th frame
//   test/fixtures/source.pcm        the deterministic input PCM (Int16LE, 8 kHz)
// All input audio is synthesized deterministically so fixtures are reproducible.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadReference, makeRefDecoder, makeRefEncoder } from './reference.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../test/fixtures');

const MAGIC = '#!AMR\n';
const MODES = ['mr475', 'mr515', 'mr59', 'mr67', 'mr74', 'mr795', 'mr102', 'mr122'];

// --- deterministic source signal: 6 s @ 8 kHz ----------------------------
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeSource() {
  const sr = 8000;
  const n = 6 * sr;
  const pcm = new Int16Array(n);
  const rnd = lcg(12345);
  const clamp = (v) => Math.max(-32768, Math.min(32767, Math.round(v)));
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let v = 0;
    if (t < 1.5) {
      // voiced-speech-like: pitch-modulated sawtooth with formant-ish AM
      const f0 = 110 + 30 * Math.sin(2 * Math.PI * 2.5 * t);
      phase += f0 / sr;
      const saw = 2 * (phase - Math.floor(phase + 0.5));
      const am = 0.55 + 0.45 * Math.sin(2 * Math.PI * 3.1 * t + 1);
      v = 9000 * saw * am + 600 * (rnd() - 0.5);
    } else if (t < 2.5) {
      // near-silence with tiny noise floor -> lets VAD/DTX engage
      v = 12 * (rnd() - 0.5);
    } else if (t < 3.5) {
      // sine sweep 200 -> 1500 Hz
      const u = t - 2.5;
      const f = 200 + 1300 * u;
      phase += f / sr;
      v = 7000 * Math.sin(2 * Math.PI * phase);
    } else if (t < 4.5) {
      // noise burst
      v = 6000 * (rnd() - 0.5);
    } else {
      // exact digital silence
      v = 0;
    }
    pcm[i] = clamp(v);
  }
  return pcm;
}

// --------------------------------------------------------------------------
function frameLengthFromToc(toc) {
  const BLOCK_SIZE = [13, 14, 16, 18, 20, 21, 27, 32, 6, 1, 1, 1, 1, 1, 1, 1];
  return BLOCK_SIZE[(toc >> 3) & 0x0f];
}

export function* iterAmrFrames(buf) {
  let off = 0;
  if (buf.length >= 6 && Buffer.from(buf.subarray(0, 6)).toString('latin1') === MAGIC) {
    off = 6;
  }
  while (off < buf.length) {
    const len = frameLengthFromToc(buf[off]);
    yield buf.subarray(off, off + len);
    off += len;
  }
}

async function main() {
  fs.mkdirSync(FIXTURES, { recursive: true });
  const AMRNB = await loadReference();
  const source = makeSource();
  fs.writeFileSync(
    path.join(FIXTURES, 'source.pcm'),
    Buffer.from(source.buffer, source.byteOffset, source.byteLength),
  );
  const nFrames = Math.floor(source.length / 160);

  const manifest = [];
  for (const dtx of [false, true]) {
    for (let mode = 0; mode < 8; mode++) {
      const name = MODES[mode] + (dtx ? '_dtx' : '');
      const enc = makeRefEncoder(AMRNB, dtx);
      const chunks = [Buffer.from(MAGIC, 'latin1')];
      for (let f = 0; f < nFrames; f++) {
        const frame = enc.encodeFrame(source.subarray(f * 160, f * 160 + 160), mode);
        chunks.push(Buffer.from(frame));
      }
      enc.destroy();
      const amr = Buffer.concat(chunks);
      fs.writeFileSync(path.join(FIXTURES, name + '.amr'), amr);

      const dec = makeRefDecoder(AMRNB);
      const pcmOut = Buffer.alloc(nFrames * 160 * 2);
      let f = 0;
      for (const frame of iterAmrFrames(amr)) {
        const pcm = dec.decodeFrame(frame, 0);
        Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).copy(pcmOut, f * 320);
        f++;
      }
      dec.destroy();
      fs.writeFileSync(path.join(FIXTURES, name + '.pcm'), pcmOut);
      manifest.push({ name, mode, dtx, frames: f, amrBytes: amr.length });
      console.log(`${name}: ${f} frames, ${amr.length} bytes`);
    }
  }

  // bfi-injected goldens (every 7th frame marked bad) for two modes
  for (const name of ['mr475', 'mr122']) {
    const amr = fs.readFileSync(path.join(FIXTURES, name + '.amr'));
    const dec = makeRefDecoder(AMRNB);
    const frames = [...iterAmrFrames(amr)];
    const pcmOut = Buffer.alloc(frames.length * 320);
    frames.forEach((frame, f) => {
      const bfi = f > 0 && f % 7 === 0 ? 1 : 0;
      const pcm = dec.decodeFrame(frame, bfi);
      Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).copy(pcmOut, f * 320);
    });
    dec.destroy();
    fs.writeFileSync(path.join(FIXTURES, `${name}_bfi7.pcm`), pcmOut);
    manifest.push({ name: `${name}_bfi7`, base: name, bfiEvery: 7, frames: frames.length });
    console.log(`${name}_bfi7: ${frames.length} frames`);
  }

  fs.writeFileSync(
    path.join(FIXTURES, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  console.log('done.');
}

main();
