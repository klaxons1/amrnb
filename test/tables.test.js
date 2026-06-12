// Validates generated lookup-table modules: lengths recorded at extraction
// time plus hand-checked spot values from the C sources.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from '../src/common/tables/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('all tables exist with recorded lengths', () => {
  const lengths = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../src/common/tables/lengths.json'), 'utf8'),
  );
  let n = 0;
  for (const [name, info] of Object.entries(lengths)) {
    const tbl = T[name];
    assert.ok(tbl, `missing table ${name}`);
    assert.strictEqual(tbl.length, info.len, `length mismatch for ${name}`);
    n++;
  }
  assert.ok(n >= 60, `expected >= 60 tables, found ${n}`);
});

test('spot values match the C sources (hand-checked)', () => {
  // q_plsf_3_tbl.cpp: dico1_lsf_3 starts "6, 82, -131,"
  assert.deepStrictEqual([...T.dico1_lsf_3.slice(0, 3)], [6, 82, -131]);
  // qgain475_tab.cpp: table_gain_MR475 starts "812, 128, 542, 140,"
  assert.deepStrictEqual([...T.table_gain_MR475.slice(0, 4)], [812, 128, 542, 140]);
  // lsp_tab.cpp: lsp_init_data = {30000, 26000, ..., -26000}
  assert.strictEqual(T.lsp_init_data[0], 30000);
  assert.strictEqual(T.lsp_init_data[9], -26000);
  // inv_sqrt_tbl.cpp: first 32767, last 16384
  assert.strictEqual(T.inv_sqrt_tbl[0], 32767);
  assert.strictEqual(T.inv_sqrt_tbl[48], 16384);
  // gains_tbl.cpp: qua_gain_pitch = {0, 3277, 6556, 8192, ...}
  assert.deepStrictEqual([...T.qua_gain_pitch.slice(0, 4)], [0, 3277, 6556, 8192]);
  // overflow_tbl.cpp is Word32: 0x7fffffff, 0x3fffffff, ...
  assert.ok(T.overflow_tbl instanceof Int32Array);
  assert.strictEqual(T.overflow_tbl[0], 0x7fffffff);
  // bitno_tab.cpp pointer table: bitno[0] is bitno_MR475 (17 params, first 8)
  assert.strictEqual(T.bitno.length, 9);
  assert.strictEqual(T.bitno[0], T.bitno_MR475);
  assert.strictEqual(T.bitno[0][0], 8);
  // dec_input_format_tab.cpp: WmfDecBytesPerFrame = {12, 13, 15, ...}
  assert.deepStrictEqual([...T.WmfDecBytesPerFrame.slice(0, 3)], [12, 13, 15]);
});
