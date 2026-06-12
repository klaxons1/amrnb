/*
 * Post filter and excitation control, ported from opencore-amr 0.1.6
 * dec/src/pstfilt.cpp and dec/src/ex_ctrl.cpp.
 * Active implementations transcribed line by line.
 */
import {
  MAX_32, sub, shl, norm_s, div_s, L_mult, L_add, L_shr,
} from '../common/basicop.js';
import { M, MP1, L_FRAME, L_SUBFR, MU, AGC_FAC, MR122, MR102 } from '../common/cnst.js';
import { Weight_Ai, Residu, Syn_filt } from '../common/filters.js';
import { gmed_n } from '../common/mathops.js';
import { agcState, agc } from './agc.js';
import { preemphasisState, preemphasis } from './post_pre.js';

const L_H = 22; /* size of truncated impulse response of A(z/g1)/A(z/g2) */

const gamma3_MR122 = Int16Array.from([
  22938, 16057, 11240, 7868, 5508, 3856, 2699, 1889, 1322, 925,
]);
const gamma3 = Int16Array.from([
  18022, 9912, 5451, 2998, 1649, 907, 499, 274, 151, 83,
]);
const gamma4_MR122 = Int16Array.from([
  24576, 18432, 13824, 10368, 7776, 5832, 4374, 3281, 2461, 1846,
]);
const gamma4 = Int16Array.from([
  22938, 16057, 11240, 7868, 5508, 3856, 2699, 1889, 1322, 925,
]);

/** pstfilt.h Post_FilterState */
export class Post_FilterState {
  constructor() {
    this.res2 = new Int16Array(L_SUBFR);
    this.mem_syn_pst = new Int16Array(M);
    this.preemph_state = new preemphasisState();
    this.agc_state = new agcState();
    this.synth_buf = new Int16Array(M + L_FRAME);
  }

  /** pstfilt.cpp Post_Filter_reset */
  reset() {
    this.mem_syn_pst.fill(0);
    this.res2.fill(0);
    this.synth_buf.fill(0);
    this.agc_state.reset();
    this.preemph_state.reset();
    return 0;
  }
}

const pfAp3 = new Int16Array(MP1);
const pfAp4 = new Int16Array(MP1);
const pfH = new Int16Array(L_H);

/** pstfilt.cpp Post_Filter */
export function Post_Filter(st, mode, syn, synOff, Az_4, Az_4Off, pOverflow) {
  const Ap3 = pfAp3;
  const Ap4 = pfAp4; /* bandwidth expanded LP parameters */
  const h = pfH;
  let temp1;
  let temp2;
  let L_tmp;
  let L_tmp2;
  const syn_work = st.synth_buf; /* syn_work = &synth_buf[M] */
  const SW = M; /* offset of syn_work inside synth_buf */

  /* Post filtering */
  for (let i = 0; i < L_FRAME; i++) {
    syn_work[SW + i] = syn[synOff + i];
  }

  let Az = Az_4Off;
  for (let i_subfr = 0; i_subfr < L_FRAME; i_subfr += L_SUBFR) {
    /* Find weighted filter coefficients Ap3[] and Ap4[] */
    if (mode === MR122 || mode === MR102) {
      Weight_Ai(Az_4, Az, gamma3_MR122, 0, Ap3, 0);
      Weight_Ai(Az_4, Az, gamma4_MR122, 0, Ap4, 0);
    } else {
      Weight_Ai(Az_4, Az, gamma3, 0, Ap3, 0);
      Weight_Ai(Az_4, Az, gamma4, 0, Ap4, 0);
    }

    /* filtering of synthesis speech by A(z/0.7) to find res2[] */
    Residu(Ap3, 0, syn_work, SW + i_subfr, st.res2, 0, L_SUBFR);

    /* tilt compensation filter: impulse response of A(z/0.7)/A(z/0.75) */
    for (let i = 0; i <= M; i++) h[i] = Ap3[i];
    for (let i = M + 1; i < L_H; i++) h[i] = 0;
    Syn_filt(Ap4, 0, h, 0, h, 0, L_H, h, M + 1, 0);

    /* 1st correlation of h[] */
    L_tmp = 0;
    for (let i = L_H - 1; i >= 0; i--) {
      L_tmp2 = h[i] * h[i];
      if (L_tmp2 !== 0x40000000) {
        L_tmp2 = L_tmp2 << 1;
      } else {
        /* C: sets pOverflow and breaks without accumulating */
        pOverflow[0] = 1;
        break;
      }
      L_tmp = L_add(L_tmp, L_tmp2, pOverflow);
    }
    temp1 = ((L_tmp >> 16) << 16) >> 16;

    L_tmp = 0;
    for (let i = L_H - 2; i >= 0; i--) {
      L_tmp2 = h[i] * h[i + 1];
      if (L_tmp2 !== 0x40000000) {
        L_tmp2 = L_tmp2 << 1;
      } else {
        pOverflow[0] = 1;
        break;
      }
      L_tmp = L_add(L_tmp, L_tmp2, pOverflow);
    }
    temp2 = ((L_tmp >> 16) << 16) >> 16;

    if (temp2 <= 0) {
      temp2 = 0;
    } else {
      L_tmp = (temp2 * MU) >> 15;
      /* Sign-extend product */
      if (L_tmp & 0x00010000) {
        L_tmp = L_tmp | (0xffff0000 | 0);
      }
      temp2 = (L_tmp << 16) >> 16;
      temp2 = div_s(temp2, temp1);
    }

    preemphasis(st.preemph_state, st.res2, 0, temp2, L_SUBFR, pOverflow);

    /* filtering through 1/A(z/0.75) */
    Syn_filt(Ap4, 0, st.res2, 0, syn, synOff + i_subfr, L_SUBFR, st.mem_syn_pst, 0, 1);

    /* scale output to input */
    agc(st.agc_state, syn_work, SW + i_subfr, syn, synOff + i_subfr,
      AGC_FAC, L_SUBFR, pOverflow);

    Az += MP1;
  }

  /* update syn_work[] buffer: syn_work[-M..-1] = syn_work[L_FRAME-M..L_FRAME-1] */
  for (let i = 0; i < M; i++) {
    st.synth_buf[i] = st.synth_buf[L_FRAME + i];
  }
}

