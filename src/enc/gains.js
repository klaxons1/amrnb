/*
 * Gain computation and basic quantization, ported from opencore-amr 0.1.6
 * enc/src: g_pitch.cpp (G_pitch), g_code.cpp (G_code),
 *   q_gain_p.cpp (q_gain_pitch), q_gain_c.cpp (q_gain_code),
 *   g_adapt.cpp (GainAdaptState, gain_adapt),
 *   calc_en.cpp (calc_unfilt_energies, calc_filt_energies, calc_target_energy),
 *   qua_gain.cpp (Qua_gain)
 * Active implementations transcribed line by line.
 */
import {
  MAX_32, MIN_32, sub, add_16, mult, shl, shr, shr_r, abs_s, negate, div_s,
  norm_l, pv_round, L_mult, L_mac, L_add, L_shl, L_shr, Mpy_32_16,
  amrnb_fxp_mac_16_by_16bb,
} from '../common/basicop.js';
import { L_Comp, L_Extract } from '../common/oper32b.js';
import { Pow2, Log2, gmed_n } from '../common/mathops.js';
import { L_SUBFR, MR475, MR67, MR74, MR795, MR102, MR122 } from '../common/cnst.js';
import {
  qua_gain_pitch, qua_gain_code, table_gain_highrates, table_gain_lowrates,
} from '../common/tables/index.js';

const NB_QUA_PITCH = 16;
const NB_QUA_CODE = 32;
const VQ_SIZE_HIGHRATES = 128;
const VQ_SIZE_LOWRATES = 64;
const LTP_GAIN_THR1 = 2721; /* Q13 = 0.3322 ~= 1.0 / (10*log10(2)) */
const LTP_GAIN_THR2 = 5443; /* Q13 = 0.6644 ~= 2.0 / (10*log10(2)) */
const LTPG_MEM_SIZE = 5;

/** g_pitch.cpp G_pitch: gain of pitch, saturated to 1.2 (Q14) */
export function G_pitch(mode, xn, xnOff, y1, y1Off, g_coeff, g_coeffOff,
  L_subfr, pOverflow) {
  let i;
  let xy, yy, exp_xy, exp_yy, gain, tmp;
  let s, s1, L_temp;

  /* Compute scalar product <y1[],y1[]> */
  pOverflow[0] = 0;
  s = 0;
  let pY1 = y1Off;
  for (i = L_subfr >> 2; i !== 0; i--) {
    s = amrnb_fxp_mac_16_by_16bb(y1[pY1], y1[pY1], s);
    pY1++;
    s = amrnb_fxp_mac_16_by_16bb(y1[pY1], y1[pY1], s);
    pY1++;
    s = amrnb_fxp_mac_16_by_16bb(y1[pY1], y1[pY1], s);
    pY1++;
    s = amrnb_fxp_mac_16_by_16bb(y1[pY1], y1[pY1], s);
    pY1++;
  }

  if (s >= 0 && s < 0x40000000) {
    s = s << 1;
    s = (s + 1) | 0; /* Avoid case of all zeros */
    exp_yy = norm_l(s); /* Note 0<=exp_yy <= 31 */
    L_temp = s << exp_yy;
    yy = pv_round(L_temp, pOverflow);
  } else {
    s = 0; /* Avoid case of all zeros */
    pY1 = y1Off;
    for (i = L_subfr >> 1; i !== 0; i--) {
      tmp = y1[pY1++] >> 2;
      s = amrnb_fxp_mac_16_by_16bb(tmp, tmp, s);
      tmp = y1[pY1++] >> 2;
      s = amrnb_fxp_mac_16_by_16bb(tmp, tmp, s);
    }
    s = s << 1;
    s = (s + 1) | 0;
    exp_yy = norm_l(s);
    L_temp = s << exp_yy;
    yy = pv_round(L_temp, pOverflow);
    exp_yy = (exp_yy - 4) << 16 >> 16;
  }

  /* Compute scalar product <xn[],y1[]> */
  s = 0;
  pY1 = y1Off;
  let pXn = xnOff;
  pOverflow[0] = 0;
  for (i = L_subfr; i !== 0; i--) {
    L_temp = xn[pXn++] * y1[pY1++];
    s1 = s;
    s = (s1 + L_temp) | 0;

    if ((s1 ^ L_temp) > 0) {
      if ((s1 ^ s) < 0) {
        pOverflow[0] = 1;
        break;
      }
    }
  }

  if (!pOverflow[0]) {
    s = s << 1;
    s = (s + 1) | 0;
    exp_xy = norm_l(s);
    L_temp = s << exp_xy;
    xy = pv_round(L_temp, pOverflow);
  } else {
    s = 0; /* re-initialize calculations */
    pY1 = y1Off;
    pXn = xnOff;
    for (i = L_subfr >> 2; i !== 0; i--) {
      L_temp = y1[pY1++] >> 2;
      s = amrnb_fxp_mac_16_by_16bb(xn[pXn++], L_temp, s);
      L_temp = y1[pY1++] >> 2;
      s = amrnb_fxp_mac_16_by_16bb(xn[pXn++], L_temp, s);
      L_temp = y1[pY1++] >> 2;
      s = amrnb_fxp_mac_16_by_16bb(xn[pXn++], L_temp, s);
      L_temp = y1[pY1++] >> 2;
      s = amrnb_fxp_mac_16_by_16bb(xn[pXn++], L_temp, s);
    }
    s = s << 1;
    s = (s + 1) | 0;
    exp_xy = norm_l(s);
    L_temp = s << exp_xy;
    xy = pv_round(L_temp, pOverflow);
    exp_xy = (exp_xy - 4) << 16 >> 16;
  }

  g_coeff[g_coeffOff] = yy;
  g_coeff[g_coeffOff + 1] = (15 - exp_yy) << 16 >> 16;
  g_coeff[g_coeffOff + 2] = xy;
  g_coeff[g_coeffOff + 3] = (15 - exp_xy) << 16 >> 16;

  /* If (xy < 4) gain = 0 */
  if (xy < 4) {
    return 0;
  }

  /* compute gain = xy/yy; be sure xy < yy */
  xy = xy >> 1;
  gain = div_s(xy, yy);

  i = (exp_xy - exp_yy) << 16 >> 16; /* Denormalization of division */
  gain = shr(gain, i, pOverflow);

  /* if (gain > 1.2) gain = 1.2 */
  if (gain > 19661) {
    gain = 19661;
  }

  if (mode === MR122) {
    /* clear 2 LSBits */
    gain = ((gain & 0xfffc) << 16) >> 16;
  }

  return gain;
}

