/*
 * Open-loop pitch search, ported from opencore-amr 0.1.6 enc/src:
 *   calc_cor.cpp (comp_corr), pitch_ol.cpp (Lag_max, Pitch_ol),
 *   hp_max.cpp (hp_max), p_ol_wgh.cpp (pitchOLWghtState, Lag_max wgh variant,
 *   Pitch_ol_wgh), ol_ltp.cpp (ol_ltp), ton_stab.cpp (tonStabState,
 *   check_lsp, check_gp_clipping, update_gp_clipping)
 * Active implementations transcribed line by line.
 */
import {
  MAX_32, MIN_32, MAX_16, MIN_16, sub, add_16, shl, shr, negate, div_s,
  norm_l, pv_round, L_mac, L_msu, L_add, L_sub, L_shl, L_shr,
  Mpy_32, Mpy_32_16, amrnb_fxp_mac_16_by_16bb,
} from '../common/basicop.js';
import { L_abs, L_Extract } from '../common/oper32b.js';
import { Inv_sqrt, gmed_n } from '../common/mathops.js';
import {
  M, N_FRAME, GP_CLIP, L_FRAME, L_FRAME_BY2, PIT_MIN, PIT_MAX, PIT_MIN_MR122,
  MR475, MR515, MR795, MR102, MR122,
} from '../common/cnst.js';
import { corrweight } from '../common/tables/index.js';
import {
  vad_tone_detection, vad_tone_detection_update, vad_complex_detection_update,
} from './vad1.js';

const THRESHOLD = 27853;

/** calc_cor.cpp comp_corr: corr is Int32Array cell view (arr, ptrOff) */
export function comp_corr(scal_sig, sigOff, L_frame, lag_max, lag_min, corr, corrOff) {
  let t1, t2, t3, t4;

  let pCorr = corrOff - lag_max;
  let pScal = sigOff - lag_max;

  for (let i = ((lag_max - lag_min) >> 2) + 1; i > 0; i--) {
    t1 = 0;
    t2 = 0;
    t3 = 0;
    t4 = 0;
    let p = sigOff;
    let p1 = pScal++;
    pScal++;
    let p2 = pScal++;
    pScal++;

    for (let j = L_frame >> 1; j !== 0; j--) {
      t1 = amrnb_fxp_mac_16_by_16bb(scal_sig[p], scal_sig[p1++], t1);
      t2 = amrnb_fxp_mac_16_by_16bb(scal_sig[p], scal_sig[p1], t2);
      t3 = amrnb_fxp_mac_16_by_16bb(scal_sig[p], scal_sig[p2++], t3);
      t4 = amrnb_fxp_mac_16_by_16bb(scal_sig[p++], scal_sig[p2], t4);
      t1 = amrnb_fxp_mac_16_by_16bb(scal_sig[p], scal_sig[p1++], t1);
      t2 = amrnb_fxp_mac_16_by_16bb(scal_sig[p], scal_sig[p1], t2);
      t3 = amrnb_fxp_mac_16_by_16bb(scal_sig[p], scal_sig[p2++], t3);
      t4 = amrnb_fxp_mac_16_by_16bb(scal_sig[p++], scal_sig[p2], t4);
    }
    corr[pCorr++] = t1 << 1;
    corr[pCorr++] = t2 << 1;
    corr[pCorr++] = t3 << 1;
    corr[pCorr++] = t4 << 1;
  }
}