/** ex_ctrl.cpp Ex_ctrl: excitation scaling for error concealment */
export function Ex_ctrl(excitation, excitationOff, excEnergy, exEnergyHist,
  exEnergyHistOff, voicedHangover, prevBFI, carefulFlag, pOverflow) {
  let exp;
  let testEnergy, scaleFactor, avgEnergy, prevEnergy;
  let t0;

  /* get target level */
  avgEnergy = gmed_n(exEnergyHist, exEnergyHistOff, 9);

  prevEnergy = (exEnergyHist[exEnergyHistOff + 7] + exEnergyHist[exEnergyHistOff + 8]) >> 1;
  if (exEnergyHist[exEnergyHistOff + 8] < prevEnergy) {
    prevEnergy = exEnergyHist[exEnergyHistOff + 8];
  }

  /* upscaling to avoid too rapid energy rises for some cases */
  if (excEnergy < avgEnergy && excEnergy > 5) {
    testEnergy = shl(prevEnergy, 2, pOverflow); /* 4*prevEnergy */

    if (voicedHangover < 7 || prevBFI !== 0) {
      /* testEnergy = 3*prevEnergy */
      testEnergy = sub(testEnergy, prevEnergy, pOverflow);
    }

    if (avgEnergy > testEnergy) {
      avgEnergy = testEnergy;
    }

    /* scaleFactor = avgEnergy/excEnergy in Q0 */
    exp = norm_s(excEnergy);
    excEnergy = shl(excEnergy, exp, pOverflow);
    excEnergy = div_s(16383, excEnergy);
    t0 = L_mult(avgEnergy, excEnergy, pOverflow);
    t0 = L_shr(t0, sub(20, exp, pOverflow), pOverflow); /* 20 for Q10 */
    if (t0 > 32767) {
      t0 = 32767; /* saturate */
    }
    scaleFactor = (t0 << 16) >> 16;

    /* test if scaleFactor > 3.0 */
    if (carefulFlag !== 0 && scaleFactor > 3072) {
      scaleFactor = 3072;
    }

    /* scale the excitation by scaleFactor */
    for (let i = 0; i < L_SUBFR; i++) {
      t0 = L_mult(scaleFactor, excitation[excitationOff + i], pOverflow);
      t0 = L_shr(t0, 11, pOverflow);
      excitation[excitationOff + i] = (t0 << 16) >> 16;
    }
  }
  return 0;
}
