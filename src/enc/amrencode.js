/*
 * Encoder framing + public interface, ported from opencore-amr 0.1.6:
 *   sid_sync.cpp (sid_syncState, sid_sync), ets_to_wmf.cpp (ets_to_ietf),
 *   amrencode.cpp (AMREncode), amrnb/wrapper.cpp (Encoder_Interface_*).
 * Active implementations transcribed line by line.
 */
import { MAX_SERIAL_SIZE, AMR_SID, AMR_NO_DATA, MRDTX } from '../common/cnst.js';
import { reorderBits, numOfBits, WmfEncBytesPerFrame } from '../common/tables/index.js';
import { Speech_Encode_FrameState, GSMEncodeFrame } from './sp_enc.js';

/* TXFrameType (frame.h) */
const TX_SPEECH_GOOD = 0;
const TX_SID_FIRST = 1;
const TX_SID_UPDATE = 2;
const TX_NO_DATA = 3;

const NUM_AMRSID_TXMODE_BITS = 3;
const AMRSID_TXMODE_BIT_OFFSET = 36;
const AMRSID_TXTYPE_BIT_OFFSET = 35;

/** sid_sync.h sid_syncState */
export class sid_syncState {
  constructor() {
    this.sid_update_rate = 8;
    this.sid_update_counter = 0;
    this.sid_handover_debt = 0;
    this.prev_ft = TX_SPEECH_GOOD;
    this.reset();
  }

  /** sid_sync.cpp sid_sync_reset */
  reset() {
    this.sid_update_counter = 3;
    this.sid_handover_debt = 0;
    this.prev_ft = TX_SPEECH_GOOD;
    return 0;
  }
}

/**
 * sid_sync.cpp sid_sync.
 * tx_frame_type is a 1-element Int16Array out.
 */
export function sid_sync(st, mode, tx_frame_type) {
  if (mode === MRDTX) {
    st.sid_update_counter--;
    if (st.prev_ft === TX_SPEECH_GOOD) {
      tx_frame_type[0] = TX_SID_FIRST;
      st.sid_update_counter = 3;
    } else if (st.sid_handover_debt > 0 && st.sid_update_counter > 2) {
      tx_frame_type[0] = TX_SID_UPDATE;
      st.sid_handover_debt--;
    } else if (st.sid_update_counter === 0) {
      tx_frame_type[0] = TX_SID_UPDATE;
      st.sid_update_counter = st.sid_update_rate;
    } else {
      tx_frame_type[0] = TX_NO_DATA;
    }
  } else {
    st.sid_update_counter = st.sid_update_rate;
    tx_frame_type[0] = TX_SPEECH_GOOD;
  }
  st.prev_ft = tx_frame_type[0];
}

/** ets_to_wmf.cpp ets_to_ietf: ETS bit array -> packed IETF bytes */
export function ets_to_ietf(frame_type_3gpp, ets_input, ietf_output, ietfOff) {
  let i;
  let j = 0;
  let bits_left;
  let accum;

  ietf_output[ietfOff + j++] = (frame_type_3gpp << 3) & 0xff;

  if (frame_type_3gpp < AMR_SID) {
    const rb = reorderBits[frame_type_3gpp];
    const nb = numOfBits[frame_type_3gpp];
    for (i = 0; i < nb - 7;) {
      let v = (ets_input[rb[i++]] << 7);
      v |= ets_input[rb[i++]] << 6;
      v |= ets_input[rb[i++]] << 5;
      v |= ets_input[rb[i++]] << 4;
      v |= ets_input[rb[i++]] << 3;
      v |= ets_input[rb[i++]] << 2;
      v |= ets_input[rb[i++]] << 1;
      v |= ets_input[rb[i++]];
      ietf_output[ietfOff + j++] = v & 0xff;
    }
    bits_left = nb - (nb & 0xfff8);
    ietf_output[ietfOff + j] = 0;
    for (let k = 0; k < bits_left; k++) {
      ietf_output[ietfOff + j] |= (ets_input[rb[i++]] << (7 - k)) & 0xff;
    }
  } else {
    const nb = numOfBits[frame_type_3gpp];
    let pt = 0;
    for (i = nb - 7; i > 0; i -= 8) {
      accum = ets_input[pt++] << 7;
      accum |= ets_input[pt++] << 6;
      accum |= ets_input[pt++] << 5;
      accum |= ets_input[pt++] << 4;
      accum |= ets_input[pt++] << 3;
      accum |= ets_input[pt++] << 2;
      accum |= ets_input[pt++] << 1;
      accum |= ets_input[pt++];
      ietf_output[ietfOff + j++] = accum & 0xff;
    }
    bits_left = nb - (nb & 0xfff8);
    ietf_output[ietfOff + j] = 0;
    for (i = 0; i < bits_left; i++) {
      ietf_output[ietfOff + j] |= (ets_input[pt++] << (7 - i)) & 0xff;
    }
  }
}

