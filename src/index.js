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
export {
  Encoder_Interface_init,
  Encoder_Interface_exit,
  Encoder_Interface_Encode,
} from './enc/amrencode.js';

import {
  Decoder_Interface_init,
  Decoder_Interface_Decode,
} from './dec/amrdecode.js';
import {
  Encoder_Interface_init,
  Encoder_Interface_Encode,
} from './enc/amrencode.js';

export const MAGIC = '#!AMR\n';

/** AMR-NB mode constants for the encoder (kbps). */
export const Mode = {
  MR475: 0, MR515: 1, MR59: 2, MR67: 3,
  MR74: 4, MR795: 5, MR102: 6, MR122: 7,
};

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

/** High-level AMR-NB encoder */
export class AmrNbEncoder {
  /** @param {{dtx?: boolean}} [opts] */
  constructor(opts = {}) {
    this.state = Encoder_Interface_init(opts.dtx ? 1 : 0);
  }

  /** Reset encoder state. */
  reset() {
    this.state.encCtx.reset();
    this.state.sidCtx.reset();
  }

  /**
   * Encode 160 PCM samples (8 kHz) to one IETF frame (incl. ToC byte).
   * @param {Int16Array} pcm 160 samples
   * @param {number} mode 0..7 (see Mode)
   * @returns {Uint8Array} the encoded frame (newly allocated)
   */
  encode(pcm, mode) {
    const out = new Uint8Array(32);
    const n = Encoder_Interface_Encode(this.state, mode, pcm, out, 0);
    return out.slice(0, n);
  }

  /**
   * Encode an entire PCM buffer to an AMR file body (with "#!AMR\n" magic).
   * @param {Int16Array} pcm
   * @param {number} mode 0..7
   * @returns {Uint8Array}
   */
  encodeAll(pcm, mode) {
    const nFrames = Math.floor(pcm.length / 160);
    const frames = [];
    let total = 6;
    for (let f = 0; f < nFrames; f++) {
      const frame = this.encode(pcm.subarray(f * 160, f * 160 + 160), mode);
      frames.push(frame);
      total += frame.length;
    }
    const out = new Uint8Array(total);
    out.set([0x23, 0x21, 0x41, 0x4d, 0x52, 0x0a], 0); /* #!AMR\n */
    let off = 6;
    for (const frame of frames) {
      out.set(frame, off);
      off += frame.length;
    }
    return out;
  }
}
