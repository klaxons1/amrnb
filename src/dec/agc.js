/*
 * AGC, ported from opencore-amr 0.1.6 dec/src/agc.cpp (energy_old,
 * energy_new, agcState, agc_reset, agc, agc2).
 * Active implementations transcribed line by line.
 */
import {
  MAX_32, MIN_32, MAX_16, MIN_16, L_mac, L_shl, L_shr, L_mult,
  norm_l, pv_round, div_s,
} from '../common/basicop.js';
import { Inv_sqrt } from '../common/mathops.js';

/** agc.h agcState */
export class agcState {
  constructor() {
    this.past_gain = 4096;
  }

  /** agc.cpp agc_reset */
  reset() {
    this.past_gain = 4096; /* initial value of past_gain = 1.0 */
    return 0;
  }
}

/** agc.cpp energy_old (static) */
function energy_old(input, inOff, l_trm, pOverflow) {
  let s = 0;
  let temp;
  for (let i = 0; i < l_trm; i++) {
    temp = input[inOff + i] >> 2;
    s = L_mac(s, temp, temp, pOverflow);
  }
  return s;
}

/** agc.cpp energy_new (static) */
function energy_new(input, inOff, l_trm, pOverflow) {
  let s = 0;
  const ov_save = pOverflow[0]; /* save in case energy_old must be called */

  for (let i = 0; i < l_trm; i++) {
    s = L_mac(s, input[inOff + i], input[inOff + i], pOverflow);
  }

  /* check for overflow */
  if (s !== MAX_32) {
    /* s is a sum of squares, so it won't be negative */
    s = s >> 4;
  } else {
    pOverflow[0] = ov_save; /* restore overflow flag */
    s = energy_old(input, inOff, l_trm, pOverflow);
  }
  return s;
}

/** agc.cpp agc */
export function agc(st, sig_in, sig_inOff, sig_out, sig_outOff, agc_fac, l_trm, pOverflow) {
  let i;
  let exp;
  let gain_in;
  let gain_out;
  let g0;
  let gain;
  let s;
  let L_temp;
  let temp;

  /* calculate gain_out with exponent */
  s = energy_new(sig_out, sig_outOff, l_trm, pOverflow);
  if (s === 0) {
    st.past_gain = 0;
    return;
  }
  exp = (norm_l(s) - 1) << 16 >> 16;
  L_temp = L_shl(s, exp, pOverflow);
  gain_out = pv_round(L_temp, pOverflow);

  /* calculate gain_in with exponent */
  s = energy_new(sig_in, sig_inOff, l_trm, pOverflow);
  if (s === 0) {
    g0 = 0;
  } else {
    i = norm_l(s);
    /* L_temp = L_shl(s, i, pOverflow); */
    L_temp = s << i;
    gain_in = pv_round(L_temp, pOverflow);
    exp = (exp - i) << 16 >> 16;

    /* g0 = (1-agc_fac) * sqrt(gain_in/gain_out) */
    /* s = gain_out / gain_in */
    temp = div_s(gain_out, gain_in);
    s = temp;
    s = s << 7;
    s = L_shr(s, exp, pOverflow); /* add exponent */
    s = Inv_sqrt(s, pOverflow);
    L_temp = s << 9;
    i = ((((L_temp + 0x00008000) | 0) >> 16) << 16) >> 16;

    /* g0 = i * (1-agc_fac) */
    temp = (32767 - agc_fac) << 16 >> 16;
    g0 = ((i * temp) >> 15) << 16 >> 16;
  }

  /* compute gain[n] = agc_fac*gain[n-1] + (1-agc_fac)*sqrt(gain_in/gain_out)
     sig_out[n] = gain[n] * sig_out[n] */
  gain = st.past_gain;
  let pSig = sig_outOff;
  for (i = 0; i < l_trm; i++) {
    gain = ((gain * agc_fac) >> 15) << 16 >> 16;
    gain = (gain + g0) << 16 >> 16; /* C Word16 += without saturation */
    L_temp = (sig_out[pSig] * gain) << 1;
    sig_out[pSig++] = ((L_temp >> 13) << 16) >> 16;
  }
  st.past_gain = gain;
}

/** agc.cpp agc2 */
export function agc2(sig_in, sig_inOff, sig_out, sig_outOff, l_trm, pOverflow) {
  let i;
  let exp;
  let gain_in;
  let gain_out;
  let g0;
  let s;
  let L_temp;
  let temp;

  /* calculate gain_out with exponent */
  s = energy_new(sig_out, sig_outOff, l_trm, pOverflow);
  if (s === 0) {
    return;
  }
  exp = (norm_l(s) - 1) << 16 >> 16;
  L_temp = L_shl(s, exp, pOverflow);
  gain_out = pv_round(L_temp, pOverflow);

  /* calculate gain_in with exponent */
  s = energy_new(sig_in, sig_inOff, l_trm, pOverflow);
  if (s === 0) {
    g0 = 0;
  } else {
    i = norm_l(s);
    L_temp = L_shl(s, i, pOverflow);
    gain_in = pv_round(L_temp, pOverflow);
    exp = (exp - i) << 16 >> 16;

    /* g0 = sqrt(gain_in/gain_out) */
    temp = div_s(gain_out, gain_in);
    s = temp;

    if (s > 0x00ffffff) {
      s = MAX_32;
    } else if (s < -16777216) {
      s = MIN_32;
    } else {
      s = s << 7;
    }
    s = L_shr(s, exp, pOverflow); /* add exponent */
    s = Inv_sqrt(s, pOverflow);

    if (s > 0x003fffff) {
      L_temp = MAX_32;
    } else if (s < -4194304) {
      L_temp = MIN_32;
    } else {
      L_temp = s << 9;
    }
    g0 = pv_round(L_temp, pOverflow);
  }

  /* sig_out(n) = gain(n) sig_out(n) */
  for (i = l_trm - 1; i >= 0; i--) {
    L_temp = L_mult(sig_out[sig_outOff + i], g0, pOverflow);
    if (L_temp > 0x0fffffff) {
      sig_out[sig_outOff + i] = MAX_16;
    } else if (L_temp < -268435456) {
      sig_out[sig_outOff + i] = MIN_16;
    } else {
      sig_out[sig_outOff + i] = ((L_temp >> 13) << 16) >> 16;
    }
  }
}
