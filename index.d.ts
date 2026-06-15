/** audioc2 — pure JavaScript AMR-NB codec (decoder, bit-exact vs opencore-amr). */

/** Opaque decoder state (mirrors opencore-amr Speech_Decode_FrameState). */
export interface DecoderState {
  reset(): number;
}

/** Low-level API, drop-in for opencore-amr's wrapper.cpp interface. */
export function Decoder_Interface_init(): DecoderState;
export function Decoder_Interface_exit(state: DecoderState): void;
/**
 * Decode one IETF frame (incl. ToC byte) into 160 PCM samples.
 * @param state decoder state from Decoder_Interface_init()
 * @param input one frame, ToC byte first
 * @param output Int16Array(160) receiving 8 kHz PCM
 * @param bfi bad frame indicator (0 or 1)
 */
export function Decoder_Interface_Decode(
  state: DecoderState,
  input: Uint8Array,
  output: Int16Array,
  bfi: number,
): void;

/** Opaque encoder state (mirrors opencore-amr's wrapper encoder_state). */
export interface EncoderState {
  encCtx: { reset(): number };
  sidCtx: { reset(): number };
}

/** Initialize an encoder. dtx: 0 or 1 (discontinuous transmission). */
export function Encoder_Interface_init(dtx: number): EncoderState;
export function Encoder_Interface_exit(state: EncoderState): void;
/**
 * Encode 160 PCM samples into one IETF frame.
 * @param state encoder state
 * @param mode 0..7 (MR475..MR122)
 * @param speech Int16Array(160) of 8 kHz PCM
 * @param out receives the frame (ToC byte first)
 * @param forceSpeech unused (matches the C signature)
 * @returns number of bytes written to out
 */
export function Encoder_Interface_Encode(
  state: EncoderState,
  mode: number,
  speech: Int16Array,
  out: Uint8Array,
  forceSpeech: number,
): number;

/** AMR-NB encoder mode constants (kbps). */
export const Mode: {
  MR475: 0; MR515: 1; MR59: 2; MR67: 3;
  MR74: 4; MR795: 5; MR102: 6; MR122: 7;
};

/** "#!AMR\n" file magic. */
export const MAGIC: string;

/** Frame sizes in bytes (incl. ToC byte) indexed by frame type. */
export const FRAME_SIZE: number[];

/** High-level AMR-NB decoder. */
export class AmrNbDecoder {
  constructor();
  /** Reset decoder state (as after construction). */
  reset(): void;
  /** Decode one IETF frame (incl. ToC byte) to 160 PCM samples (8 kHz). */
  decode(frame: Uint8Array, bfi?: boolean): Int16Array;
  /** Decode an entire AMR buffer (with or without "#!AMR\n" magic). */
  decodeAll(data: Uint8Array): Int16Array;
}

/** High-level AMR-NB encoder. */
export class AmrNbEncoder {
  constructor(opts?: { dtx?: boolean });
  /** Reset encoder state. */
  reset(): void;
  /** Encode 160 PCM samples (8 kHz) to one IETF frame (incl. ToC byte). */
  encode(pcm: Int16Array, mode: number): Uint8Array;
  /** Encode an entire PCM buffer to an AMR file body (with "#!AMR\n" magic). */
  encodeAll(pcm: Int16Array, mode: number): Uint8Array;
}
