#!/usr/bin/env node
// Generates java/src/javax/microedition/media/decoders/Tables.java from the
// JS table modules in src/common/tables/*.js (same source as the JS
// src/common/tables/index.js).
//
// All tables live in ONE package-private class. A single <clinit> cannot
// hold every array literal (64 KB JVM method limit), so values are written
// from small per-table init methods, each kept far below the limit; <clinit>
// only allocates the arrays and calls the loaders.
//
// Run from the repo root: node tools/gen-java-tables.mjs
import fs from 'node:fs';
import path from 'node:path';

const TABLES_DIR = path.join(import.meta.dirname, '../src/common/tables');
const OUT = path.join(import.meta.dirname, '../java/src/javax/microedition/media/decoders/Tables.java');

const BANNER = [
  '/*',
  '\tThis file is part of the amrnb project (https://github.com/klaxons1/amrnb):',
  '\ta pure Java port of the AMR-NB (narrowband) speech codec.',
  '',
  '\tLicensed under the Apache License, Version 2.0 (the "License");',
  '\tyou may not use this file except in compliance with the License.',
  '\tYou may obtain a copy of the License at',
  '',
  '\t    http://www.apache.org/licenses/LICENSE-2.0',
  '',
  '\tUnless required by applicable law or agreed to in writing, software',
  '\tdistributed under the License is distributed on an "AS IS" BASIS,',
  '\tWITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.',
  '\tSee the License for the specific language governing permissions and',
  '\tlimitations under the License.',
  '',
  '\tThis file is a derivative work of the opencore-amr 0.1.6 reference codec',
  '\t(https://sourceforge.net/projects/opencore-amr/), original code',
  '\t(C) 1998-2010 PacketVideo; portions derived from 3GPP TS 26.073',
  '\t(C) 2004 3GPP Organizational Partners.',
  '*/',
];

const files = fs.readdirSync(TABLES_DIR)
  .filter(f => f.endsWith('.js') && f !== 'index.js' && f !== '_all.js')
  .sort();

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
out.push(...BANNER);
out.push('');
out.push('package javax.microedition.media.decoders;');
out.push('');
out.push('/*');
out.push(' * Tables, generated from the JS table modules in src/common/tables/*.js');
out.push(' * (which are machine-extracted from opencore-amr 0.1.6 common/src/*_tbl.cpp).');
out.push(' * Do not edit by hand - regenerate with: node tools/gen-java-tables.mjs');
out.push(' */');
out.push('final class Tables');
out.push('{');
out.push('\tprivate Tables() {}');
out.push('');
// One tiny private init method per table: its array literal stays far below
// the 64 KB JVM method limit (a single <clinit> with every literal would
// exceed it), and the source stays compact (plain literal syntax).
for (const t of tables) {
  out.push(`\tstatic final ${t.type}[] ${t.name} = ${t.name}();`);
}
out.push('');
for (const t of tables) {
  out.push(`\tprivate static ${t.type}[] ${t.name}()`);
  out.push('\t{');
  out.push(`\t\treturn new ${t.type}[]`);
  out.push('\t\t{');
  for (let i = 0; i < t.values.length; i += 12) {
    out.push('\t\t\t' + t.values.slice(i, i + 12).join(', ') + (i + 12 < t.values.length ? ',' : ''));
  }
  out.push('\t\t};');
  out.push('\t}');
  out.push('');
}
out.push('}');
fs.writeFileSync(OUT, out.join('\n') + '\n');
console.log(`wrote ${OUT}: ${tables.length} tables, ${tables.length} init methods`);
