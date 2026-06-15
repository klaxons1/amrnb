/*
 * Double-precision (DPF) 32-bit operations, ported from opencore-amr 0.1.6
 * enc/src: l_abs.cpp, l_comp.cpp, l_extract.cpp, l_negate.cpp, div_32.cpp.
 * Active implementations transcribed line by line.
 */
import { MAX_32, MIN_32, L_mac, L_shl, div_s, Mpy_32, Mpy_32_16 } from './basicop.js';

/** l_abs.cpp L_abs */
export function L_abs(L_var1) {
  /* C: Word32 y = L_var1 - (L_var1 < 0) — wraps at MIN_32 */
  let y = (L_var1 - (L_var1 < 0 ? 1 : 0)) | 0;
  y = y ^ (y >> 31);
  return y;
}

/** l_negate.cpp L_negate */
export function L_negate(L_var1) {
  return L_var1 === MIN_32 ? MAX_32 : (-L_var1) | 0;
}

/** l_comp.cpp L_Comp: hi<<16 + lo<<1 */
export function L_Comp(hi, lo, pOverflow) {
  const L_32 = hi << 16;
  return L_mac(L_32, lo, 1, pOverflow);
}

/**
 * l_extract.cpp L_Extract (pOverflow intentionally unused, as in C).
 * @param {Int16Array} pL_var_hi 1-element out
 * @param {Int16Array} pL_var_lo 1-element out
 */
export function L_Extract(L_var, pL_var_hi, pL_var_lo, pOverflow) {
  const temp = L_var >> 16;
  pL_var_hi[0] = (temp << 16) >> 16;
  pL_var_lo[0] = (((L_var >> 1) - (temp << 15)) << 16) >> 16;
}

/** div_32.cpp Div_32: fractional 32/32 division, L_num < L_denom */
export function Div_32(L_num, L_denom_hi, L_denom_lo, pOverflow) {
  let hi;
  let lo;
  let result;

  /* First approximation: 1 / L_denom = 1/L_denom_hi */
  const approx = div_s(0x3fff, L_denom_hi);

  /* 1/L_denom = approx * (2.0 - L_denom * approx) */
  result = Mpy_32_16(L_denom_hi, L_denom_lo, approx, pOverflow);
  /* result is > 0, and less than 1.0 */
  result = (0x7fffffff - result) | 0;

  hi = ((result >> 16) << 16) >> 16;
  lo = (((result >> 1) - (hi << 15)) << 16) >> 16;

  result = Mpy_32_16(hi, lo, approx, pOverflow);

  /* L_num * (1/L_denom) */
  hi = ((result >> 16) << 16) >> 16;
  lo = (((result >> 1) - (hi << 15)) << 16) >> 16;

  const n_hi = ((L_num >> 16) << 16) >> 16;
  const n_lo = (((L_num >> 1) - (n_hi << 15)) << 16) >> 16;

  result = Mpy_32(n_hi, n_lo, hi, lo, pOverflow);
  result = L_shl(result, 2, pOverflow);

  return result;
}
