// Extracts const tables from opencore-amr *_tab.cpp / *_tbl.cpp sources and
// generates src/common/tables/*.js modules plus an index.js that mirrors the
// CommonAmrTbls aggregation of get_const_tbls.cpp.
// Usage: node tools/extract-tables.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OC = path.resolve(__dirname, '../../opencore-amr-0.1.6');
const AMR = path.join(OC, 'opencore/codecs_v2/audio/gsm_amr/amr_nb');
const OUT = path.resolve(__dirname, '../src/common/tables');

const FILES = [
  // common tables
  ...[
    'bitno_tab', 'bitreorder_tab', 'c2_9pf_tab', 'gains_tbl', 'gray_tbl',
    'grid_tbl', 'inv_sqrt_tbl', 'log2_tbl', 'lsp_lsf_tbl', 'lsp_tab',
    'overflow_tbl', 'ph_disp_tab', 'pow2_tbl', 'q_plsf_3_tbl', 'q_plsf_5_tbl',
    'qua_gain_tbl', 'sqrt_l_tbl', 'window_tab',
  ].map((f) => path.join(AMR, 'common/src', f + '.cpp')),
  // decoder tables
  ...['dec_input_format_tab', 'qgain475_tab'].map((f) =>
    path.join(AMR, 'dec/src', f + '.cpp')),
  // encoder tables
  ...['corrwght_tab', 'inter_36_tab', 'lag_wind_tab', 'enc_output_format_tab'].map((f) =>
    path.join(AMR, 'enc/src', f + '.cpp')),
];

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/** Collects `#define NAME <number or simple expr of known names>` */
function parseDefines(src) {
  const defines = new Map();
  const re = /^[ \t]*#define[ \t]+([A-Za-z_]\w*)[ \t]+([^\n/]+)/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    const [, name, rawExpr] = m;
    const expr = rawExpr.trim();
    // resolve simple arithmetic over numbers and already-known defines
    const resolved = expr.replace(/[A-Za-z_]\w*/g, (id) =>
      defines.has(id) ? String(defines.get(id)) : id);
    if (/^[\d\sxXa-fA-F+\-*/()]+$/.test(resolved)) {
      try {
        // eslint-disable-next-line no-new-func
        const v = Function(`"use strict"; return (${resolved});`)();
        if (Number.isFinite(v)) defines.set(name, v);
      } catch {
        /* non-numeric define, ignore */
      }
    }
  }
  return defines;
}

/**
 * Parses `const Word16 name[...] = { ... };` and
 * `const Word16 * const name[...] = { id, id, ... };` declarations.
 */
function parseTables(src, defines) {
  const tables = [];
  const re = /(?:static\s+)?const\s+(Word16|Word32|Flag)\s*(\*\s*const|\*)?\s*([A-Za-z_]\w*)\s*\[[^\]]*\]\s*(\[[^\]]*\])?\s*=\s*\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const [, ctype, ptr, name, dim2] = m;
    // find matching closing brace
    let depth = 1;
    let i = re.lastIndex;
    while (depth > 0 && i < src.length) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    const body = src.slice(re.lastIndex, i - 1);
    re.lastIndex = i;

    if (ptr) {
      const refs = body.match(/[A-Za-z_]\w*/g) || [];
      tables.push({ name, kind: 'ptr', refs });
    } else {
      // tokens may be numeric literals or macro identifiers (e.g. NUMBIT_MR475)
      const tokens = (body.match(/-?\s*0x[0-9a-fA-F]+[LlUu]*|[A-Za-z_]\w*|-?\s*\d+[LlUu]*/g) || [])
        .filter((t) => !/^(Word16|Word32|Word8|Flag|UWord8|UWord16|UWord32)$/.test(t.trim()));
      const values = tokens.map((t) => {
        const tok = t.replace(/\s+/g, '').replace(/[LlUu]+$/, '');
        if (/^[A-Za-z_]/.test(tok)) {
          if (!defines.has(tok)) {
            throw new Error(`unresolved macro '${tok}' in table ${name}`);
          }
          return defines.get(tok);
        }
        return parseInt(tok); /* auto radix handles 0x-prefixed hex */
      });
      tables.push({ name, kind: ctype, values, is2D: !!dim2 });
    }
  }
  return tables;
}

