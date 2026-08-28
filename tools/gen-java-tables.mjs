#!/usr/bin/env node
// Generates java/src/amr/Tbls.java from the JS table modules in
// src/common/tables/*.js (same source as src/common/tables/index.js).
// Run from the repo root: node tools/gen-java-tables.mjs
import fs from 'node:fs';
import path from 'node:path';

const TABLES_DIR = path.join(import.meta.dirname, '../src/common/tables');
const OUT = path.join(import.meta.dirname, '../java/src/amr/Tbls.java');

const files = fs.readdirSync(TABLES_DIR)
  .filter(f => f.endsWith('.js') && f !== 'index.js' && f !== '_all.js')
  .sort();

const out = [];
out.push('package amr;');
out.push('');
out.push('/**');
out.push(' * Tables, generated from the JS table modules (which are machine-extracted');
out.push(' * from opencore-amr 0.1.6 common/src/*_tbl.cpp). Do not edit by hand.');
out.push(' * Regenerate with: node tools/gen-java-tables.mjs');
out.push(' */');
out.push('public final class Tbls {');
out.push('    private Tbls() {}');
out.push('');

for (const f of files) {
  const src = fs.readFileSync(path.join(TABLES_DIR, f), 'utf8');
  const re = /export const ([A-Za-z0-9_]+) = (Int16Array|Int32Array)\.from\(\[([\s\S]*?)\]\);/g;
  let m;
  let any = false;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    const type = m[2] === 'Int32Array' ? 'int' : 'short';
    const body = m[3];
    const nums = body.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const n = nums.length;
    if (!nums.every(s => /^-?\d+$/.test(s))) {
      throw new Error(`${f}: non-numeric entry in ${name}`);
    }
    // JS Int16Array wraps out-of-range values mod 2^16; short literals must fit.
    const wrapped = nums.map(s => {
      let v = parseInt(s, 10);
      if (type === 'short') {
        if (v > 32767) v -= 65536;
        else if (v < -32768) v += 65536;
      }
      if (type === 'short' && (v < -32768 || v > 32767)) {
        throw new Error(`${f}: ${name} value ${v} out of short range`);
      }
      return String(v);
    });
    out.push(`    /** ${f} */`);
    out.push(`    public static final ${type}[] ${name} = {`);
    for (let i = 0; i < n; i += 12) {
      out.push('        ' + wrapped.slice(i, i + 12).join(', ') + (i + 12 < n ? ',' : ''));
    }
    out.push('    };');
    out.push('');
    any = true;
  }
  if (!any) {
    console.warn(`warning: no tables found in ${f}`);
  }
}

out.push('}');
fs.writeFileSync(OUT, out.join('\n') + '\n');
console.log(`wrote ${OUT}`);
