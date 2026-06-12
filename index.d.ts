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