/** g_code.cpp G_code (pOverflow intentionally unused) */
export function G_code(xn2, xn2Off, y2, y2Off, pOverflow) {
  let i;
  let xy, yy, exp_xy, exp_yy, gain;
  let s;
  let temp, temp2;

  /* Compute scalar product <X[],Y[]> */
  s = 0;
  let pX = xn2Off;
  let pY = y2Off;
  for (i = L_SUBFR >> 2; i !== 0; i--) {
    temp2 = y2[pY++] >> 1;
    s = amrnb_fxp_mac_16_by_16bb(xn2[pX++], temp2, s);
    temp2 = y2[pY++] >> 1;
    s = amrnb_fxp_mac_16_by_16bb(xn2[pX++], temp2, s);
    temp2 = y2[pY++] >> 1;
    s = amrnb_fxp_mac_16_by_16bb(xn2[pX++], temp2, s);
    temp2 = y2[pY++] >> 1;
    s = amrnb_fxp_mac_16_by_16bb(xn2[pX++], temp2, s);
  }
  s = s << 1;
  exp_xy = norm_l((s + 1) | 0); /* Avoid case of all zeros, add 1 */
  if (exp_xy < 17) {
    /* extra right shift to be sure xy < yy */
    xy = ((s >> (17 - exp_xy)) << 16) >> 16;
  } else {
    xy = ((s << (exp_xy - 17)) << 16) >> 16;
  }

  /* If (xy < 0) gain = 0 */
  if (xy <= 0) {
    return 0;
  }

  /* Compute scalar product <Y[],Y[]> */
  s = 0;
  pY = y2Off;
  for (i = L_SUBFR >> 1; i !== 0; i--) {
    temp = y2[pY++] >> 1;
    s = (s + ((temp * temp) >> 2)) | 0;
    temp = y2[pY++] >> 1;
    s = (s + ((temp * temp) >> 2)) | 0;
  }
  s = s << 3;
  exp_yy = norm_l(s);
  if (exp_yy < 16) {
    yy = ((s >> (16 - exp_yy)) << 16) >> 16;
  } else {
    yy = ((s << (exp_yy - 16)) << 16) >> 16;
  }

  gain = div_s(xy, yy);

  /* Denormalization of division */
  i = (exp_xy + 5) << 16 >> 16; /* 15-1+9-18 = 5 */
  i = (i - exp_yy) << 16 >> 16;

  /* gain = shl(shr(gain, i), 1)  (Q0 -> Q1) */
  if (i > 1) {
    gain >>= i - 1;
  } else {
    gain = (gain << (1 - i)) << 16 >> 16;
  }

  return gain;
}