/** pitch_ol.cpp Lag_max (static) */
function Lag_max_ol(vadSt, corr, corrOff, scal_sig, sigOff, scal_fac, scal_flag,
  L_frame, lag_max, lag_min, cor_max, dtx, pOverflow) {
  let max;
  let t0;
  let max_h;
  let max_l;
  let ener_h;
  let ener_l;
  let p_max;
  let L_temp;
  let L_temp_2;
  let L_temp_3;

  let pCorr = corrOff - lag_max;
  max = MIN_32;
  p_max = lag_max;

  for (let i = lag_max; i >= lag_min; i--) {
    if (corr[pCorr] >= max) {
      max = corr[pCorr];
      p_max = i;
    }
    pCorr++;
  }

  /* compute energy */
  t0 = 0;
  let p = sigOff - p_max;
  for (let i = L_frame >> 2; i !== 0; i--) {
    t0 = amrnb_fxp_mac_16_by_16bb(scal_sig[p], scal_sig[p], t0);
    p++;
    t0 = amrnb_fxp_mac_16_by_16bb(scal_sig[p], scal_sig[p], t0);
    p++;
    t0 = amrnb_fxp_mac_16_by_16bb(scal_sig[p], scal_sig[p], t0);
    p++;
    t0 = amrnb_fxp_mac_16_by_16bb(scal_sig[p], scal_sig[p], t0);
    p++;
  }
  t0 = t0 << 1;

  /* 1/sqrt(energy) */
  if (dtx) {
    /* check tone */
    vad_tone_detection(vadSt, max, t0, pOverflow);
  }

  t0 = Inv_sqrt(t0, pOverflow);

  if (scal_flag) {
    if (t0 > 0x3fffffff) {
      t0 = MAX_32;
    } else {
      t0 = t0 << 1;
    }
  }

  /* max = max/sqrt(energy) — inlined L_Extract pairs */
  max_h = ((max >> 16) << 16) >> 16;
  L_temp_2 = max >> 1;
  L_temp_3 = max_h << 15;
  L_temp = (L_temp_2 - L_temp_3) | 0;
  max_l = (L_temp << 16) >> 16;

  ener_h = ((t0 >> 16) << 16) >> 16;
  L_temp_2 = t0 >> 1;
  L_temp_3 = ener_h << 15;
  L_temp = (L_temp_2 - L_temp_3) | 0;
  ener_l = (L_temp << 16) >> 16;

  t0 = Mpy_32(max_h, max_l, ener_h, ener_l, pOverflow);

  if (scal_flag) {
    t0 = L_shr(t0, scal_fac, pOverflow);
    if (t0 > 0x0000ffff) {
      cor_max[0] = MAX_16;
    } else if (t0 < (0xffff0000 | 0)) {
      cor_max[0] = MIN_16;
    } else {
      cor_max[0] = ((t0 >> 1) << 16) >> 16;
    }
  } else {
    cor_max[0] = (t0 << 16) >> 16;
  }

  return p_max;
}

const poCorr = new Int32Array(PIT_MAX + 1);
const poScaled = new Int16Array(L_FRAME + PIT_MAX);
const poMax1 = new Int16Array(1);
const poMax2 = new Int16Array(1);
const poMax3 = new Int16Array(1);
const poCorrHpMax = new Int16Array(1);

