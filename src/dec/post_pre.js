/*
 * Pre/post processing helpers, ported from opencore-amr 0.1.6 dec/src:
 *   preemph.cpp (preemphasisState, preemphasis),
 *   post_pro.cpp (Post_ProcessState, Post_Process),
 *   a_refl.cpp (A_Refl),
 *   b_cn_cod.cpp (pseudonoise, build_CN_code, build_CN_param)
 * Active implementations transcribed line by line.
 */
import {
  MAX_32, mult, sub, shl, add_16, abs_s, norm_l, pv_round, div_s,
  L_mult, L_mac, L_msu, L_add, L_sub, L_shl, L_shr_r,
} from '../common/basicop.js';
import { M, L_SUBFR } from '../common/cnst.js';
import { window_200_40 } from '../common/tables/index.js';

/** preemph.h preemphasisState */
export class preemphasisState {
  constructor() {
    this.mem_pre = 0;
  }

  reset() {
    this.mem_pre = 0; /* preemphasis filter state */
    return 0;
  }
}

/** preemph.cpp preemphasis */
export function preemphasis(st, signal, signalOff, g, L, pOverflow) {
  let temp2;

  let p1 = signalOff + L - 1;
  let p2 = p1 - 1;
  const temp = signal[p1];

  for (let i = 0; i <= L - 2; i++) {
    temp2 = mult(g, signal[p2--], pOverflow);
    signal[p1] = sub(signal[p1], temp2, pOverflow);
    p1--;
  }

  temp2 = mult(g, st.mem_pre, pOverflow);
  signal[p1] = sub(signal[p1], temp2, pOverflow);

  st.mem_pre = temp;
}

/* post_pro.cpp HP filter coefficients */
const pp_b = Int16Array.from([7699, -15398, 7699]);
const pp_a = Int16Array.from([8192, 15836, -7667]);

/** post_pro.h Post_ProcessState */
export class Post_ProcessState {
  constructor() {
    this.y2_hi = 0;
    this.y2_lo = 0;
    this.y1_hi = 0;
    this.y1_lo = 0;
    this.x0 = 0;
    this.x1 = 0;
  }

  /** post_pro.cpp Post_Process_reset */
  reset() {
    this.y2_hi = 0;
    this.y2_lo = 0;
    this.y1_hi = 0;
    this.y1_lo = 0;
    this.x0 = 0;
    this.x1 = 0;
    return 0;
  }
}

/** post_pro.cpp Post_Process: HP filter + upscaling of output speech */
export function Post_Process(st, signal, signalOff, lg, pOverflow) {
  let x2;
  let L_tmp;
  const c_a1 = pp_a[1];
  const c_a2 = pp_a[2];
  const c_b0 = pp_b[0];
  const c_b1 = pp_b[1];
  const c_b2 = pp_b[2];

  let p = signalOff;
  for (let i = 0; i < lg; i++) {
    x2 = st.x1;
    st.x1 = st.x0;
    st.x0 = signal[p];

    /* y[i] = b[0]*x[i]*2 + b[1]*x[i-1]*2 + b[2]*x[i-2]/2
              + a[1]*y[i-1] + a[2]*y[i-2]; */
    L_tmp = st.y1_hi * c_a1;
    L_tmp += (st.y1_lo * c_a1) >> 15;
    L_tmp += st.y2_hi * c_a2;
    L_tmp += (st.y2_lo * c_a2) >> 15;
    L_tmp += st.x0 * c_b0;
    L_tmp += st.x1 * c_b1;
    L_tmp += x2 * c_b2;
    L_tmp = L_tmp | 0; /* normalize the wrapped Word32 sum before L_shl */
    L_tmp = L_shl(L_tmp, 3, pOverflow);

    /* Multiplication by two of output speech with saturation. */
    signal[p++] = pv_round(L_shl(L_tmp, 1, pOverflow), pOverflow);

    st.y2_hi = st.y1_hi;
    st.y2_lo = st.y1_lo;
    st.y1_hi = ((L_tmp >> 16) << 16) >> 16;
    st.y1_lo = (((L_tmp >> 1) - (st.y1_hi << 15)) << 16) >> 16;
  }
}

const aReflAState = new Int16Array(M);
const aReflBState = new Int16Array(M);