/**
 * q_gain_p.cpp q_gain_pitch.
 * @param {Int16Array} gain 1-element in/out (Q14)
 * @param {Int16Array|null} gain_cand 3-element out (MR795 only)
 * @param {Int16Array|null} gain_cind 3-element out (MR795 only)
 */
export function q_gain_pitch(mode, gp_limit, gain, gain_cand, gain_cind, pOverflow) {
  let index = 0;
  let err;
  let err_min;

  err_min = sub(gain[0], qua_gain_pitch[0], pOverflow);
  err_min = abs_s(err_min);

  for (let i = 1; i < NB_QUA_PITCH; i++) {
    if (qua_gain_pitch[i] <= gp_limit) {
      err = sub(gain[0], qua_gain_pitch[i], pOverflow);
      err = abs_s(err);

      if (err < err_min) {
        err_min = err;
        index = i;
      }
    }
  }

  if (mode === MR795) {
    /* compute three gain_pit candidates around the found index */
    let ii;
    if (index === 0) {
      ii = index;
    } else if (index === NB_QUA_PITCH - 1
      || qua_gain_pitch[index + 1] > gp_limit) {
      ii = index - 2;
    } else {
      ii = index - 1;
    }

    /* store candidate indices and values */
    for (let i = 0; i < 3; i++) {
      gain_cind[i] = ii;
      gain_cand[i] = qua_gain_pitch[ii];
      ii += 1;
    }

    gain[0] = qua_gain_pitch[index];
  } else if (mode === MR122) {
    /* clear 2 LSBits */
    gain[0] = qua_gain_pitch[index] & 0xfffc;
  } else {
    gain[0] = qua_gain_pitch[index];
  }

  return index;
}

/**
 * q_gain_c.cpp q_gain_code.
 * @param {Int16Array} gain 1-element in/out (Q1)
 * @param {Int16Array} qua_ener_MR122 1-element out (Q10)
 * @param {Int16Array} qua_ener 1-element out (Q10)
 */
export function q_gain_code(mode, exp_gcode0, frac_gcode0, gain,
  qua_ener_MR122, qua_ener, pOverflow) {
  let index;
  let gcode0;
  let err;
  let err_min;
  let g_q0;
  let temp;

  if (mode === MR122) {
    g_q0 = gain[0] >> 1; /* Q1 -> Q0 */
  } else {
    g_q0 = gain[0];
  }

  /* predicted codebook gain */
  gcode0 = (Pow2(exp_gcode0, frac_gcode0, pOverflow) << 16) >> 16;

  if (mode === MR122) {
    gcode0 = shl(gcode0, 4, pOverflow);
  } else {
    gcode0 = shl(gcode0, 5, pOverflow);
  }

  /* Search for best quantizer */
  let p = 0;
  err_min = ((gcode0 * qua_gain_code[p++]) >> 15) << 16 >> 16;
  err_min = (g_q0 - err_min) << 16 >> 16;
  if (err_min < 0) {
    err_min = (-err_min) << 16 >> 16;
  }

  p += 2; /* skip quantized energy errors */
  index = 0;
  for (let i = 1; i < NB_QUA_CODE; i++) {
    err = ((gcode0 * qua_gain_code[p++]) >> 15) << 16 >> 16;
    err = (g_q0 - err) << 16 >> 16;
    if (err < 0) {
      err = (-err) << 16 >> 16;
    }
    p += 2; /* skip quantized energy error */

    if (err < err_min) {
      err_min = err;
      index = i;
    }
  }

  temp = (index + (index << 1)) << 16 >> 16;
  p = temp;

  temp = ((gcode0 * qua_gain_code[p++]) >> 15) << 16 >> 16;
  if (mode === MR122) {
    gain[0] = (temp << 1) << 16 >> 16;
  } else {
    gain[0] = temp;
  }

  /* quantized error energies (for MA predictor update) */
  qua_ener_MR122[0] = qua_gain_code[p++];
  qua_ener[0] = qua_gain_code[p];

  return index;
}