/** pitch_ol.cpp Pitch_ol: signal[sigOff-pit_max .. sigOff+L_frame-1] known */
export function Pitch_ol(vadSt, mode, signal, sigOff, pit_min, pit_max,
  L_frame, idx, dtx, pOverflow) {
  let i, j;
  let max1;
  let p_max1, p_max2, p_max3;
  let scal_flag = 0;
  let t0;
  const corr = poCorr;
  const scaled_signal = poScaled;
  let scal_fac;
  let L_temp;

  if (dtx) {
    /* update tone detection */
    if (mode === MR475 || mode === MR515) {
      vad_tone_detection_update(vadSt, 1, pOverflow);
    } else {
      vad_tone_detection_update(vadSt, 0, pOverflow);
    }
  }

  t0 = 0;
  let pSig = sigOff - pit_max;
  for (i = -pit_max; i < L_frame; i++) {
    t0 = (t0 + ((signal[pSig] * signal[pSig]) << 1)) | 0;
    pSig++;
    if (t0 < 0) {
      t0 = MAX_32;
      break;
    }
  }

  /* Scaling of input signal:
       if Overflow       -> scal_sig[i] = signal[i] >> 3
       else if t0 < 2^20 -> scal_sig[i] = signal[i] << 3
       else              -> scal_sig[i] = signal[i] */
  let pScal = 0;
  pSig = sigOff - pit_max;
  if (t0 === MAX_32) {
    /* Test for overflow */
    for (i = (pit_max + L_frame) >> 1; i !== 0; i--) {
      scaled_signal[pScal++] = signal[pSig++] >> 3;
      scaled_signal[pScal++] = signal[pSig++] >> 3;
    }
    if ((pit_max + L_frame) & 1) {
      scaled_signal[pScal] = signal[pSig] >> 3;
    }
    scal_fac = 3;
  } else if (t0 < 1048576) {
    /* if (t0 < 2^20) */
    for (i = (pit_max + L_frame) >> 1; i !== 0; i--) {
      scaled_signal[pScal++] = signal[pSig++] << 3;
      scaled_signal[pScal++] = signal[pSig++] << 3;
    }
    if ((pit_max + L_frame) & 1) {
      scaled_signal[pScal] = signal[pSig] << 3;
    }
    scal_fac = -3;
  } else {
    for (i = 0; i < L_frame + pit_max; i++) {
      scaled_signal[i] = signal[sigOff - pit_max + i];
    }
    scal_fac = 0;
  }

  /* calculate all correlations of scal_sig, from pit_min to pit_max */
  const corrPtr = pit_max; /* &corr[pit_max] */
  const scalPtr = pit_max; /* &scaled_signal[pit_max] */
  comp_corr(scaled_signal, scalPtr, L_frame, pit_max, pit_min, corr, corrPtr);

  /* mode dependent scaling in Lag_max */
  scal_flag = mode === MR122 ? 1 : 0;

  L_temp = pit_min << 2;
  if (L_temp !== ((L_temp << 16) >> 16)) {
    pOverflow[0] = 1;
    j = pit_min > 0 ? MAX_16 : MIN_16;
  } else {
    j = (L_temp << 16) >> 16;
  }
  p_max1 = Lag_max_ol(vadSt, corr, corrPtr, scaled_signal, scalPtr, scal_fac,
    scal_flag, L_frame, pit_max, j, poMax1, dtx, pOverflow);
  i = (j - 1) << 16 >> 16;
  j = pit_min << 1;
  p_max2 = Lag_max_ol(vadSt, corr, corrPtr, scaled_signal, scalPtr, scal_fac,
    scal_flag, L_frame, i, j, poMax2, dtx, pOverflow);
  i = (j - 1) << 16 >> 16;
  p_max3 = Lag_max_ol(vadSt, corr, corrPtr, scaled_signal, scalPtr, scal_fac,
    scal_flag, L_frame, i, pit_min, poMax3, dtx, pOverflow);

  if (dtx) {
    if (idx === 1) {
      /* calculate max high-passed filtered correlation of all lags */
      hp_max(corr, corrPtr, scaled_signal, scalPtr, L_frame, pit_max, pit_min,
        poCorrHpMax, pOverflow);
      /* update complex background detector */
      vad_complex_detection_update(vadSt, poCorrHpMax[0]);
    }
  }

  /* Compare the 3 sections maximum, and favor small lag */
  max1 = poMax1[0];
  i = ((max1 * THRESHOLD) >> 15) << 16 >> 16;
  if (i < poMax2[0]) {
    max1 = poMax2[0];
    p_max1 = p_max2;
  }
  i = ((max1 * THRESHOLD) >> 15) << 16 >> 16;
  if (i < poMax3[0]) {
    p_max1 = p_max3;
  }
  return p_max1;
}

/**
 * hp_max.cpp hp_max.
 * @param {Int16Array} cor_hp_max 1-element out
 */
