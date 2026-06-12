/*
 * Codebook gain averaging, ported from opencore-amr 0.1.6 dec/src/c_g_aver.cpp.
 * Active implementation transcribed line by line.
 */
import {
  sub, shl, shr, add_16, abs_s, norm_s, negate, div_s, pv_round,
  L_mult, L_mac, L_msu, L_shl,
} from '../common/basicop.js';
import { M, MR475, MR515, MR59, MR67, MR102 } from '../common/cnst.js';

const L_CBGAINHIST = 7;

/** c_g_aver.h Cb_gain_averageState */
export class Cb_gain_averageState {
  constructor() {
    this.cbGainHistory = new Int16Array(L_CBGAINHIST);
    this.hangVar = 0;
    this.hangCount = 0;
  }

  /** c_g_aver.cpp Cb_gain_average_reset */
  reset() {
    this.cbGainHistory.fill(0);
    this.hangVar = 0;
    this.hangCount = 0;
    return 0;
  }
}

const cgTmp = new Int16Array(M);

/** c_g_aver.cpp Cb_gain_average: returns smoothed cb gain (Q1) */
export function Cb_gain_average(st, mode, gain_code, lsp, lspOff,
  lspAver, lspAverOff, bfi, prev_bf, pdfi, prev_pdf, inBackgroundNoise,
  voicedHangover, pOverflow) {
  let cbGainMix;
  let diff;
  let tmp_diff;
  let bgMix;
  let cbGainMean;
  let L_sum;
  const tmp = cgTmp;
  let tmp1;
  let tmp2;
  let shift1;
  let shift2;
  let shift;

  /* set correct cbGainMix for MR74, MR795, MR122 */
  cbGainMix = gain_code;

  /* Store list of CB gain needed in the CB gain averaging */
  for (let i = 0; i < L_CBGAINHIST - 1; i++) {
    st.cbGainHistory[i] = st.cbGainHistory[i + 1];
  }
  st.cbGainHistory[L_CBGAINHIST - 1] = gain_code;

  diff = 0;
  /* compute lsp difference */
  for (let i = 0; i < M; i++) {
    tmp1 = abs_s(sub(lspAver[lspAverOff + i], lsp[lspOff + i], pOverflow)); /* Q15 */
    shift1 = (norm_s(tmp1) - 1) << 16 >> 16;            /* Qn */
    tmp1 = shl(tmp1, shift1, pOverflow);                /* Q15+Qn */
    shift2 = norm_s(lspAver[lspAverOff + i]);           /* Qm */
    tmp2 = shl(lspAver[lspAverOff + i], shift2, pOverflow); /* Q15+Qm */
    tmp[i] = div_s(tmp1, tmp2); /* Q15+(Q15+Qn)-(Q15+Qm) */

    shift = (2 + shift1 - shift2) << 16 >> 16;
    if (shift >= 0) {
      tmp[i] = shr(tmp[i], shift, pOverflow); /* Q15+Qn-Qm-Qx=Q13 */
    } else {
      tmp[i] = shl(tmp[i], negate(shift), pOverflow);
    }

    diff = add_16(diff, tmp[i], pOverflow); /* Q13 */
  }

  /* Compute hangover */
  if (diff > 5325) {
    /* 0.65 in Q11 */
    st.hangVar += 1;
  } else {
    st.hangVar = 0;
  }

  if (st.hangVar > 10) {
    /* Speech period, reset hangover variable */
    st.hangCount = 0;
  }

  /* Compute mix constant (bgMix) */
  bgMix = 8192; /* 1 in Q13 */
  if (mode <= MR67 || mode === MR102) {
    /* MR475, MR515, MR59, MR67, MR102 */
    /* if errors and presumed noise make smoothing probability stronger */
    if (((pdfi !== 0 && prev_pdf !== 0) || bfi !== 0 || prev_bf !== 0)
      && voicedHangover > 1
      && inBackgroundNoise !== 0
      && (mode === MR475 || mode === MR515 || mode === MR59)) {
      /* bgMix = min(0.25, max(0.0, diff-0.55)) / 0.25; */
      tmp_diff = (diff - 4506) << 16 >> 16; /* 0.55 in Q13 */
    } else {
      /* bgMix = min(0.25, max(0.0, diff-0.40)) / 0.25; */
      tmp_diff = (diff - 3277) << 16 >> 16; /* 0.4 in Q13 */
    }

    /* max(0.0, diff-0.55) or max(0.0, diff-0.40) */
    tmp1 = tmp_diff > 0 ? tmp_diff : 0;

    /* min(0.25, tmp1) */
    if (tmp1 > 2048) {
      bgMix = 8192;
    } else {
      bgMix = shl(tmp1, 2, pOverflow);
    }

    if (st.hangCount < 40 || diff > 5325) {
      /* 0.65 in Q13: disable mix if too short time since */
      bgMix = 8192;
    }

    /* Smoothen the cb gain trajectory; smoothing depends on bgMix */
    L_sum = L_mult(6554, st.cbGainHistory[2], pOverflow); /* 0.2 in Q15 */
    for (let i = 3; i < L_CBGAINHIST; i++) {
      L_sum = L_mac(L_sum, 6554, st.cbGainHistory[i], pOverflow);
    }
    cbGainMean = pv_round(L_sum, pOverflow); /* Q1 */

    /* more smoothing in error and bg noise (NB no DFI used here) */
    if ((bfi !== 0 || prev_bf !== 0) && inBackgroundNoise !== 0
      && (mode === MR475 || mode === MR515 || mode === MR59)) {
      /* 0.143 in Q15 */
      L_sum = L_mult(4681, st.cbGainHistory[0], pOverflow);
      for (let i = 1; i < L_CBGAINHIST; i++) {
        L_sum = L_mac(L_sum, 4681, st.cbGainHistory[i], pOverflow);
      }
      cbGainMean = pv_round(L_sum, pOverflow); /* Q1 */
    }

    /* cbGainMix = bgMix*cbGainMix + (1-bgMix)*cbGainMean; L_sum in Q15 */
    L_sum = L_mult(bgMix, cbGainMix, pOverflow);
    L_sum = L_mac(L_sum, 8192, cbGainMean, pOverflow);
    L_sum = L_msu(L_sum, bgMix, cbGainMean, pOverflow);
    cbGainMix = pv_round(L_shl(L_sum, 2, pOverflow), pOverflow); /* Q1 */
  }

  st.hangCount += 1;
  return cbGainMix;
}