/** g_adapt.h GainAdaptState */
export class GainAdaptState {
  constructor() {
    this.onset = 0;        /* onset state,             Q0  */
    this.prev_alpha = 0;   /* previous adaptor output, Q15 */
    this.prev_gc = 0;      /* previous code gain,      Q1  */
    this.ltpg_mem = new Int16Array(LTPG_MEM_SIZE); /* LTP gain history, Q13 */
  }

  /** g_adapt.cpp gain_adapt_reset */
  reset() {
    this.onset = 0;
    this.prev_alpha = 0;
    this.prev_gc = 0;
    this.ltpg_mem.fill(0);
    return 0;
  }
}

/**
 * g_adapt.cpp gain_adapt.
 * @param {Int16Array} alpha 1-element out (Q15)
 */
export function gain_adapt(st, ltpg, gain_cod, alpha, pOverflow) {
  let adapt;  /* adaptation status; 0, 1, or 2 */
  let result; /* alpha factor, Q13 */
  let filt;   /* median-filtered LTP coding gain, Q13 */
  let tmp;

  /* basic adaptation */
  if (ltpg <= LTP_GAIN_THR1) {
    adapt = 0;
  } else if (ltpg <= LTP_GAIN_THR2) {
    adapt = 1;
  } else {
    adapt = 2;
  }

  /* onset indicator: tmp = cbGain / onFact; onFact = 2.0; 200 Q1 = 100.0 */
  tmp = shr_r(gain_cod, 1, pOverflow);
  if (tmp > st.prev_gc && gain_cod > 200) {
    st.onset = 8;
  } else if (st.onset !== 0) {
    st.onset--;
  }

  /* if onset, increase adaptor state */
  if (st.onset !== 0 && adapt < 2) {
    adapt += 1;
  }

  st.ltpg_mem[0] = ltpg;
  filt = gmed_n(st.ltpg_mem, 0, 5);

  if (adapt === 0) {
    if (filt > 5443) {
      /* 5443 Q13 = 0.66443... */
      result = 0;
    } else if (filt < 0) {
      result = 16384; /* Q15 = 0.5 */
    } else {
      /* result (Q15) = 16384 - 24660 * (filt << 2) */
      filt = shl(filt, 2, pOverflow); /* Q15 */
      result = mult(24660, filt, pOverflow);
      result = (16384 - result) << 16 >> 16;
    }
  } else {
    result = 0;
  }

  /* if (prevAlpha == 0.0) result = 0.5 * (result + prevAlpha) */
  if (st.prev_alpha === 0) {
    result = shr(result, 1, pOverflow);
  }

  /* store the result */
  alpha[0] = result;

  /* update adapter state memory */
  st.prev_alpha = result;
  st.prev_gc = gain_cod;
  for (let i = LTPG_MEM_SIZE - 1; i > 0; i--) {
    st.ltpg_mem[i] = st.ltpg_mem[i - 1];
  }
}

const ceExp = new Int16Array(1);
const ceFrac = new Int16Array(1);

/**
 * calc_en.cpp calc_unfilt_energies.
 * frac_en/exp_en: 4-element outs; ltpg: 1-element out (Q13).
 */
