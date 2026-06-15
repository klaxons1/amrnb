// Byte-exact encoder test: encodes test/fixtures/source.pcm with the pure-JS
// encoder and compares the resulting .amr stream against the emscripten-
// reference fixtures (test/fixtures/<mode>[_dtx].amr), which were produced by
// the reference encoder from the same source PCM.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AmrNbEncoder, Mode } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'fixtures');

const source = (() => {
  const buf = fs.readFileSync(path.join(FIXTURES, 'source.pcm'));
  return new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
})();

const MODES = ['mr475', 'mr515', 'mr59', 'mr67', 'mr74', 'mr795', 'mr102', 'mr122'];

function compareEncode(name, modeIdx, dtx) {
  const golden = fs.readFileSync(path.join(FIXTURES, name + '.amr'));
  const enc = new AmrNbEncoder({ dtx });
  const out = Buffer.from(enc.encodeAll(source, modeIdx));
  if (Buffer.compare(out, golden) !== 0) {
    // locate first differing byte for a useful message
    const n = Math.min(out.length, golden.length);
    let at = -1;
    for (let i = 0; i < n; i++) {
      if (out[i] !== golden[i]) { at = i; break; }
    }
    assert.fail(`${name}: lengths ${out.length} vs ${golden.length}, ` +
      `first diff at byte ${at}: got 0x${(out[at] ?? 0).toString(16)}, ` +
      `expected 0x${(golden[at] ?? 0).toString(16)}`);
  }
}

for (let m = 0; m < 8; m++) {
  test(`encode ${MODES[m]} byte-exact`, () => {
    compareEncode(MODES[m], m, false);
  });
}

for (let m = 0; m < 8; m++) {
  test(`encode ${MODES[m]}_dtx byte-exact`, () => {
    compareEncode(`${MODES[m]}_dtx`, m, true);
  });
}

test('round-trip: JS encode -> JS decode runs', async () => {
  const { AmrNbDecoder } = await import('../src/index.js');
  const enc = new AmrNbEncoder();
  const amr = enc.encodeAll(source.subarray(0, 1600), Mode.MR122);
  const pcm = new AmrNbDecoder().decodeAll(amr);
  assert.strictEqual(pcm.length, 1600);
});