/** a_refl.cpp A_Refl: convert direct-form coefficients to reflection coeffs */
export function A_Refl(a, aOff, refl, reflOff, pOverflow) {
  const aState = aReflAState;
  const bState = aReflBState;
  let normShift;
  let normProd;
  let L_acc;
  let scale;
  let L_temp;
  let temp;
  let multFac;

  /* initialize states */
  for (let i = 0; i < M; i++) {
    aState[i] = a[aOff + i];
  }

  /* backward Levinson recursion */
  for (let i = M - 1; i >= 0; i--) {
    if (abs_s(aState[i]) >= 4096) {
      for (let j = 0; j < M; j++) {
        refl[reflOff + j] = 0;
      }
      break;
    }

    refl[reflOff + i] = shl(aState[i], 3, pOverflow);

    L_temp = L_mult(refl[reflOff + i], refl[reflOff + i], pOverflow);
    L_acc = L_sub(MAX_32, L_temp, pOverflow);

    normShift = norm_l(L_acc);
    scale = (15 - normShift) << 16 >> 16;
    L_acc = L_shl(L_acc, normShift, pOverflow);

    normProd = pv_round(L_acc, pOverflow);
    multFac = div_s(16384, normProd);

    let aborted = false;
    for (let j = 0; j < i; j++) {
      L_acc = aState[j] << 16;
      L_acc = L_msu(L_acc, refl[reflOff + i], aState[i - j - 1], pOverflow);

      temp = pv_round(L_acc, pOverflow);
      L_temp = L_mult(multFac, temp, pOverflow);
      L_temp = L_shr_r(L_temp, scale, pOverflow);

      let L_tmp_abs = (L_temp - (L_temp < 0 ? 1 : 0)) | 0;
      L_tmp_abs = L_tmp_abs ^ (L_tmp_abs >> 31);
      if (L_tmp_abs > 32767) {
        for (let k = 0; k < M; k++) {
          refl[reflOff + k] = 0;
        }
        aborted = true;
        break;
      }

      bState[j] = (L_temp << 16) >> 16;
    }
    if (aborted) {
      break;
    }

    for (let j = 0; j < i; j++) {
      aState[j] = bState[j];
    }
  }
}

const NB_PULSE_DTX = 10; /* number of random pulses in DTX operation */

/**
 * b_cn_cod.cpp pseudonoise.
 * @param {Int32Array} pShift_reg 1-element in/out CN generator state
 */
export function pseudonoise(pShift_reg, no_bits) {
  let noise_bits = 0;
  let Sn;
  let temp;

  for (let i = 0; i < no_bits; i++) {
    /* State n == 31 */
    if ((pShift_reg[0] & 0x00000001) !== 0) {
      Sn = 1;
    } else {
      Sn = 0;
    }
    /* State n == 3 */
    if ((pShift_reg[0] & 0x10000000) !== 0) {
      Sn ^= 1;
    } else {
      Sn ^= 0;
    }

    noise_bits = (noise_bits << 1) << 16 >> 16;
    temp = (pShift_reg[0] & 1) << 16 >> 16;
    noise_bits = (noise_bits | temp) << 16 >> 16;

    pShift_reg[0] = pShift_reg[0] >> 1;
    if (Sn & 1) {
      pShift_reg[0] = pShift_reg[0] | 0x40000000;
    }
  }
  return noise_bits;
}

/**
 * b_cn_cod.cpp build_CN_code.
 * @param {Int32Array} pSeed 1-element in/out CN generator state
 */
export function build_CN_code(pSeed, cod, codOff, pOverflow) {
  let i, j, temp;

  for (i = 0; i < L_SUBFR; i++) {
    cod[codOff + i] = 0;
  }

  for (let k = 0; k < NB_PULSE_DTX; k++) {
    i = pseudonoise(pSeed, 2); /* generate pulse position */
    temp = (L_mult(i, 10, pOverflow) << 16) >> 16;
    i = temp >> 1;
    i = add_16(i, k, pOverflow);

    j = pseudonoise(pSeed, 1); /* generate sign */
    if (j > 0) {
      cod[codOff + i] = 4096;
    } else {
      cod[codOff + i] = -4096;
    }
  }
}

/**
 * b_cn_cod.cpp build_CN_param.
 * @param {Int16Array} pSeed 1-element in/out (Word16 seed!)
 */
export function build_CN_param(pSeed, n_param, param_size_table, parm, parmOff, pOverflow) {
  let L_temp;
  let temp;

  L_temp = L_mult(pSeed[0], 31821, pOverflow);
  L_temp = L_temp >> 1;
  pSeed[0] = (L_add(L_temp, 13849, pOverflow) << 16) >> 16;

  let pTemp = pSeed[0] & 0x7f; /* index into window_200_40 */

  for (let i = 0; i < n_param; i++) {
    temp = (~(0xffff << param_size_table[i])) << 16 >> 16;
    parm[parmOff + i] = window_200_40[pTemp++] & temp;
  }
}