export function calc_unfilt_energies(res, resOff, exc, excOff, code, codeOff,
  gain_pit, L_subfr, frac_en, exp_en, ltpg, pOverflow) {
  let s1 = 0;
  let s2 = 0;
  let s3 = 0;
  let s4 = 0;
  let L_temp;
  let exp;
  let tmp1, tmp2;
  let ltp_res_en, pred_gain;

  /* NOTE: overflow is expected (kept for bit exactness, see C source) */
  for (let i = 0; i < L_subfr; i++) {
    tmp1 = res[resOff + i];
    tmp2 = exc[excOff + i];
    s1 = amrnb_fxp_mac_16_by_16bb(tmp1, tmp1, s1); /* residual energy */
    s2 = amrnb_fxp_mac_16_by_16bb(tmp2, tmp2, s2); /* LTP exc energy */
    s3 = amrnb_fxp_mac_16_by_16bb(tmp2, code[codeOff + i], s3); /* <exc,code> */

    L_temp = L_mult(tmp2, gain_pit, pOverflow);
    L_temp = L_shl(L_temp, 1, pOverflow);
    tmp2 = sub(tmp1, pv_round(L_temp, pOverflow), pOverflow); /* LTP residual */
    s4 = L_mac(s4, tmp2, tmp2, pOverflow); /* energy of LTP residual */
  }

  s1 = s1 << 1;
  s2 = s2 << 1;
  s3 = s3 << 1;

  if (s1 & MIN_32) {
    s1 = MAX_32;
    pOverflow[0] = 1;
  }

  /* ResEn := 0 if ResEn < 200.0 (= 400 Q1) */
  if (s1 < 400) {
    frac_en[0] = 0;
    exp_en[0] = -15;
  } else {
    exp = norm_l(s1);
    frac_en[0] = ((L_shl(s1, exp, pOverflow) >> 16) << 16) >> 16;
    exp_en[0] = (15 - exp) << 16 >> 16;
  }

  if (s2 & MIN_32) {
    s2 = MAX_32;
    pOverflow[0] = 1;
  }
  exp = norm_l(s2);
  frac_en[1] = ((L_shl(s2, exp, pOverflow) >> 16) << 16) >> 16;
  exp_en[1] = (15 - exp) << 16 >> 16;

  /* s3 is not always sum of squares */
  exp = norm_l(s3);
  frac_en[2] = ((L_shl(s3, exp, pOverflow) >> 16) << 16) >> 16;
  exp_en[2] = (2 - exp) << 16 >> 16;

  exp = norm_l(s4);
  ltp_res_en = ((L_shl(s4, exp, pOverflow) >> 16) << 16) >> 16;
  exp = (15 - exp) << 16 >> 16;

  frac_en[3] = ltp_res_en;
  exp_en[3] = exp;

  /* calculate LTP coding gain, i.e. energy reduction LP res -> LTP res */
  if (ltp_res_en > 0 && frac_en[0] !== 0) {
    /* gain = ResEn / LTPResEn */
    pred_gain = div_s(shr(frac_en[0], 1, pOverflow), ltp_res_en);
    exp = sub(exp, exp_en[0], pOverflow);

    /* L_temp = ltpGain * 2^(30 + exp) */
    L_temp = pred_gain << 16;
    /* L_temp = ltpGain * 2^27 */
    L_temp = L_shr(L_temp, (exp + 3) << 16 >> 16, pOverflow);

    /* Log2 = log2() + 27 */
    Log2(L_temp, ceExp, ceFrac, pOverflow);

    /* ltpg = log2(LtpGain) * 2^13 --> range: +- 4 = +- 12 dB */
    L_temp = L_Comp((ceExp[0] - 27) << 16 >> 16, ceFrac[0], pOverflow);
    ltpg[0] = pv_round(L_shl(L_temp, 13, pOverflow), pOverflow); /* Q13 */
  } else {
    ltpg[0] = 0;
  }
}

const cfScaledY2 = new Int16Array(L_SUBFR);

/**
 * calc_en.cpp calc_filt_energies.
 * frac_coeff/exp_coeff: 5-element outs; cod_gain_frac/exp: 1-element outs.
 */
