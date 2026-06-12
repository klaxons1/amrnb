/*
 * Math helper functions, ported from opencore-amr 0.1.6 common/src:
 *   gmed_n.cpp, inv_sqrt.cpp, log2_norm.cpp, log2.cpp, pow2.cpp, sqrt_l.cpp
 * Active (OSCL_EXPORT_REF) implementations only, transcribed line by line.
 *
 * C output pointers (Word16 *exponent, ...) become 1-element Int16Array
 * parameters so call sites read like the C code.
 */
import { norm_l, L_msu, L_mult, L_shl, L_shr_r } from './basicop.js';
import { inv_sqrt_tbl, log2_tbl, pow2_tbl, sqrt_l_tbl } from './tables/index.js';

const NMAX = 9; /* largest N used in median calculation */
const gmedTmp = new Int16Array(NMAX);
const gmedTmp2 = new Int16Array(NMAX);

/** gmed_n.cpp gmed_n — median of ind[indOff .. indOff+n-1] */
export function gmed_n(ind, indOff, n) {
  let ix = 0;
  let max;
  const tmp = gmedTmp;
  const tmp2 = gmedTmp2;

  for (let i = 0; i < n; i++) {
    tmp2[i] = ind[indOff + i];
  }

  for (let i = 0; i < n; i++) {
    max = -32767;
    for (let j = 0; j < n; j++) {
      if (tmp2[j] >= max) {
        max = tmp2[j];
        ix = j;
      }
    }
    tmp2[ix] = -32768;
    tmp[i] = ix;
  }

  const medianIndex = tmp[n >> 1]; /* account for complex addressing */
  return ind[indOff + medianIndex];
}

/** inv_sqrt.cpp Inv_sqrt (pOverflow intentionally unused, as in C) */
export function Inv_sqrt(L_x, pOverflow) {
  let exp;
  let i;
  let a;
  let tmp;
  let L_y;

  if (L_x <= 0) {
    return 0x3fffffff;
  }

  exp = norm_l(L_x);
  L_x <<= exp; /* L_x is normalize */
  exp = 30 - exp;

  if ((exp & 1) === 0) {
    /* If exponent even -> shift right */
    L_x >>= 1;
  }
  exp >>= 1;
  exp += 1;

  L_x >>= 9;
  i = ((L_x >> 16) << 16) >> 16; /* Extract b25-b31 */
  a = ((L_x >> 1) << 16) >> 16;  /* Extract b10-b24 */
  a &= 0x7fff;

  i -= 16;

  L_y = inv_sqrt_tbl[i] << 16; /* inv_sqrt_tbl[i] << 16 */
  tmp = inv_sqrt_tbl[i] - inv_sqrt_tbl[i + 1];
  /* always a positive number less than 200 */
  L_y = (L_y - ((tmp * a) << 1)) | 0; /* L_y -= tmp*a*2 */
  L_y >>= exp; /* denormalization, exp always 0< exp < 31 */
  return L_y;
}

/**
 * log2_norm.cpp Log2_norm.
 * @param {Int16Array} exponent 1-element out
 * @param {Int16Array} fraction 1-element out
 */
export function Log2_norm(L_x, exp, exponent, fraction) {
  let i;
  let a;
  let tmp;
  let L_y;

  if (L_x <= 0) {
    exponent[0] = 0;
    fraction[0] = 0;
  } else {
    /* Calculate exponent portion of Log2 */
    exponent[0] = 30 - exp;

    /* Shift L_x to the right by 10 to extract bits 10-31 */
    L_x >>= 10;
    i = (((L_x >> 15) << 16) >> 16); /* Extract b25-b31 */
    a = L_x & 0x7fff;                /* Extract b10-b24 of fraction */

    i -= 32;

    L_y = log2_tbl[i] << 16; /* table[i] << 16 */
    tmp = log2_tbl[i] - log2_tbl[i + 1]; /* table[i] - table[i+1] */
    L_y = (L_y - ((tmp * a) << 1)) | 0; /* L_y -= tmp*a*2 */
    fraction[0] = (L_y >> 16) << 16 >> 16;
  }
}

/**
 * log2.cpp Log2 (pOverflow intentionally unused, as in C).
 * @param {Int16Array} pExponent 1-element out
 * @param {Int16Array} pFraction 1-element out
 */
export function Log2(L_x, pExponent, pFraction, pOverflow) {
  const exp = norm_l(L_x);
  Log2_norm(L_x << exp, exp, pExponent, pFraction);
}

/** pow2.cpp Pow2 */
export function Pow2(exponent, fraction, pOverflow) {
  let exp;
  let i;
  let a;
  let tmp;
  let L_x;

  L_x = L_mult(fraction, 32, pOverflow); /* L_x = fraction<<6 */

  /* Extract b0-b16 of fraction */
  i = ((L_x >> 16) << 16 >> 16) & 31; /* ensure index i is bounded */
  a = ((L_x >> 1) & 0x7fff) << 16 >> 16;

  L_x = pow2_tbl[i] << 16; /* pow2_tbl[i] << 16 */
  tmp = pow2_tbl[i] - pow2_tbl[i + 1];
  L_x = L_msu(L_x, tmp, a, pOverflow); /* L_x -= tmp*a*2 */

  exp = 30 - exponent;
  L_x = L_shr_r(L_x, exp, pOverflow);

  return L_x;
}

/**
 * sqrt_l.cpp sqrt_l_exp.
 * @param {Int16Array} pExp 1-element out (right shift to apply to result, Q1)
 */
export function sqrt_l_exp(L_x, pExp, pOverflow) {
  let e;
  let i;
  let a;
  let tmp;
  let L_y;

  if (L_x <= 0) {
    pExp[0] = 0;
    return 0;
  }

  e = norm_l(L_x) & 0xfffe; /* get next lower EVEN norm. exp */
  L_x = L_shl(L_x, e, pOverflow); /* L_x is normalized to [0.25..1) */
  pExp[0] = e; /* return 2*exponent (or Q1) */

  L_x >>= 10;
  i = ((L_x >> 15) << 16 >> 16) & 63; /* Extract b25-b31, 16<= i <=63 */
  a = (L_x << 16) >> 16; /* Extract b10-b24 */
  a &= 0x7fff;

  if (i > 15) {
    i -= 16; /* 0 <= i <= 47 */
  }

  L_y = sqrt_l_tbl[i] << 16; /* sqrt_l_tbl[i] << 16 */
  tmp = sqrt_l_tbl[i] - sqrt_l_tbl[i + 1];
  L_y = L_msu(L_y, tmp, a, pOverflow); /* L_y -= tmp*a*2 */

  /* denormalization done by caller */
  return L_y;
}
