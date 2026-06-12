/*
 * audioc2 — pure JavaScript AMR-NB codec, hand-ported from opencore-amr 0.1.6.
 *
 * Low-level API mirrors opencore-amr's wrapper.cpp (drop-in for the
 * emscripten amrnb.js module); the high-level classes are idiomatic JS.
 */
export {
  Decoder_Interface_init,
  Decoder_Interface_exit,
  Decoder_Interface_Decode,
} from './dec/amrdecode.js';

import {
  Decoder_Interface_init,
  Decoder_Interface_Decode,
} from './dec/amrdecode.js';

export const MAGIC = '#!AMR\n';

/** Frame sizes in bytes (incl. ToC byte) per frame type, IETF storage format */
export const FRAME_SIZE = [13, 14, 16, 18, 20, 21, 27, 32, 6, 1, 1, 1, 1, 1, 1, 1];

/** High-level AMR-NB decoder */
export class AmrNbDecoder {
  constructor() {
    this.state = Decoder_Interface_init();
  }

  /** Reset decoder state (as after construction). */
  reset() {
    this.state.reset();
  }

  /**
   * Decode one IETF frame (incl. ToC byte) to 160 PCM samples (8 kHz).
   * @param {Uint8Array} frame
   * @param {boolean} [bfi] bad frame indicator
   * @returns {Int16Array} 160 samples (newly allocated)
   */
  decode(frame, bfi = false) {
    const pcm = new Int16Array(160);
    Decoder_Interface_Decode(this.state, frame, pcm, bfi ? 1 : 0);
    return pcm;
  }

  /**
   * Decode an entire AMR buffer (with or without "#!AMR\n" magic).
   * @param {Uint8Array} data
   * @returns {Int16Array} concatenated PCM samples
   */
  decodeAll(data) {
    let off = 0;
    if (data.length >= 6
      && String.fromCharCode(...data.subarray(0, 6)) === MAGIC) {
      off = 6;
    }
    const frames = [];
    while (off < data.length) {
      const size = FRAME_SIZE[(data[off] >> 3) & 0x0f];
      frames.push(this.decode(data.subarray(off, off + size)));
      off += size;
    }
    const out = new Int16Array(frames.length * 160);
    frames.forEach((f, i) => out.set(f, i * 160));
    return out;
  }
}
