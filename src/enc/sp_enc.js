/*
 * Speech encoder frame driver, ported from opencore-amr 0.1.6 enc/src:
 *   prm2bits.cpp (Int2bin, Prm2bits), sp_enc.cpp (Speech_Encode_FrameState,
 *   GSMInitEncode, Speech_Encode_Frame_reset, Speech_Encode_Frame_First,
 *   GSMEncodeFrame). Active implementations transcribed line by line.
 */
import { L_FRAME, L_NEXT, MAX_PRM_SIZE, MAX_SERIAL_SIZE } from '../common/cnst.js';
import { prmno, bitno } from '../common/tables/index.js';
import { Pre_ProcessState, Pre_Process } from './lpc.js';
import { cod_amrState, cod_amr, cod_amr_first } from './cod_amr.js';

const MASK = 0x0001;

/** prm2bits.cpp Int2bin (static) */
function Int2bin(value, no_of_bits, bits, bitsOff) {
  let pt = bitsOff + no_of_bits - 1;
  for (let i = no_of_bits; i !== 0; i--) {
    bits[pt--] = value & MASK;
    value >>= 1;
  }
}

/** prm2bits.cpp Prm2bits */
export function Prm2bits(mode, prm, prmOff, bits, bitsOff) {
  const p_mode = bitno[mode];
  let pPrm = prmOff;
  let pBits = bitsOff;
  let pm = 0;
  for (let i = prmno[mode]; i !== 0; i--) {
    Int2bin(prm[pPrm++], p_mode[pm], bits, pBits);
    pBits += p_mode[pm++];
  }
}

/** sp_enc.h Speech_Encode_FrameState */
export class Speech_Encode_FrameState {
  /** sp_enc.cpp GSMInitEncode */
  constructor(dtx) {
    this.pre_state = new Pre_ProcessState();
    this.cod_amr_state = new cod_amrState(dtx);
    this.dtx = dtx ? 1 : 0;
    this.pre_state.reset();
  }

  /** sp_enc.cpp Speech_Encode_Frame_reset */
  reset() {
    this.pre_state.reset();
    this.cod_amr_state.reset();
    return 0;
  }
}

/** sp_enc.cpp Speech_Encode_Frame_First */
export function Speech_Encode_Frame_First(st, new_speech, new_speechOff) {
  for (let i = 0; i < L_NEXT; i++) {
    new_speech[new_speechOff + i] &= 0xfff8;
  }
  Pre_Process(st.pre_state, new_speech, new_speechOff, L_NEXT);
  cod_amr_first(st.cod_amr_state, new_speech, new_speechOff);
}

const sefPrm = new Int16Array(MAX_PRM_SIZE);
const sefSyn = new Int16Array(L_FRAME);

/**
 * sp_enc.cpp GSMEncodeFrame.
 * new_speech is modified in place (HP-filter + masking, as in C).
 * serial is the ETS bit output; usedMode is a 1-element Int16Array out.
 */
export function GSMEncodeFrame(st, mode, new_speech, new_speechOff, serial, serialOff, usedMode) {
  const prm = sefPrm;
  const syn = sefSyn;

  for (let i = 0; i < MAX_SERIAL_SIZE; i++) {
    serial[serialOff + i] = 0;
  }

  for (let i = 0; i < L_FRAME; i++) {
    new_speech[new_speechOff + i] &= 0xfff8;
  }

  Pre_Process(st.pre_state, new_speech, new_speechOff, L_FRAME);
  usedMode[0] = cod_amr(st.cod_amr_state, mode, new_speech, new_speechOff,
    prm, 0, syn, 0);
  Prm2bits(usedMode[0], prm, 0, serial, serialOff);
}