const aeEtsBfr = new Int16Array(MAX_SERIAL_SIZE + 2);
const aeUsedMode = new Int16Array(1);
const aeTxType = new Int16Array(1);
const aeFrameType = new Int16Array(1);

/**
 * amrencode.cpp AMREncode (AMR_TX_IETF output only).
 * Returns { bytes, frameType }. pEncOutput receives the IETF payload (no ToC).
 */
export function AMREncode(encState, sidState, mode, pEncInput, pEncInputOff,
  pEncOutput, pEncOutputOff) {
  const ets = aeEtsBfr;

  GSMEncodeFrame(encState, mode, pEncInput, pEncInputOff, ets, 0, aeUsedMode);
  const usedMode = aeUsedMode[0];

  sid_sync(sidState, usedMode, aeTxType);
  const tx_frame_type = aeTxType[0];

  let frame_type;
  if (tx_frame_type !== TX_NO_DATA) {
    frame_type = usedMode;
    if (frame_type === AMR_SID) {
      if (tx_frame_type === TX_SID_FIRST) {
        ets[AMRSID_TXTYPE_BIT_OFFSET] &= 0x0000;
      } else if (tx_frame_type === TX_SID_UPDATE) {
        ets[AMRSID_TXTYPE_BIT_OFFSET] |= 0x0001;
      }
      for (let i = 0; i < NUM_AMRSID_TXMODE_BITS; i++) {
        ets[AMRSID_TXMODE_BIT_OFFSET + i] = (mode >> i) & 0x0001;
      }
    }
  } else {
    frame_type = AMR_NO_DATA;
  }

  ets_to_ietf(frame_type, ets, pEncOutput, pEncOutputOff);
  const num_enc_bytes = WmfEncBytesPerFrame[frame_type];
  return { bytes: num_enc_bytes, frameType: frame_type };
}

/** wrapper.cpp encoder_state + Encoder_Interface_init */
export function Encoder_Interface_init(dtx) {
  return {
    encCtx: new Speech_Encode_FrameState(dtx),
    sidCtx: new sid_syncState(),
  };
}

/** wrapper.cpp Encoder_Interface_exit */
export function Encoder_Interface_exit(state) {
  /* nothing to free in JS; kept for API compatibility */
}

const eiOut = new Uint8Array(32);
const eiPcm = new Int16Array(160);

/**
 * wrapper.cpp Encoder_Interface_Encode.
 * @param {object} state from Encoder_Interface_init
 * @param {number} mode 0..7 (MR475..MR122)
 * @param {Int16Array} speech 160 PCM samples
 * @param {Uint8Array} out frame output (incl. ToC byte)
 * @param {number} forceSpeech unused (matches C signature)
 * @returns {number} number of bytes written to out
 */
export function Encoder_Interface_Encode(state, mode, speech, out, forceSpeech) {
  for (let i = 0; i < 160; i++) eiPcm[i] = speech[i];

  const r = AMREncode(state.encCtx, state.sidCtx, mode, eiPcm, 0, eiOut, 0);
  for (let i = 0; i < r.bytes; i++) out[i] = eiOut[i];

  /* wrapper.cpp: out[0] |= 0x04 (mark frame as "good") */
  out[0] |= 0x04;
  return r.bytes;
}
