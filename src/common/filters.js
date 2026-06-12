/*
 * Filtering primitives, ported from opencore-amr 0.1.6 common/src:
 *   weight_a.cpp, residu.cpp, syn_filt.cpp, pred_lt.cpp
 * Active (OSCL_EXPORT_REF) implementations transcribed with pointer
 * arithmetic rewritten as (array, offset) index pairs.
 *
 * Word32 accumulators built with raw `+=` in C may exceed int32 here; that is
 * safe because all consumers (`>> n`, `| 0`) apply ToInt32, which equals the
 * C mod-2^32 wrap of the running sum. Unsigned-compare sites normalize first.
 */
import { MAX_16, MIN_16, amrnb_fxp_mac_16_by_16bb, amrnb_fxp_msu_16_by_16bb } from './basicop.js';
import { M } from './cnst.js';

const UP_SAMP_MAX = 6;
const L_INTER10 = 10; /* L_INTERPOL - 1 */

/* pred_lt.cpp: (1/6) resolution interpolation filter table (Word16) in Q15 */
export const inter_6_pred_lt = Int16Array.from([
  29443,
  28346, 25207, 20449, 14701, 8693, 3143,
  -1352, -4402, -5865, -5850, -4673, -2783,
  -672, 1211, 2536, 3130, 2991, 2259,
  1170, 0, -1001, -1652, -1868, -1666,
  -1147, -464, 218, 756, 1060, 1099,
  904, 550, 135, -245, -514, -634,
  -602, -451, -231, 0, 191, 308,
  340, 296, 198, 78, -36, -120,
  -163, -165, -132, -79, -19, 34,
  73, 91, 89, 70, 38, 0,
]);

/** weight_a.cpp Weight_Ai: a[M+1] -> a_exp[M+1] with spectral expansion fac[M] */
export function Weight_Ai(a, aOff, fac, facOff, a_exp, a_expOff) {
  a_exp[a_expOff] = a[aOff];
  for (let i = 1; i <= M; i++) {
    a_exp[a_expOff + i] =
      ((a[aOff + i] * fac[facOff + i - 1] + 0x00004000) >> 15) << 16 >> 16;
  }
}

/** residu.cpp Residu: LP residual, processes input_len samples (multiple of 4) */
export function Residu(coef, coefOff, input, inputOff, residual, residualOff, input_len) {
  let s1, s2, s3, s4;
  let pRes = residualOff + input_len - 1;
  let pIn = inputOff + input_len - 1 - M;

  for (let i = input_len >> 2; i !== 0; i--) {
    s1 = 0x0000800;
    s2 = 0x0000800;
    s3 = 0x0000800;
    s4 = 0x0000800;
    let pCoef = coefOff + M;
    let p1 = pIn--;
    let p2 = pIn--;
    let p3 = pIn--;
    let p4 = pIn--;

    for (let j = M >> 1; j !== 0; j--) {
      s1 += coef[pCoef] * input[p1++];
      s2 += coef[pCoef] * input[p2++];
      s3 += coef[pCoef] * input[p3++];
      s4 += coef[pCoef--] * input[p4++];
      s1 += coef[pCoef] * input[p1++];
      s2 += coef[pCoef] * input[p2++];
      s3 += coef[pCoef] * input[p3++];
      s4 += coef[pCoef--] * input[p4++];
    }
    s1 += coef[pCoef] * input[p1];
    s2 += coef[pCoef] * input[p2];
    s3 += coef[pCoef] * input[p3];
    s4 += coef[pCoef] * input[p4];

    residual[pRes--] = ((s1 >> 12) << 16) >> 16;
    residual[pRes--] = ((s2 >> 12) << 16) >> 16;
    residual[pRes--] = ((s3 >> 12) << 16) >> 16;
    residual[pRes--] = ((s4 >> 12) << 16) >> 16;
  }
}

const synTmp = new Int16Array(2 * M); /* C: Word16 tmp[2*M] scratch */

