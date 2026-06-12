/*
 * Frame decode assembly, ported from opencore-amr 0.1.6 dec/src/sp_dec.cpp
 * (Bin2int, Bits2prm, Speech_Decode_FrameState, GSMInitDecode,
 * Speech_Decode_Frame_reset, GSMFrameDecode).
 * Active implementations transcribed line by line.
 */
import {
  L_FRAME, AZ_SIZE, MAX_PRM_SIZE, MR475, MRDTX, RX_SID_BAD, RX_SID_UPDATE,
} from '../common/cnst.js';
import { prmno, bitno } from '../common/tables/index.js';
import { Decoder_amrState, Decoder_amr, Decoder_amr_reset } from './dec_amr.js';
import { Post_FilterState, Post_Filter } from './pstfilt.js';
import { Post_ProcessState, Post_Process } from './post_pre.js';

/** sp_dec.cpp Bin2int (static) */
function Bin2int(no_of_bits, bitstream, bitstreamOff) {
  let value = 0;
  for (let i = 0; i < no_of_bits; i++) {
    value <<= 1;
    value |= bitstream[bitstreamOff + i];
  }
  return value;
}

/** sp_dec.cpp Bits2prm */
export function Bits2prm(mode, bits, bitsOff, prm, prmOff) {
  let pBits = bitsOff;
  for (let i = 0; i < prmno[mode]; i++) {
    prm[prmOff + i] = Bin2int(bitno[mode][i], bits, pBits);
    pBits += bitno[mode][i];
  }
}

/** sp_dec.h Speech_Decode_FrameState */
export class Speech_Decode_FrameState {
  /** sp_dec.cpp GSMInitDecode */
  constructor() {
    this.decoder_amrState = new Decoder_amrState();
    this.post_state = new Post_FilterState();
    this.postHP_state = new Post_ProcessState();
    this.prev_mode = MR475;
    this.reset();
  }

  /** sp_dec.cpp Speech_Decode_Frame_reset */
  reset() {
    Decoder_amr_reset(this.decoder_amrState, MR475);
    this.post_state.reset();
    this.postHP_state.reset();
    this.prev_mode = MR475;
    return 0;
  }
}

const sdParm = new Int16Array(MAX_PRM_SIZE + 1);
const sdAzDec = new Int16Array(AZ_SIZE);

/** sp_dec.cpp GSMFrameDecode */
export function GSMFrameDecode(st, mode, serial, serialOff, frame_type, synth, synthOff) {
  const parm = sdParm;   /* synthesis parameters */
  const Az_dec = sdAzDec; /* decoded Az for post-filter in 4 subframes */
  const pOverflow = st.decoder_amrState.overflow;

  /* Serial to parameters */
  if (frame_type === RX_SID_BAD || frame_type === RX_SID_UPDATE) {
    /* Override mode to MRDTX */
    Bits2prm(MRDTX, serial, serialOff, parm, 0);
  } else {
    Bits2prm(mode, serial, serialOff, parm, 0);
  }

  /* Synthesis */
  Decoder_amr(st.decoder_amrState, mode, parm, 0, frame_type,
    synth, synthOff, Az_dec, 0);

  /* Post-filter */
  Post_Filter(st.post_state, mode, synth, synthOff, Az_dec, 0, pOverflow);

  /* post HP filter, and 15->16 bits */
  Post_Process(st.postHP_state, synth, synthOff, L_FRAME, pOverflow);

  /* Truncate to 13 bits (C builds without NO13BIT defined) */
  for (let i = 0; i < L_FRAME; i++) {
    synth[synthOff + i] = synth[synthOff + i] & 0xfff8;
  }
}