export function hp_max(corr, corrOff, scal_sig, sigOff, L_frame, lag_max,
  lag_min, cor_hp_max, pOverflow) {
  let max, t0, t1;
  let max16, t016, cor_max;
  let shift, shift1, shift2;
  let L_temp;

  max = MIN_32;
  t0 = 0;

  for (let i = lag_max - 1; i > lag_min; i--) {
    /* high-pass filtering */
    t0 = L_shl(corr[corrOff - i], 1, pOverflow);
    L_temp = L_sub(t0, corr[corrOff - i - 1], pOverflow);
    t0 = L_sub(L_temp, corr[corrOff - i + 1], pOverflow);
    t0 = L_abs(t0);

    if (t0 >= max) {
      max = t0;
    }
  }

  /* compute energy */
  t0 = 0;
  for (let i = 0; i < L_frame; i++) {
    t0 = L_mac(t0, scal_sig[sigOff + i], scal_sig[sigOff + i], pOverflow);
  }
  t1 = 0;
  for (let i = 0; i < L_frame; i++) {
    t1 = L_mac(t1, scal_sig[sigOff + i], scal_sig[sigOff + i - 1], pOverflow);
  }

  /* high-pass filtering */
  L_temp = L_shl(t0, 1, pOverflow);
  t1 = L_shl(t1, 1, pOverflow);
  t0 = L_sub(L_temp, t1, pOverflow);
  t0 = L_abs(t0);

  /* max/t0 */
  t016 = norm_l(max);
  shift1 = (t016 - 1) << 16 >> 16;
  L_temp = L_shl(max, shift1, pOverflow);
  max16 = ((L_temp >> 16) << 16) >> 16;

  shift2 = norm_l(t0);
  L_temp = L_shl(t0, shift2, pOverflow);
  t016 = ((L_temp >> 16) << 16) >> 16;

  if (t016 !== 0) {
    cor_max = div_s(max16, t016);
  } else {
    cor_max = 0;
  }

  shift = (shift1 - shift2) << 16 >> 16;
  if (shift >= 0) {
    cor_hp_max[0] = shr(cor_max, shift, pOverflow); /* Q15 */
  } else {
    cor_hp_max[0] = shl(cor_max, negate(shift), pOverflow); /* Q15 */
  }
  return 0;
}

/** common/include/p_ol_wgh.h pitchOLWghtState */
export class pitchOLWghtState {
  constructor() {
    this.old_T0_med = 0;
    this.ada_w = 0;
    this.wght_flg = 0;
    this.reset();
  }

  /** p_ol_wgh.cpp p_ol_wgh_reset */
  reset() {
    this.old_T0_med = 40;
    this.ada_w = 0;
    this.wght_flg = 0;
    return 0;
  }
}

const pwT0h = new Int16Array(1);
const pwT0l = new Int16Array(1);

/** p_ol_wgh.cpp Lag_max (static, weighted variant) */
function Lag_max_wgh(vadSt, corr, corrOff, scal_sig, sigOff, L_frame,
  lag_max, lag_min, old_lag, cor_max, wght_flg, gain_flg, gainFlgOff,
  dtx, pOverflow) {
  let max;
  let t0;
  let p_max;
  let t1;
  let temp;

  let ww = 250;                       /* &corrweight[250] */
  let we = 123 + lag_max - old_lag;   /* &corrweight[123 + lag_max - old_lag] */

  max = MIN_32;
  p_max = lag_max;

  for (let i = lag_max; i >= lag_min; i--) {
    t0 = corr[corrOff - i];

    /* Weighting of the correlation function. */
    L_Extract(corr[corrOff - i], pwT0h, pwT0l, pOverflow);
    t0 = Mpy_32_16(pwT0h[0], pwT0l[0], corrweight[ww], pOverflow);
    ww--;

    if (wght_flg > 0) {
      /* Weight the neighbourhood of the old lag. */
      L_Extract(t0, pwT0h, pwT0l, pOverflow);
      t0 = Mpy_32_16(pwT0h[0], pwT0l[0], corrweight[we], pOverflow);
      we--;
    }

    if (t0 >= max) {
      max = t0;
      p_max = i;
    }
  }

  let p = sigOff;
  let p1 = sigOff - p_max;
  t0 = 0;
  t1 = 0;

  for (let j = 0; j < L_frame; j++, p++, p1++) {
    t0 = L_mac(t0, scal_sig[p], scal_sig[p1], pOverflow);
    t1 = L_mac(t1, scal_sig[p1], scal_sig[p1], pOverflow);
  }

  if (dtx) {
    /* update and detect tone */
    vad_tone_detection_update(vadSt, 0, pOverflow);
    vad_tone_detection(vadSt, t0, t1, pOverflow);
  }

  /* gain flag is set according to the open_loop gain */
  /* is t2/t1 > 0.4 ? */
  temp = pv_round(t1, pOverflow);
  t1 = L_msu(t0, temp, 13107, pOverflow);
  gain_flg[gainFlgOff] = pv_round(t1, pOverflow);

  cor_max[0] = 0;
  return p_max;
}

