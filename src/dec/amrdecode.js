/*
 * Frame unpacking + decode entry, ported from opencore-amr 0.1.6 dec/src:
 *   wmf_to_ets.cpp, amrdecode.cpp (MIME_IETF path), amrnb/wrapper.cpp
 *   (Decoder_Interface_*).
 * Active implementations transcribed line by line.
 */
import {
  MAX_SERIAL_SIZE, MR475,
  AMR_SID, AMR_122, AMR_NO_DATA,
  RX_SPEECH_GOOD, RX_SID_FIRST, RX_SID_UPDATE, RX_NO_DATA,
} from '../common/cnst.js';
import {
  reorderBits, numOfBits, WmfDecBytesPerFrame,
} from '../common/tables/index.js';
import { Speech_Decode_FrameState, GSMFrameDecode } from './sp_dec.js';

const NUM_AMRSID_RXMODE_BITS = 3;
const AMRSID_RXMODE_BIT_OFFSET = 36;
const AMRSID_RXTYPE_BIT_OFFSET = 35;

/** wmf_to_ets.cpp wmf_to_ets */
export function wmf_to_ets(frame_type_3gpp, wmf_input, wmfOff, ets_output) {
  /* Each bit gets its own slot in ets_output; for speech frames the bits
     are reordered via reorderBits[][]. */
  if (frame_type_3gpp < AMR_SID) {
    for (let i = numOfBits[frame_type_3gpp] - 1; i >= 0; i--) {
      ets_output[reorderBits[frame_type_3gpp][i]] =
        (wmf_input[wmfOff + (i >> 3)] >> (~i & 0x7)) & 0x01;
    }
  } else {
    for (let i = numOfBits[frame_type_3gpp] - 1; i >= 0; i--) {
      ets_output[i] = (wmf_input[wmfOff + (i >> 3)] >> (~i & 0x7)) & 0x01;
    }
  }
}

const adEtsBuf = new Int16Array(MAX_SERIAL_SIZE);

/**
 * amrdecode.cpp AMRDecode (MIME_IETF input format only).
 * speech_bits is a Uint8Array of the frame payload (after the ToC byte).
 * Returns byte_offset (bytes consumed) or -1 on invalid frame type.
 */
export function AMRDecode(decoder_state, frame_type, speech_bits, speechBitsOff,
  raw_pcm, raw_pcmOff) {
  let mode = MR475;
  let rx_type = RX_NO_DATA;
  const dec_ets_input_bfr = adEtsBuf;
  let byte_offset = -1;

  dec_ets_input_bfr.fill(0);

  /* Convert incoming packetized raw WMF data to ETS format */
  wmf_to_ets(frame_type, speech_bits, speechBitsOff, dec_ets_input_bfr);
  /* Address offset of the start of next frame */
  byte_offset = WmfDecBytesPerFrame[frame_type];

  /* Determine AMR codec mode and AMR RX frame type */
  if (frame_type <= AMR_122) {
    mode = frame_type;
    rx_type = RX_SPEECH_GOOD;
  } else if (frame_type === AMR_SID) {
    /* read mode info from input buffer */
    let modeStore = 0;
    for (let i = 0; i < NUM_AMRSID_RXMODE_BITS; i++) {
      modeStore |= dec_ets_input_bfr[AMRSID_RXMODE_BIT_OFFSET + i] << i;
    }
    mode = modeStore;

    /* Get RX frame type */
    if (dec_ets_input_bfr[AMRSID_RXTYPE_BIT_OFFSET] === 0) {
      rx_type = RX_SID_FIRST;
    } else {
      rx_type = RX_SID_UPDATE;
    }
  } else if (frame_type < AMR_NO_DATA) {
    /* Invalid frame_type, return error code */
    byte_offset = -1;
  } else {
    mode = decoder_state.prev_mode;
    /* RX_NO_DATA: exponential decay from latest valid frame for the first
       6 frames, after that silent frames */
    rx_type = RX_NO_DATA;
  }

  /* Proceed with decoding frame, if there are no errors */
  if (byte_offset !== -1) {
    /* Decode a 20 ms frame */
    GSMFrameDecode(decoder_state, mode, dec_ets_input_bfr, 0, rx_type,
      raw_pcm, raw_pcmOff);

    /* Save mode for next frame */
    decoder_state.prev_mode = mode;
  }

  return byte_offset;
}

/** wrapper.cpp Decoder_Interface_init */
export function Decoder_Interface_init() {
  return new Speech_Decode_FrameState();
}

/** wrapper.cpp Decoder_Interface_exit */
export function Decoder_Interface_exit(state) {
  /* nothing to free in JS; kept for API compatibility */
}

/**
 * wrapper.cpp Decoder_Interface_Decode.
 * @param {Speech_Decode_FrameState} state
 * @param {Uint8Array} input one IETF frame incl. ToC byte
 * @param {Int16Array} output 160 PCM samples
 * @param {number} bfi bad frame indicator
 */
export function Decoder_Interface_Decode(state, input, output, bfi) {
  let type = (input[0] >> 3) & 0x0f;
  if (bfi) {
    type = AMR_NO_DATA;
  }
  AMRDecode(state, type, input, 1, output, 0);
}
