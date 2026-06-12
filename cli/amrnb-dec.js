#!/usr/bin/env node
// Decodes an IETF .amr file to a 16-bit 8 kHz mono WAV file.
// Usage: node cli/amrnb-dec.js in.amr out.wav
import fs from 'node:fs';
import { AmrNbDecoder } from '../src/index.js';

const [inFile, outFile] = process.argv.slice(2);
if (!inFile || !outFile) {
  console.error('usage: amrnb-dec.js in.amr out.wav');
  process.exit(1);
}

const data = fs.readFileSync(inFile);
const pcm = new AmrNbDecoder().decodeAll(data);

const dataBytes = pcm.length * 2;
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + dataBytes, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);       /* fmt chunk size */
header.writeUInt16LE(1, 20);        /* PCM */
header.writeUInt16LE(1, 22);        /* mono */
header.writeUInt32LE(8000, 24);     /* sample rate */
header.writeUInt32LE(8000 * 2, 28); /* byte rate */
header.writeUInt16LE(2, 32);        /* block align */
header.writeUInt16LE(16, 34);       /* bits per sample */
header.write('data', 36);
header.writeUInt32LE(dataBytes, 40);

fs.writeFileSync(outFile, Buffer.concat([
  header,
  Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength),
]));
console.error(`${pcm.length / 160} frames -> ${outFile}`);