const pwMax1 = new Int16Array(1);

/** p_ol_wgh.cpp Pitch_ol_wgh (MR102) */
export function Pitch_ol_wgh(st, vadSt, signal, sigOff, pit_min, pit_max,
  L_frame, old_lags, ol_gain_flg, idx, dtx, pOverflow) {
  let i;
  let p_max1;
  let t0;
  const corr = poCorr;
  const scaled_signal = poScaled;
  const scalPtr = pit_max; /* &scaled_signal[pit_max] */

  t0 = 0;
  for (i = -pit_max; i < L_frame; i++) {
    t0 = L_mac(t0, signal[sigOff + i], signal[sigOff + i], pOverflow);
  }

  /* Scaling of input signal */
  if (L_sub(t0, MAX_32, pOverflow) === 0) {
    /* Test for overflow */
    for (i = -pit_max; i < L_frame; i++) {
      scaled_signal[scalPtr + i] = shr(signal[sigOff + i], 3, pOverflow);
    }
  } else if (L_sub(t0, 1048576, pOverflow) < 0) {
    for (i = -pit_max; i < L_frame; i++) {
      scaled_signal[scalPtr + i] = shl(signal[sigOff + i], 3, pOverflow);
    }
  } else {
    for (i = -pit_max; i < L_frame; i++) {
      scaled_signal[scalPtr + i] = signal[sigOff + i];
    }
  }

  /* calculate all correlations of scal_sig, from pit_min to pit_max */
  const corrPtr = pit_max;
  comp_corr(scaled_signal, scalPtr, L_frame, pit_max, pit_min, corr, corrPtr);

  p_max1 = Lag_max_wgh(vadSt, corr, corrPtr, scaled_signal, scalPtr, L_frame,
    pit_max, pit_min, st.old_T0_med, pwMax1, st.wght_flg,
    ol_gain_flg, idx, dtx, pOverflow);

  if (ol_gain_flg[idx] > 0) {
    /* Calculate 5-point median of previous lags */
    for (i = 4; i > 0; i--) {
      old_lags[i] = old_lags[i - 1];
    }
    old_lags[0] = p_max1;
    st.old_T0_med = gmed_n(old_lags, 0, 5);
    st.ada_w = 32767; /* Q15 = 1.0 */
  } else {
    st.old_T0_med = p_max1;
    /* ada_w = ada_w * 0.9 */
    st.ada_w = ((st.ada_w * 29491) >> 15) << 16 >> 16;
  }

  if (sub(st.ada_w, 9830, pOverflow) < 0) {
    /* ada_w - 0.3 */
    st.wght_flg = 0;
  } else {
    st.wght_flg = 1;
  }

  if (dtx) {
    if (sub(idx, 1, pOverflow) === 0) {
      /* calculate max high-passed filtered correlation of all lags */
      hp_max(corr, corrPtr, scaled_signal, scalPtr, L_frame, pit_max, pit_min,
        poCorrHpMax, pOverflow);
      /* update complex background detector */
      vad_complex_detection_update(vadSt, poCorrHpMax[0]);
    }
  }

  return p_max1;
}

