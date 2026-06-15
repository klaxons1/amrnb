#!/usr/bin/env node
// Encodes a 16-bit 8 kHz mono WAV (or raw Int16LE PCM) to an IETF .amr file.
// Usage: node cli/amrnb-enc.js in.wav out.amr [mode 0-7]
import fs from 'node:fs';
import { AmrNbEncoder } from '../src/index.js';

const [inFile, outFile, modeArg] = process.argv.slice(2);
if (!inFile || !outFile) {
  console.error('usage: amrnb-enc.js in.wav out.amr [mode 0-7]');
  process.exit(1);
}
const mode = modeArg !== undefined ? parseInt(modeArg, 10) : 7;

const data = fs.readFileSync(inFile);
// Skip a 44-byte WAV header if present, else treat the whole file as raw PCM.
let off = 0;
if (data.length >= 12 && data.toString('latin1', 0, 4) === 'RIFF') {
  off = 44;
}
const pcm = new Int16Array(
  data.buffer.slice(data.byteOffset + off, data.byteOffset + data.length),
);

const amr = new AmrNbEncoder().encodeAll(pcm, mode);
fs.writeFileSync(outFile, Buffer.from(amr));
console.error(`${Math.floor(pcm.length / 160)} frames (mode ${mode}) -> ${outFile}`);
