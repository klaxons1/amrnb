/*
 * Weighted-speech computation for two subframes, ported from opencore-amr
 * 0.1.6 enc/src/pre_big.cpp (pre_big). Transcribed line by line.
 */
import { MP1, L_SUBFR, MR795 } from '../common/cnst.js';
import { Weight_Ai, Residu, Syn_filt } from '../common/filters.js';

const pbAp1 = new Int16Array(MP1);
const pbAp2 = new Int16Array(MP1);

/** pre_big.cpp pre_big */
export function pre_big(mode, gamma1, gamma1_12k2, gamma2, A_t, A_tOff,
  frameOffset, speech, speechOff, mem_w, mem_wOff, wsp, wspOff, pOverflow) {
  const Ap1 = pbAp1;
  const Ap2 = pbAp2;
  let g1;
  let aOffset;

  if (mode <= MR795) {
    g1 = gamma1;
  } else {
    g1 = gamma1_12k2;
  }

  if (frameOffset > 0) {
    aOffset = MP1 << 1;
  } else {
    aOffset = 0;
  }

  for (let i = 0; i < 2; i++) {
    Weight_Ai(A_t, A_tOff + aOffset, g1, 0, Ap1, 0);
    Weight_Ai(A_t, A_tOff + aOffset, gamma2, 0, Ap2, 0);
    Residu(Ap1, 0, speech, speechOff + frameOffset, wsp, wspOff + frameOffset, L_SUBFR);
    Syn_filt(Ap2, 0, wsp, wspOff + frameOffset, wsp, wspOff + frameOffset, L_SUBFR,
      mem_w, mem_wOff, 1);
    aOffset += MP1;
    frameOffset += L_SUBFR;
  }
}