fs.mkdirSync(OUT, { recursive: true });
const allTables = new Map(); // name -> {file, kind}
const generated = [];

/* Defines may live in companion headers (e.g. bitno_tab.h for bitno_tab.cpp) */
function collectDefines(cppFile) {
  const sources = [cppFile];
  const base = path.basename(cppFile, '.cpp');
  for (const dir of [path.join(AMR, 'common/include'),
    path.dirname(cppFile)]) {
    const h = path.join(dir, base + '.h');
    if (fs.existsSync(h)) sources.push(h);
  }
  const defines = new Map();
  for (const f of sources) {
    for (const [k, v] of parseDefines(stripComments(fs.readFileSync(f, 'utf8')))) {
      if (!defines.has(k)) defines.set(k, v);
    }
  }
  return defines;
}

for (const file of FILES) {
  const base = path.basename(file, '.cpp');
  const raw = fs.readFileSync(file, 'utf8');
  const src = stripComments(raw);
  const defines = collectDefines(file);
  const tables = parseTables(src, defines);
  if (tables.length === 0) {
    console.error(`WARNING: no tables found in ${file}`);
    continue;
  }
  let js = `// GENERATED from opencore-amr-0.1.6 .../amr_nb/${file.includes('/dec/') ? 'dec' : 'common'}/src/${base}.cpp — do not edit.\n// Regenerate with: node tools/extract-tables.mjs\n`;
  const ptrTables = [];
  for (const t of tables) {
    if (t.kind === 'ptr') {
      ptrTables.push(t); // emit after the arrays they reference
      continue;
    }
    const ArrType = t.kind === 'Word32' ? 'Int32Array' : 'Int16Array';
    js += `\nexport const ${t.name} = ${ArrType}.from([\n  ${t.values.map((v) => String(v)).join(', ').replace(/(.{96}[^,]*, )/g, '$1\n  ')}\n]);\n`;
    allTables.set(t.name, { file: base, len: t.values.length });
    console.log(`${base}: ${t.name}[${t.values.length}] (${t.kind})`);
  }
  for (const t of ptrTables) {
    js += `\nexport const ${t.name} = [${t.refs.join(', ')}];\n`;
    allTables.set(t.name, { file: base, len: t.refs.length, ptr: true });
    console.log(`${base}: ${t.name}[${t.refs.length}] (ptr table)`);
  }
  fs.writeFileSync(path.join(OUT, base + '.js'), js);
  generated.push(base);
}

// index.js: re-export everything + CommonAmrTbls-shaped aggregate
let idx = `// GENERATED — aggregates all tables; mirrors get_const_tbls.cpp CommonAmrTbls.\n// Regenerate with: node tools/extract-tables.mjs\n`;
for (const base of generated) {
  idx += `export * from './${base}.js';\n`;
}
idx += `\nimport * as _t from './_all.js';\nexport { _t };\n`;
fs.writeFileSync(path.join(OUT, 'index.js'), idx);

// _all.js: single namespace for the aggregate import
let all = generated.map((b) => `export * from './${b}.js';`).join('\n') + '\n';
fs.writeFileSync(path.join(OUT, '_all.js'), all);

// lengths manifest for the test
const manifest = {};
for (const [name, info] of allTables) manifest[name] = info;
fs.writeFileSync(path.join(OUT, 'lengths.json'), JSON.stringify(manifest, null, 1) + '\n');

console.log(`\n${allTables.size} tables from ${generated.length} files -> src/common/tables/`);