export function calc_filt_energies(mode, xn, xnOff, xn2, xn2Off, y1, y1Off,
  Y2, Y2Off, g_coeff, g_coeffOff, frac_coeff, exp_coeff,
  cod_gain_frac, cod_gain_exp, pOverflow) {
  let s1, s2, s3;
  let exp, frac;
  let tmp;
  const scaled_y2 = cfScaledY2;

  frac_coeff[0] = g_coeff[g_coeffOff];
  exp_coeff[0] = g_coeff[g_coeffOff + 1];
  frac_coeff[1] = negate(g_coeff[g_coeffOff + 2]); /* coeff[1] = -2 xn y1 */
  exp_coeff[1] = (g_coeff[g_coeffOff + 3] + 1) << 16 >> 16;

  if (mode === MR795 || mode === MR475) {
    s1 = 0;
    s2 = 0;
    s3 = 0;
  } else {
    s1 = 1;
    s2 = 1;
    s3 = 1;
  }

  for (let i = 0; i < L_SUBFR; i++) {
    tmp = Y2[Y2Off + i] >> 3;
    scaled_y2[i] = tmp;

    /* <scaled_y2, scaled_y2> */
    s1 = L_mac(s1, tmp, tmp, pOverflow);
    /* -2*<xn, scaled_y2> */
    s2 = L_mac(s2, xn[xnOff + i], tmp, pOverflow);
    /* 2*<y1, scaled_y2> */
    s3 = L_mac(s3, y1[y1Off + i], tmp, pOverflow);
  }

  exp = norm_l(s1);
  frac_coeff[2] = ((L_shl(s1, exp, pOverflow) >> 16) << 16) >> 16;
  exp_coeff[2] = (-3 - exp) << 16 >> 16;

  exp = norm_l(s2);
  frac_coeff[3] = negate(((L_shl(s2, exp, pOverflow) >> 16) << 16) >> 16);
  exp_coeff[3] = (7 - exp) << 16 >> 16;

  exp = norm_l(s3);
  frac_coeff[4] = ((L_shl(s3, exp, pOverflow) >> 16) << 16) >> 16;
  exp_coeff[4] = (7 - exp) << 16 >> 16;

  if (mode === MR795 || mode === MR475) {
    /* Compute scalar product <xn2[],scaled_y2[]> */
    s1 = 0;
    for (let i = 0; i < L_SUBFR; i++) {
      s1 = amrnb_fxp_mac_16_by_16bb(xn2[xn2Off + i], scaled_y2[i], s1);
    }
    s1 = s1 << 1;

    exp = norm_l(s1);
    frac = ((L_shl(s1, exp, pOverflow) >> 16) << 16) >> 16;
    exp = (6 - exp) << 16 >> 16;

    if (frac <= 0) {
      cod_gain_frac[0] = 0;
      cod_gain_exp[0] = 0;
    } else {
      /* gcu = <xn2, scaled_y2> / c[2] = div_s * 2^(exp-exp[2]-14) */
      cod_gain_frac[0] = div_s(shr(frac, 1, pOverflow), frac_coeff[2]);
      cod_gain_exp[0] = ((exp - exp_coeff[2]) - 14) << 16 >> 16;
    }
  }
}

/**
 * calc_en.cpp calc_target_energy.
 * en_exp/en_frac: 1-element outs.
 */
export function calc_target_energy(xn, xnOff, en_exp, en_frac, pOverflow) {
  let s = 0;
  let exp;

  /* Compute scalar product <xn[], xn[]> */
  for (let i = 0; i < L_SUBFR; i++) {
    s = amrnb_fxp_mac_16_by_16bb(xn[xnOff + i], xn[xnOff + i], s);
  }
  if (s < 0) {
    pOverflow[0] = 1;
    s = MAX_32;
  }

  /* s = SUM 2*xn(i) * xn(i) = <xn xn> * 2 */
  exp = norm_l(s);
  en_frac[0] = ((L_shl(s, exp, pOverflow) >> 16) << 16) >> 16;
  en_exp[0] = (16 - exp) << 16 >> 16;
}

const qgCoeff = new Int16Array(5);
const qgCoeffLo = new Int16Array(5);
const qgExpMax = new Int16Array(5);
const qgHi = new Int16Array(1);
const qgLo = new Int16Array(1);

/**
 * qua_gain.cpp Qua_gain: joint pitch/code gain quantization (MR59..MR102).
 * gain_pit/gain_cod/qua_ener_MR122/qua_ener: 1-element outs.
 */
