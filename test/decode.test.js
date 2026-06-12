// Bit-exact integration test: decodes the fixture .amr files with the pure-JS
// decoder and compares every frame against the emscripten-reference golden
// PCM (test/fixtures/*.pcm).
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Decoder_Interface_init, Decoder_Interface_Decode, FRAME_SIZE, MAGIC,
} from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'fixtures');

function* iterFrames(buf) {
  let off = 0;
  if (buf.length >= 6 && buf.subarray(0, 6).toString('latin1') === MAGIC) {
    off = 6;
  }
  while (off < buf.length) {
    const size = FRAME_SIZE[(buf[off] >> 3) & 0x0f];
    yield buf.subarray(off, off + size);
    off += size;
  }
}

function compareFile(name, bfiEvery = 0, goldenName = name) {
  const amr = fs.readFileSync(path.join(FIXTURES, name + '.amr'));
  const golden = fs.readFileSync(path.join(FIXTURES, goldenName + '.pcm'));
  const state = Decoder_Interface_init();
  const pcm = new Int16Array(160);
  let frameNo = 0;
  for (const frame of iterFrames(amr)) {
    const bfi = bfiEvery > 0 && frameNo > 0 && frameNo % bfiEvery === 0 ? 1 : 0;
    Decoder_Interface_Decode(state, frame, pcm, bfi);
    for (let i = 0; i < 160; i++) {
      const expected = golden.readInt16LE(frameNo * 320 + i * 2);
      if (pcm[i] !== expected) {
        assert.fail(`${goldenName}: frame ${frameNo} sample ${i}: ` +
          `got ${pcm[i]}, expected ${expected}`);
      }
    }
    frameNo++;
  }
  assert.strictEqual(frameNo * 320, golden.length, 'frame count mismatch');
  return frameNo;
}

const MODES = ['mr475', 'mr515', 'mr59', 'mr67', 'mr74', 'mr795', 'mr102', 'mr122'];

for (const m of MODES) {
  test(`decode ${m} bit-exact`, () => {
    const n = compareFile(m);
    assert.ok(n > 0);
  });
}

for (const m of MODES) {
  test(`decode ${m}_dtx bit-exact (DTX/SID)`, () => {
    const n = compareFile(`${m}_dtx`);
    assert.ok(n > 0);
  });
}

test('decode mr475 with bfi injection bit-exact', () => {
  compareFile('mr475', 7, 'mr475_bfi7');
});

test('decode mr122 with bfi injection bit-exact', () => {
  compareFile('mr122', 7, 'mr122_bfi7');
});