/**
 * ol_ltp.cpp ol_ltp.
 * @param {Int16Array} T_op 1-element out
 */
export function ol_ltp(st, vadSt, mode, wsp, wspOff, T_op, old_lags,
  ol_gain_flg, idx, dtx, pOverflow) {
  if (mode !== MR102) {
    ol_gain_flg[0] = 0;
    ol_gain_flg[1] = 0;
  }

  if (mode === MR475 || mode === MR515) {
    T_op[0] = Pitch_ol(vadSt, mode, wsp, wspOff, PIT_MIN, PIT_MAX, L_FRAME,
      idx, dtx, pOverflow);
  } else if (mode <= MR795) {
    T_op[0] = Pitch_ol(vadSt, mode, wsp, wspOff, PIT_MIN, PIT_MAX,
      L_FRAME_BY2, idx, dtx, pOverflow);
  } else if (mode === MR102) {
    T_op[0] = Pitch_ol_wgh(st, vadSt, wsp, wspOff, PIT_MIN, PIT_MAX,
      L_FRAME_BY2, old_lags, ol_gain_flg, idx, dtx, pOverflow);
  } else {
    T_op[0] = Pitch_ol(vadSt, mode, wsp, wspOff, PIT_MIN_MR122, PIT_MAX,
      L_FRAME_BY2, idx, dtx, pOverflow);
  }
}

/** ton_stab.h tonStabState */
export class tonStabState {
  constructor() {
    this.count = 0;
    this.gp = new Int16Array(N_FRAME); /* gain history Q11 */
  }

  /** ton_stab.cpp ton_stab_reset */
  reset() {
    this.count = 0;
    this.gp.fill(0);
    return 0;
  }
}

/** ton_stab.cpp check_lsp (pOverflow intentionally unused) */
export function check_lsp(st, lsp, lspOff, pOverflow) {
  let dist;
  let dist_min1;
  let dist_min2;
  let dist_th;

  /* Check for a resonance: find min distance between lsp[i] and lsp[i+1] */
  dist_min1 = MAX_16;
  for (let i = 3; i < M - 2; i++) {
    dist = (lsp[lspOff + i] - lsp[lspOff + i + 1]) << 16 >> 16;
    if (dist < dist_min1) {
      dist_min1 = dist;
    }
  }

  dist_min2 = MAX_16;
  for (let i = 1; i < 3; i++) {
    dist = (lsp[lspOff + i] - lsp[lspOff + i + 1]) << 16 >> 16;
    if (dist < dist_min2) {
      dist_min2 = dist;
    }
  }

  if (lsp[lspOff + 1] > 32000) {
    dist_th = 600;
  } else if (lsp[lspOff + 1] > 30500) {
    dist_th = 800;
  } else {
    dist_th = 1100;
  }

  if (dist_min1 < 1500 || dist_min2 < dist_th) {
    st.count++;
  } else {
    st.count = 0;
  }

  /* Need 12 consecutive frames to set the flag */
  if (st.count >= 12) {
    st.count = 12;
    return 1;
  }
  return 0;
}

/** ton_stab.cpp check_gp_clipping */
export function check_gp_clipping(st, g_pitch, pOverflow) {
  let sum = shr(g_pitch, 3, pOverflow); /* Division by 8 */
  for (let i = 0; i < N_FRAME; i++) {
    sum = add_16(sum, st.gp[i], pOverflow);
  }

  if (sub(sum, GP_CLIP, pOverflow) > 0) {
    return 1;
  }
  return 0;
}

/** ton_stab.cpp update_gp_clipping (pOverflow intentionally unused) */
export function update_gp_clipping(st, g_pitch, pOverflow) {
  for (let i = 0; i < N_FRAME - 1; i++) {
    st.gp[i] = st.gp[i + 1];
  }
  st.gp[N_FRAME - 1] = g_pitch >> 3;
}