export function Qua_gain(mode, exp_gcode0, frac_gcode0, frac_coeff, exp_coeff,
  gp_limit, gain_pit, gain_cod, qua_ener_MR122, qua_ener, pOverflow) {
  let index = 0;
  let gcode0;
  let e_max;
  let temp;
  let exp_code;
  let g_pitch, g2_pitch, g_code, g2_code, g_pit_cod;
  const coeff = qgCoeff;
  const coeff_lo = qgCoeffLo;
  const exp_max = qgExpMax;
  let L_tmp, L_tmp2;
  let dist_min;
  let table_gain;
  let table_len;

  if (mode === MR102 || mode === MR74 || mode === MR67) {
    table_len = VQ_SIZE_HIGHRATES;
    table_gain = table_gain_highrates;
  } else {
    table_len = VQ_SIZE_LOWRATES;
    table_gain = table_gain_lowrates;
  }

  /* predicted codebook gain: gcode0 (Q14) = 2^14*2^frac_gcode0 */
  gcode0 = (Pow2(14, frac_gcode0, pOverflow) << 16) >> 16;

  /* determine the scaling exponent for g_code: ec = ec0 - 11 */
  exp_code = (exp_gcode0 - 11) << 16 >> 16;

  /* calculate exp_max[i] = s[i]-1 */
  exp_max[0] = (exp_coeff[0] - 13) << 16 >> 16;
  exp_max[1] = (exp_coeff[1] - 14) << 16 >> 16;
  temp = shl(exp_code, 1, pOverflow);
  temp = (temp + 15) << 16 >> 16;
  exp_max[2] = add_16(exp_coeff[2], temp, pOverflow);
  exp_max[3] = add_16(exp_coeff[3], exp_code, pOverflow);
  temp = (exp_code + 1) << 16 >> 16;
  exp_max[4] = add_16(exp_coeff[4], temp, pOverflow);

  /* find maximum exponent */
  e_max = exp_max[0];
  for (let i = 1; i < 5; i++) {
    if (exp_max[i] > e_max) {
      e_max = exp_max[i];
    }
  }
  e_max = (e_max + 1) << 16 >> 16;

  for (let i = 0; i < 5; i++) {
    const j = (e_max - exp_max[i]) << 16 >> 16;
    L_tmp = frac_coeff[i] << 16;
    L_tmp = L_shr(L_tmp, j, pOverflow);
    L_Extract(L_tmp, qgHi, qgLo, pOverflow);
    coeff[i] = qgHi[0];
    coeff_lo[i] = qgLo[0];
  }

  /* Codebook search */
  dist_min = MAX_32;
  let p = 0;
  for (let i = 0; i < table_len; i++) {
    g_pitch = table_gain[p++];
    g_code = table_gain[p++]; /* this is g_fac */
    p++; /* skip log2(g_fac) */
    p++; /* skip 20*log10(g_fac) */

    if (g_pitch <= gp_limit) {
      g_code = mult(g_code, gcode0, pOverflow);
      g2_pitch = mult(g_pitch, g_pitch, pOverflow);
      g2_code = mult(g_code, g_code, pOverflow);
      g_pit_cod = mult(g_code, g_pitch, pOverflow);

      L_tmp = Mpy_32_16(coeff[0], coeff_lo[0], g2_pitch, pOverflow);
      L_tmp2 = Mpy_32_16(coeff[1], coeff_lo[1], g_pitch, pOverflow);
      L_tmp = L_add(L_tmp, L_tmp2, pOverflow);
      L_tmp2 = Mpy_32_16(coeff[2], coeff_lo[2], g2_code, pOverflow);
      L_tmp = L_add(L_tmp, L_tmp2, pOverflow);
      L_tmp2 = Mpy_32_16(coeff[3], coeff_lo[3], g_code, pOverflow);
      L_tmp = L_add(L_tmp, L_tmp2, pOverflow);
      L_tmp2 = Mpy_32_16(coeff[4], coeff_lo[4], g_pit_cod, pOverflow);
      L_tmp = L_add(L_tmp, L_tmp2, pOverflow);

      /* store table index if MSE is lower than the minimum seen so far */
      if (L_tmp < dist_min) {
        dist_min = L_tmp;
        index = i;
      }
    }
  }

  /* Read the quantized gains */
  p = shl(index, 2, pOverflow);
  gain_pit[0] = table_gain[p++];
  g_code = table_gain[p++];
  qua_ener_MR122[0] = table_gain[p++];
  qua_ener[0] = table_gain[p];

  /* calculate final fixed codebook gain: gc = gc0 * g */
  L_tmp = L_mult(g_code, gcode0, pOverflow);
  temp = (10 - exp_gcode0) << 16 >> 16;
  L_tmp = L_shr(L_tmp, temp, pOverflow);

  gain_cod[0] = ((L_tmp >> 16) << 16) >> 16;

  return index;
}
