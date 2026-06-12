// Loads the emscripten-compiled opencore-amr reference module
// (/root/claude/audioc/build/amrnb.js) in Node, for golden-output generation.
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AMRNB_PATH = path.resolve(__dirname, '../../audioc/build/amrnb.js');

export async function loadReference() {
  const code = fs.readFileSync(AMRNB_PATH, 'utf8');
  const context = vm.createContext({
    console,
    WebAssembly,
    TextDecoder,
    TextEncoder,
    Uint8Array,
    Int8Array,
    Int16Array,
    Int32Array,
    Uint16Array,
    Uint32Array,
    Float32Array,
    Float64Array,
    ArrayBuffer,
    DataView,
    Math,
    setTimeout,
    clearTimeout,
    // Make emscripten detect a Node environment inside the vm sandbox.
    process,
    Buffer,
    URL,
    performance,
    atob: globalThis.atob,
    require: createRequire(AMRNB_PATH),
    __dirname: path.dirname(AMRNB_PATH),
    __filename: AMRNB_PATH,
  });
  vm.runInContext(code + '\n;globalThis.__AMRNB = AMRNB;', context, {
    filename: 'amrnb.js',
  });
  const AMRNB = context.__AMRNB;
  // Emscripten wasm instantiation may be asynchronous; wait until exports work.
  for (let i = 0; i < 200; i++) {
    try {
      const st = AMRNB.Decoder_Interface_init();
      if (st) {
        AMRNB.Decoder_Interface_exit(st);
        return AMRNB;
      }
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('AMRNB reference module did not become ready');
}

// Frame sizes (bytes incl. ToC byte) per mode for IETF storage format.
export const BLOCK_SIZE = [13, 14, 16, 18, 20, 21, 27, 32, 6, 1, 1, 1, 1, 1, 1, 1];

export function makeRefDecoder(AMRNB) {
  const state = AMRNB.Decoder_Interface_init();
  const input = AMRNB.allocate(new Int8Array(32 + 1), 0);
  const output = AMRNB.allocate(new Int16Array(160), 0);
  return {
    decodeFrame(frameBytes, bfi = 0) {
      for (let i = 0; i < frameBytes.length; i++) {
        AMRNB.setValue(input + i, frameBytes[i] << 24 >> 24, 'i8');
      }
      AMRNB.Decoder_Interface_Decode(state, input, output, bfi);
      const pcm = new Int16Array(160);
      for (let i = 0; i < 160; i++) {
        pcm[i] = AMRNB.getValue(output + 2 * i, 'i16');
      }
      return pcm;
    },
    destroy() {
      AMRNB.Decoder_Interface_exit(state);
    },
  };
}

export function makeRefEncoder(AMRNB, dtx) {
  const state = AMRNB.Encoder_Interface_init(dtx ? 1 : 0);
  const input = AMRNB.allocate(new Int16Array(160), 0);
  const output = AMRNB.allocate(new Int8Array(32), 0);
  return {
    encodeFrame(pcm160, mode) {
      for (let i = 0; i < 160; i++) {
        AMRNB.setValue(input + 2 * i, pcm160[i], 'i16');
      }
      const n = AMRNB.Encoder_Interface_Encode(state, mode, input, output, 0);
      const out = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        out[i] = AMRNB.getValue(output + i, 'i8') & 0xff;
      }
      return out;
    },
    destroy() {
      AMRNB.Encoder_Interface_exit(state);
    },
  };
}
