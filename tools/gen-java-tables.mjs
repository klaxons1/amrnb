#!/usr/bin/env node
// Generates java/src/amr/Tables.java from the JS table modules in
// src/common/tables/*.js (same source as src/common/tables/index.js).
//
// All tables live in ONE class. A single <clinit> cannot hold every array
// literal (64 KB JVM method limit), so values are written from a few private
// static loadTablesN() methods, each kept under the limit; <clinit> only
// allocates the arrays and calls the loaders.
//
// Run from the repo root: node tools/gen-java-tables.mjs
import fs from 'node:fs';
import path from 'node:path';

const TABLES_DIR = path.join(import.meta.dirname, '../src/common/tables');
const OUT = path.join(import.meta.dirname, '../java/src/amr/Tables.java');
// Each table is initialized by its own small method (see below).

const files = fs.readdirSync(TABLES_DIR)
  .filter(f => f.endsWith('.js') && f !== 'index.js' && f !== '_all.js')
  .sort();

// Greedy bin packing is no longer needed: each table gets its own tiny
// init method below, so no method ever approaches the 64 KB limit.
const tables = []; // { file, name, type, values[] }
for (const f of files) {
  const src = fs.readFileSync(path.join(TABLES_DIR, f), 'utf8');
  const re = /export const ([A-Za-z0-9_]+) = (Int16Array|Int32Array)\.from\(\[([\s\S]*?)\]\);/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    const type = m[2] === 'Int32Array' ? 'int' : 'short';
    const nums = m[3].split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (!nums.every(s => /^-?\d+$/.test(s))) {
      throw new Error(`${f}: non-numeric entry in ${name}`);
    }
    // JS Int16Array wraps out-of-range values mod 2^16; short literals must fit.
    const values = nums.map(s => {
      let v = parseInt(s, 10);
      if (type === 'short') {
        if (v > 32767) v -= 65536;
        else if (v < -32768) v += 65536;
      }
      if (type === 'short' && (v < -32768 || v > 32767)) {
        throw new Error(`${f}: ${name} value ${v} out of short range`);
      }
      return v;
    });
    tables.push({ file: f, name, type, values });
  }
}

const out = [];
out.push('package amr;');
out.push('');
out.push('/**');
out.push(' * Tables, generated from the JS table modules (which are machine-extracted');
out.push(' * from opencore-amr 0.1.6 common/src/*_tbl.cpp). Do not edit by hand.');
out.push(' * Regenerate with: node tools/gen-java-tables.mjs');
out.push(' */');
out.push('final class Tables {');
out.push('    private Tables() {}');
out.push('');
// One tiny private init method per table: its array literal stays far below
// the 64 KB JVM method limit (a single <clinit> with every literal would
// exceed it), and the source stays compact (plain literal syntax).
for (const t of tables) {
  out.push(`    static final ${t.type}[] ${t.name} = ${t.name}();`);
}
out.push('');
for (const t of tables) {
  out.push(`    private static ${t.type}[] ${t.name}() {`);
  out.push(`        return new ${t.type}[] {`);
  for (let i = 0; i < t.values.length; i += 12) {
    out.push('            ' + t.values.slice(i, i + 12).join(', ') + (i + 12 < t.values.length ? ',' : ''));
  }
  out.push('        };');
  out.push('    }');
  out.push('');
}
out.push('}');
fs.writeFileSync(OUT, out.join('\n') + '\n');
console.log(`wrote ${OUT}: ${tables.length} tables, ${tables.length} init methods`);
