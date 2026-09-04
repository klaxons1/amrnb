#!/usr/bin/env node
// Minifies the Java decoder sources: strips comments and blank lines,
// collapses whitespace, and renames every identifier (except Java keywords,
// the JVM/library API surface, and the public API names) to a short alias.
// One shared alias map covers all files, so cross-file references stay
// consistent. Runtime semantics are unchanged — byte-exactness is verified
// by java/test.sh on CI.
//
// Usage (from repo root): node tools/minify-java.mjs
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(import.meta.dirname, '../java/src');
// All *.java files under java/src (the amr CLI package and the
// javax.microedition.media.decoders library package).
function findJavaFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...findJavaFiles(p));
    else if (e.name.endsWith('.java')) out.push(p);
  }
  return out;
}
const FILES = findJavaFiles(DIR).map(f => path.relative(DIR, f));

const KEYWORDS = new Set(
  ('abstract assert boolean break byte case catch char class const continue default do double '
  + 'else enum extends final finally float for goto if implements import instanceof int '
  + 'interface long native new package private protected public return short static '
  + 'strictfp super switch synchronized this throw throws transient try void volatile '
  + 'while true false null').split(' '));

// Identifiers that must keep their names: JVM entry point, library members,
// package names, and the public API used from outside (Main, test.sh, users).
const KEEP = new Set([
  ...KEYWORDS,
  'main', 'String', 'System', 'out', 'err', 'println', 'printf', 'exit',
  'File', 'FileInputStream', 'FileOutputStream', 'IOException',
  'read', 'write', 'close', 'length', 'isDirectory', 'getName', 'listFiles',
  'mkdirs', 'endsWith', 'substring', 'arraycopy', 'nanoTime', 'equals',
  'Long', 'Integer', 'MAX_VALUE', 'MIN_VALUE', 'Double', 'isInfinite',
  'java', 'io', 'amr', 'Main', 'AMRDecoder', 'decodeAMR', 'decode', 'decodeAll', 'reset',
  'javax', 'microedition', 'media', 'decoders',
]);

const OPS3 = ['<<=', '>>='];
const OPS2 = ['++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=',
  '<<', '>>', '<=', '>=', '==', '!=', '&&', '||'];

function tokenize(src) {
  const tokens = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === '\'') {
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === c) break;
        j++;
      }
      tokens.push({ t: 'str', w: src.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
      tokens.push({ t: 'id', w: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < n && /[0-9a-fA-FxX.]/.test(src[j])) j++;
      // Decimal exponent (1e10, 1.5e-3). Only reachable after the hex loop,
      // since 'e' is consumed above only while scanning an 0x... literal.
      if (j < n && /[eE]/.test(src[j]) && !/0[xX]/.test(src.slice(i, j + 1))) {
        let k = j + 1;
        if (k < n && /[+-]/.test(src[k])) k++;
        if (k < n && /[0-9]/.test(src[k])) {
          while (k < n && /[0-9]/.test(src[k])) k++;
          j = k;
        }
      }
      // Long / float / double suffix (0xffffffffL, 1.0f, 2d). Without this,
      // the 'L' would be tokenized as an identifier and renamed.
      if (j < n && /[lLfFdD]/.test(src[j])) j++;
      tokens.push({ t: 'num', w: src.slice(i, j) });
      i = j;
      continue;
    }
    const three = src.slice(i, i + 3);
    const two = src.slice(i, i + 2);
    if (OPS3.includes(three)) {
      tokens.push({ t: 'op', w: three });
      i += 3;
      continue;
    }
    if (OPS2.includes(two)) {
      tokens.push({ t: 'op', w: two });
      i += 2;
      continue;
    }
    tokens.push({ t: 'op', w: c });
    i++;
  }
  return tokens;
}

function* aliases() {
  const sets = ['abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
  let idx = 0;
  while (true) {
    const suffix = Math.floor(idx / 2);
    for (const c of sets[idx % 2]) {
      yield suffix === 0 ? c : c + suffix;
    }
    idx++;
  }
}

const all = [];
for (const f of FILES) {
  all.push({ file: f, tokens: tokenize(fs.readFileSync(path.join(DIR, f), 'utf8')) });
}

const map = new Map();
const gen = aliases();
for (const { tokens } of all) {
  for (const t of tokens) {
    if (t.t === 'id' && !KEEP.has(t.w) && !map.has(t.w)) {
      map.set(t.w, gen.next().value);
    }
  }
}

const isWord = t => t.t === 'id' || t.t === 'num';
let totalBefore = 0;
let totalAfter = 0;
for (const { file, tokens } of all) {
  let out = '';
  let last = '';
  let lastWord = false;
  for (const t of tokens) {
    let w = t.w;
    if (t.t === 'id' && map.has(w)) w = map.get(w);
    const curWord = t.t === 'id' || t.t === 'num';
    let space = false;
    if (lastWord && curWord) space = true;
    const pair = last.slice(-1) + w[0];
    if (pair === '--' || pair === '++' || pair === '//' || pair === '/*' || pair === '*/') {
      space = true;
    }
    if (space) out += ' ';
    out += w;
    if (w === ';' || w === '{' || w === '}') out += '\n';
    last = w;
    lastWord = curWord;
  }
  const before = fs.readFileSync(path.join(DIR, file), 'utf8');
  totalBefore += before.length;
  totalAfter += out.length;
  fs.writeFileSync(path.join(DIR, file), out.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
  console.log(`${file}: ${before.length} -> ${out.length} bytes`);
}
console.log(`total: ${totalBefore} -> ${totalAfter} bytes (${(100 * totalAfter / totalBefore).toFixed(0)}%)`);