/** syn_filt.cpp Syn_filt: synthesis filter 1/A(z), lg samples (40) */
export function Syn_filt(a, aOff, x, xOff, y, yOff, lg, mem, memOff, update) {
  let s1, s2;
  let temp;
  const yy = synTmp;

  /* Copy mem[] to yy[] */
  for (let i = 0; i < M; i++) yy[i] = mem[memOff + i];
  let yyi = M;

  /* Do the filtering. */
  let pY = yOff;
  let pX = xOff;
  let pYY1 = yyi - 1; /* index into yy */

  for (let i = M >> 1; i !== 0; i--) {
    let pA = aOff;
    s1 = amrnb_fxp_mac_16_by_16bb(x[pX++], a[pA], 0x00000800);
    s2 = amrnb_fxp_mac_16_by_16bb(x[pX++], a[pA++], 0x00000800);
    s1 = amrnb_fxp_msu_16_by_16bb(a[pA++], yy[pYY1], s1);

    for (let j = (M >> 1) - 2; j !== 0; j--) {
      s2 = amrnb_fxp_msu_16_by_16bb(a[pA], yy[pYY1--], s2);
      s1 = amrnb_fxp_msu_16_by_16bb(a[pA++], yy[pYY1], s1);
      s2 = amrnb_fxp_msu_16_by_16bb(a[pA], yy[pYY1--], s2);
      s1 = amrnb_fxp_msu_16_by_16bb(a[pA++], yy[pYY1], s1);
      s2 = amrnb_fxp_msu_16_by_16bb(a[pA], yy[pYY1--], s2);
      s1 = amrnb_fxp_msu_16_by_16bb(a[pA++], yy[pYY1], s1);
    }

    /* check for overflow on s1 */
    if ((s1 + 134217728) >>> 0 < 0x0fffffff) {
      temp = ((s1 >> 12) << 16) >> 16;
    } else if (s1 > 0x07ffffff) {
      temp = MAX_16;
    } else {
      temp = MIN_16;
    }

    s2 = amrnb_fxp_msu_16_by_16bb(a[aOff + 1], temp, s2);

    yy[yyi++] = temp;
    y[pY++] = temp;
    pYY1 = yyi; /* C: p_yy1 = yy (next unwritten slot, filled by s2 below) */

    /* check for overflow on s2 */
    if ((s2 + 134217728) >>> 0 < 0x0fffffff) {
      temp = ((s2 >> 12) << 16) >> 16;
    } else if (s2 > 0x07ffffff) {
      temp = MAX_16;
    } else {
      temp = MIN_16;
    }
    yy[yyi++] = temp;
    y[pY++] = temp;
  }

  /* remaining samples read past outputs from y[] itself */
  let pYY1y = yOff + M - 1; /* index into y */
  for (let i = (lg - M) >> 1; i !== 0; i--) {
    let pA = aOff;
    s1 = amrnb_fxp_mac_16_by_16bb(x[pX++], a[pA], 0x00000800);
    s2 = amrnb_fxp_mac_16_by_16bb(x[pX++], a[pA++], 0x00000800);
    s1 = amrnb_fxp_msu_16_by_16bb(a[pA++], y[pYY1y], s1);

    for (let j = (M >> 1) - 2; j !== 0; j--) {
      s2 = amrnb_fxp_msu_16_by_16bb(a[pA], y[pYY1y--], s2);
      s1 = amrnb_fxp_msu_16_by_16bb(a[pA++], y[pYY1y], s1);
      s2 = amrnb_fxp_msu_16_by_16bb(a[pA], y[pYY1y--], s2);
      s1 = amrnb_fxp_msu_16_by_16bb(a[pA++], y[pYY1y], s1);
      s2 = amrnb_fxp_msu_16_by_16bb(a[pA], y[pYY1y--], s2);
      s1 = amrnb_fxp_msu_16_by_16bb(a[pA++], y[pYY1y], s1);
    }

    if ((s1 + 134217728) >>> 0 < 0x0fffffff) {
      temp = ((s1 >> 12) << 16) >> 16;
    } else if (s1 > 0x07ffffff) {
      temp = MAX_16;
    } else {
      temp = MIN_16;
    }

    s2 = amrnb_fxp_msu_16_by_16bb(a[aOff + 1], temp, s2);

    y[pY++] = temp;
    pYY1y = pY; /* C: p_yy1 = p_y (slot written by s2 below) */

    if ((s2 + 134217728) >>> 0 < 0x0fffffff) {
      y[pY++] = ((s2 >> 12) << 16) >> 16;
    } else if (s2 > 0x07ffffff) {
      y[pY++] = MAX_16;
    } else {
      y[pY++] = MIN_16;
    }
  }

  /* Update of memory if update==1 */
  if (update !== 0) {
    for (let i = 0; i < M; i++) mem[memOff + i] = y[yOff + lg - M + i];
  }
}

const predLtCoeff = new Int16Array(L_INTER10 << 1); /* C: Word16 Coeff_1[20] */

/**
 * pred_lt.cpp Pred_lt_3or6: adaptive codebook prediction, writes
 * exc[excOff .. excOff+L_subfr-1] interpolating from exc[excOff-T0 ...].
 * (pOverflow intentionally unused, as in C)
 */
export function Pred_lt_3or6(exc, excOff, T0, frac, L_subfr, flag3, pOverflow) {
  let s1, s2;
  const Coeff_1 = predLtCoeff;

  let pX0 = excOff - T0;

  /* frac goes between -3 and 3 */
  frac = -frac;

  if (flag3 !== 0) {
    frac <<= 1; /* inter_3l[k] = inter_6[2*k] -> k' = 2*k */
  }

  if (frac < 0) {
    frac += UP_SAMP_MAX;
    pX0--;
  }

  let pC1ref = frac;                 /* &inter_6_pred_lt[frac] */
  let pC2ref = UP_SAMP_MAX - frac;   /* &inter_6_pred_lt[UP_SAMP_MAX - frac] */
  let pC1 = 0;
  let k = 0;

  for (let i = L_INTER10 >> 1; i > 0; i--) {
    Coeff_1[pC1++] = inter_6_pred_lt[pC1ref + k];
    Coeff_1[pC1++] = inter_6_pred_lt[pC2ref + k];
    k += UP_SAMP_MAX;
    Coeff_1[pC1++] = inter_6_pred_lt[pC1ref + k];
    Coeff_1[pC1++] = inter_6_pred_lt[pC2ref + k];
    k += UP_SAMP_MAX;
  }

  let pExc = excOff;
  for (let j = L_subfr >> 1; j !== 0; j--) {
    pX0++;
    let pX2 = pX0;
    let pX3 = pX0++;
    pC1 = 0;
    s1 = 0x00004000;
    s2 = 0x00004000;

    for (let i = L_INTER10 >> 1; i > 0; i--) {
      s2 += exc[pX3--] * Coeff_1[pC1];
      s1 += exc[pX3] * Coeff_1[pC1++];
      s1 += exc[pX2++] * Coeff_1[pC1];
      s2 += exc[pX2] * Coeff_1[pC1++];
      s2 += exc[pX3--] * Coeff_1[pC1];
      s1 += exc[pX3] * Coeff_1[pC1++];
      s1 += exc[pX2++] * Coeff_1[pC1];
      s2 += exc[pX2] * Coeff_1[pC1++];
    }
    exc[pExc++] = ((s1 >> 15) << 16) >> 16;
    exc[pExc++] = ((s2 >> 15) << 16) >> 16;
  }
}
