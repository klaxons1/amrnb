// Decodes every test/fixtures/*.amr with the JS decoder and compares the
// PCM sample-by-sample with the Java decoder output in javaOutDir.
// Usage: node compare.mjs <fixturesDir> <javaOutDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AmrNbDecoder } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [fixturesDir, javaOutDir] = process.argv.slice(2);
if (!fixturesDir || !javaOutDir) {
  console.error('usage: node compare.mjs <fixturesDir> <javaOutDir>');
  process.exit(2);
}

const amrFiles = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.amr')).sort();
let failed = 0;
for (const f of amrFiles) {
  const amr = fs.readFileSync(path.join(fixturesDir, f));
  const jsPcm = new AmrNbDecoder().decodeAll(amr);

  const javaPath = path.join(javaOutDir, f.replace(/\.amr$/, '.pcm'));
  if (!fs.existsSync(javaPath)) {
    console.log(`FAIL ${f}: Java output missing (${javaPath})`);
    failed++;
    continue;
  }
  const javaBuf = fs.readFileSync(javaPath);
  const javaPcm = new Int16Array(javaBuf.buffer, javaBuf.byteOffset, javaBuf.length >> 1);

  if (jsPcm.length !== javaPcm.length) {
    console.log(`FAIL ${f}: length js=${jsPcm.length} java=${javaPcm.length}`);
    failed++;
    continue;
  }
  let firstDiff = -1;
  for (let i = 0; i < jsPcm.length; i++) {
    if (jsPcm[i] !== javaPcm[i]) {
      firstDiff = i;
      break;
    }
  }
  if (firstDiff < 0) {
    console.log(`PASS ${f} (${jsPcm.length} samples)`);
  } else {
    console.log(`FAIL ${f}: first diff at sample ${firstDiff}: js=${jsPcm[firstDiff]} java=${javaPcm[firstDiff]}`);
    failed++;
  }
}
if (failed) {
  console.error(`\n${failed} file(s) differ from the JS decoder`);
  process.exit(1);
}
console.log('\nAll files match the JS decoder byte-exactly.');
