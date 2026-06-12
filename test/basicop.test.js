// Replays the exact input sequence of tools/native/basicop-vectors.c and
// compares every result + overflow flag against the native golden file.
// Generate the golden file with:
//   sh tools/native/build.sh && tools/native/basicop-vectors /tmp/basicop-vectors.bin
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as B from '../src/common/basicop.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NATIVE_DIR = path.join(__dirname, '../tools/native');
const VEC = '/tmp/basicop-vectors.bin';

function ensureVectors() {
  if (fs.existsSync(VEC)) return true;
  try {
    if (!fs.existsSync(path.join(NATIVE_DIR, 'basicop-vectors'))) {
      execSync('sh build.sh', { cwd: NATIVE_DIR, stdio: 'pipe' });
    }
    execSync(`./basicop-vectors ${VEC}`, { cwd: NATIVE_DIR, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// LCG identical to the C generator
let lcgS = 0x12345678 >>> 0;
function nextu() {
  lcgS = (Math.imul(lcgS, 1664525) + 1013904223) >>> 0;
  return lcgS;
}
const r16 = () => ((nextu() >>> 16) << 16) >> 16;
const r32 = () => nextu() | 0;
const rshift = () => (nextu() % 81) - 40;

const E16 = [-32768, -32767, -16384, -1, 0, 1, 2, 0x3fff, 0x4000, 0x7ffe, 0x7fff];
const E32 = [-0x80000000, -0x7fffffff, -0x40000000, -32768, -1, 0, 1, 32767,
  0x3fffffff, 0x40000000, 0x7ffffffe, 0x7fffffff];
const NRAND = 100000;

test('basicop primitives match native opencore-amr outputs', { skip: !ensureVectors() && 'native vector generator unavailable (gcc required)' }, () => {
  const data = fs.readFileSync(VEC);
  const nRec = data.length / 5;
  let rec = 0;
  let nChecked = 0;
  const ovf = new Int32Array(1);

  function check(name, result, args) {
    const expected = data.readInt32LE(rec * 5);
    const expectedOvf = data[rec * 5 + 4];
    rec++;
    nChecked++;
    if ((result | 0) !== expected || (ovf[0] !== 0 ? 1 : 0) !== expectedOvf) {
      assert.fail(
        `${name}(${args.join(', ')}) at record ${rec - 1}: ` +
        `got ${result | 0} ovf=${ovf[0]}, expected ${expected} ovf=${expectedOvf}`,
      );
    }
  }
  function run(name, fn, ...args) {
    ovf[0] = 0;
    check(name, fn(...args, ovf), args);
  }
  function runNoOvf(name, fn, ...args) {
    ovf[0] = 0;
    check(name, fn(...args), args);
  }

  lcgS = 0x12345678 >>> 0;

  // 16x16 -> 16 with overflow
  for (const a of E16) for (const b of E16) {
    run('add_16', B.add_16, a, b);
    run('sub', B.sub, a, b);
    run('mult', B.mult, a, b);
    run('mult_r', B.mult_r, a, b);
  }
  for (let i = 0; i < NRAND; i++) {
    const a = r16(), b = r16();
    run('add_16', B.add_16, a, b);
    run('sub', B.sub, a, b);
    run('mult', B.mult, a, b);
    run('mult_r', B.mult_r, a, b);
  }

  // 16-bit shifts
  for (const a of E16) for (let s = -40; s <= 40; s++) {
    run('shl', B.shl, a, s);
    run('shr', B.shr, a, s);
    run('shr_r', B.shr_r, a, s);
  }
  for (let i = 0; i < NRAND; i++) {
    const a = r16(), s = rshift();
    run('shl', B.shl, a, s);
    run('shr', B.shr, a, s);
    run('shr_r', B.shr_r, a, s);
  }

  // unary 16-bit, exhaustive
  for (let a = -32768; a <= 32767; a++) {
    runNoOvf('negate', B.negate, a);
    runNoOvf('abs_s', B.abs_s, a);
    runNoOvf('norm_s', B.norm_s, a);
  }

  // div_s
  for (let i = 0; i < NRAND; i++) {
    const b = (nextu() % 32767) + 1;
    const a = nextu() % (b + 1);
    runNoOvf('div_s', B.div_s, a, b);
  }

  // 32 -> x unary
  for (const a of E32) {
    runNoOvf('extract_h', B.extract_h, a);
    runNoOvf('extract_l', B.extract_l, a);
    runNoOvf('norm_l', B.norm_l, a);
    run('pv_round', B.pv_round, a);
  }
  for (let i = 0; i < NRAND; i++) {
    const a = r32();
    runNoOvf('extract_h', B.extract_h, a);
    runNoOvf('extract_l', B.extract_l, a);
    runNoOvf('norm_l', B.norm_l, a);
    run('pv_round', B.pv_round, a);
  }
  for (const a of E16) {
    runNoOvf('L_deposit_h', B.L_deposit_h, a);
    runNoOvf('L_deposit_l', B.L_deposit_l, a);
  }

  // L_add / L_sub
  for (const a of E32) for (const b of E32) {
    run('L_add', B.L_add, a, b);
    run('L_sub', B.L_sub, a, b);
  }
  for (let i = 0; i < NRAND; i++) {
    const a = r32(), b = r32();
    run('L_add', B.L_add, a, b);
    run('L_sub', B.L_sub, a, b);
  }

  // L_mult / L_mac / L_msu
  for (const a of E16) for (const b of E16) {
    run('L_mult', B.L_mult, a, b);
    run('L_mac', B.L_mac, 0x7ffffff0, a, b);
    run('L_mac', B.L_mac, -0x7ffffff1, a, b);
    run('L_msu', B.L_msu, 0x7ffffff0, a, b);
    run('L_msu', B.L_msu, -0x7ffffff1, a, b);
  }
  for (let i = 0; i < NRAND; i++) {
    const acc = r32(), a = r16(), b = r16();
    run('L_mult', B.L_mult, a, b);
    run('L_mac', B.L_mac, acc, a, b);
    run('L_msu', B.L_msu, acc, a, b);
  }

  // 32-bit shifts
  for (const a of E32) for (let s = -40; s <= 40; s++) {
    run('L_shl', B.L_shl, a, s);
    run('L_shr', B.L_shr, a, s);
    run('L_shr_r', B.L_shr_r, a, s);
  }
  for (let i = 0; i < NRAND; i++) {
    const a = r32(), s = rshift();
    run('L_shl', B.L_shl, a, s);
    run('L_shr', B.L_shr, a, s);
    run('L_shr_r', B.L_shr_r, a, s);
  }

  // Mpy_32 / Mpy_32_16 / Mac_32 / Mac_32_16
  for (let i = 0; i < NRAND; i++) {
    const h1 = r16(), l1 = r16(), h2 = r16(), l2 = r16();
    const acc = r32();
    run('Mpy_32', B.Mpy_32, h1, l1, h2, l2);
    run('Mpy_32_16', B.Mpy_32_16, h1, l1, h2);
    run('Mac_32', B.Mac_32, acc, h1, l1, h2, l2);
    run('Mac_32_16', B.Mac_32_16, acc, h1, l1, h2);
  }

  // amrnb_fxp_mac/msu_16_by_16bb
  for (let i = 0; i < NRAND; i++) {
    const a = r16(), b = r16(), c = r32();
    runNoOvf('fxp_mac', B.amrnb_fxp_mac_16_by_16bb, a, b, c);
    runNoOvf('fxp_msu', B.amrnb_fxp_msu_16_by_16bb, a, b, c);
  }

  assert.strictEqual(rec, nRec, `consumed ${rec} records, file has ${nRec}`);
  console.log(`  basicop: ${nChecked} cases checked`);
});
