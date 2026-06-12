/*
 * Gain and lag decoding, ported from opencore-amr 0.1.6 dec/src:
 *   d_gain_p.cpp (d_gain_pitch), d_gain_c.cpp (d_gain_code),
 *   dec_gain.cpp (Dec_gain), dec_lag3.cpp (Dec_lag3), dec_lag6.cpp (Dec_lag6)
 * Active implementations transcribed line by line.
 */
import {
  mult, sub, shl, add_16, shr_r, pv_round, L_mult, L_shl, L_shr, Mpy_32_16,
} from '../common/basicop.js';
import { Log2, Pow2 } from '../common/mathops.js';
import { MR122, MR475, MR102, MR795, MR74, MR67 } from '../common/cnst.js';
import {
  qua_gain_pitch, qua_gain_code, table_gain_MR475,
  table_gain_highrates, table_gain_lowrates,
} from '../common/tables/index.js';
import { gc_pred, gc_pred_update } from '../common/gc_pred.js';

const MR475_VQ_SIZE = 256;

/** d_gain_p.cpp d_gain_pitch: returns gain (Q14) */
export function d_gain_pitch(mode, index) {
  let gain = qua_gain_pitch[index];
  if (mode === MR122) {
    /* clear 2 LSBits */
    gain = ((gain & 0xfffc) << 16) >> 16;
  }
  return gain;
}

const dgExp = new Int16Array(1);
const dgFrac = new Int16Array(1);
const dgExpEn = new Int16Array(1);
const dgFracEn = new Int16Array(1);

/**
 * d_gain_c.cpp d_gain_code (MR795/MR122).
 * @param {Int16Array} gain_code 1-element out
 */
export function d_gain_code(pred_state, mode, index, code, codeOff, gain_code, pOverflow) {
  let gcode0;
  let L_tmp;

  /* predict codebook gain */
  gc_pred(pred_state, mode, code, codeOff, dgExp, dgFrac, dgExpEn, dgFracEn, pOverflow);
  const exp = dgExp[0];
  const frac = dgFrac[0];

  index &= 31; /* index < 32, to avoid buffer overflow */
  const tbl_tmp = index + (index << 1);
  let p = tbl_tmp; /* into qua_gain_code */

  /* Different scalings between MR122 and the other modes */
  const temp = sub(mode, MR122, pOverflow);
  if (temp === 0) {
    gcode0 = (Pow2(exp, frac, pOverflow) << 16) >> 16; /* predicted gain */
    gcode0 = shl(gcode0, 4, pOverflow);
    gain_code[0] = shl(mult(gcode0, qua_gain_code[p++], pOverflow), 1, pOverflow);
  } else {
    gcode0 = (Pow2(14, frac, pOverflow) << 16) >> 16;
    L_tmp = L_mult(qua_gain_code[p++], gcode0, pOverflow);
    L_tmp = L_shr(L_tmp, sub(9, exp, pOverflow), pOverflow);
    gain_code[0] = ((L_tmp >> 16) << 16) >> 16; /* Q1 */
  }

  /* update table of past quantized energies */
  const qua_ener_MR122 = qua_gain_code[p++];
  const qua_ener = qua_gain_code[p++];
  gc_pred_update(pred_state, qua_ener_MR122, qua_ener);
}

/**
 * dec_gain.cpp Dec_gain: decode pitch and codebook gains.
 * @param {Int16Array} gain_pit 1-element out
 * @param {Int16Array} gain_cod 1-element out
 */
export function Dec_gain(pred_state, mode, index, code, codeOff, evenSubfr,
  gain_pit, gain_cod, pOverflow) {
  let p;
  let tbl;
  let g_code;
  let qua_ener;
  let qua_ener_MR122;
  let L_tmp;
  let temp1;
  let temp2;

  /* Read the quantized gains (table depends on mode) */
  index = shl(index, 2, pOverflow);

  if (mode === MR102 || mode === MR74 || mode === MR67) {
    tbl = table_gain_highrates;
    p = index;
    gain_pit[0] = tbl[p++];
    g_code = tbl[p++];
    qua_ener_MR122 = tbl[p++];
    qua_ener = tbl[p];
  } else if (mode === MR475) {
    index += (1 ^ evenSubfr) << 1; /* evenSubfr is 0 or 1 */
    if (index > MR475_VQ_SIZE * 4 - 2) {
      index = MR475_VQ_SIZE * 4 - 2; /* avoid possible buffer overflow */
    }
    tbl = table_gain_MR475;
    p = index;
    gain_pit[0] = tbl[p++];
    g_code = tbl[p++];

    /* calculate predictor update values:
       qua_ener = log2(g), qua_ener_MR122 = 20*log10(g) */
    /* Log2(x Q12) = log2(x) + 12 */
    temp1 = g_code;
    Log2(temp1, dgExp, dgFrac, pOverflow);
    const exp475 = (dgExp[0] - 12) << 16 >> 16;
    temp1 = shr_r(dgFrac[0], 5, pOverflow);
    temp2 = shl(exp475, 10, pOverflow);
    qua_ener_MR122 = add_16(temp1, temp2, pOverflow);

    /* 24660 Q12 ~= 6.0206 = 20*log10(2) */
    L_tmp = Mpy_32_16(exp475, dgFrac[0], 24660, pOverflow);
    L_tmp = L_shl(L_tmp, 13, pOverflow);
    qua_ener = pv_round(L_tmp, pOverflow); /* Q12 * Q0 = Q13 -> Q10 */
  } else {
    tbl = table_gain_lowrates;
    p = index;
    gain_pit[0] = tbl[p++];
    g_code = tbl[p++];
    qua_ener_MR122 = tbl[p++];
    qua_ener = tbl[p];
  }

  /* predict codebook gain: gcode0 (Q14) = 2^14*2^frac = gc0 * 2^(14-exp) */
  gc_pred(pred_state, mode, code, codeOff, dgExp, dgFrac, null, null, pOverflow);
  const gcode0 = (Pow2(14, dgFrac[0], pOverflow) << 16) >> 16;

  L_tmp = L_mult(g_code, gcode0, pOverflow);
  temp1 = (10 - dgExp[0]) << 16 >> 16;
  L_tmp = L_shr(L_tmp, temp1, pOverflow);
  gain_cod[0] = ((L_tmp >> 16) << 16) >> 16;

  /* update table of past quantized energies */
  gc_pred_update(pred_state, qua_ener_MR122, qua_ener);
}

/**
 * dec_lag3.cpp Dec_lag3.
 * @param {Int16Array} T0 1-element in/out
 * @param {Int16Array} T0_frac 1-element out
 */
export function Dec_lag3(index, t0_min, t0_max, i_subfr, T0_prev, T0, T0_frac,
  flag4, pOverflow) {
  let i;
  let tmp_lag;

  if (i_subfr === 0) {
    /* if 1st or 3rd subframe */
    if (index < 197) {
      tmp_lag = (index + 2) << 16 >> 16;
      tmp_lag = mult(tmp_lag, 10923, pOverflow);
      i = (tmp_lag + 19) << 16 >> 16;
      T0[0] = i;

      /* i = 3 * (*T0) */
      i = (i << 1) << 16 >> 16;
      i = (i + T0[0]) << 16 >> 16;

      tmp_lag = (index - i) << 16 >> 16;
      T0_frac[0] = (tmp_lag + 58) << 16 >> 16;
    } else {
      T0[0] = (index - 112) << 16 >> 16;
      T0_frac[0] = 0;
    }
  } else {
    /* 2nd or 4th subframe */
    if (flag4 === 0) {
      /* 'normal' decoding: either with 5 or 6 bit resolution */
      i = (index + 2) << 16 >> 16;
      i = (Math.imul(i, 10923) >> 15) << 16 >> 16;
      i = (i - 1) << 16 >> 16;
      T0[0] = (i + t0_min) << 16 >> 16;

      /* i = 3* (*T0) */
      i = (i + ((i << 1) << 16 >> 16)) << 16 >> 16;

      tmp_lag = (index - 2) << 16 >> 16;
      T0_frac[0] = (tmp_lag - i) << 16 >> 16;
    } else {
      /* decoding with 4 bit resolution */
      tmp_lag = T0_prev;
      i = sub(tmp_lag, t0_min, pOverflow);
      if (i > 5) {
        tmp_lag = (t0_min + 5) << 16 >> 16;
      }
      i = (t0_max - tmp_lag) << 16 >> 16;
      if (i > 4) {
        tmp_lag = (t0_max - 4) << 16 >> 16;
      }

      if (index < 4) {
        i = (tmp_lag - 5) << 16 >> 16;
        T0[0] = (i + index) << 16 >> 16;
        T0_frac[0] = 0;
      } else if (index < 12) {
        /* 4 <= index < 12 */
        i = (index - 5) << 16 >> 16;
        i = (Math.imul(i, 10923) >> 15) << 16 >> 16;
        i = (i - 1) << 16 >> 16;
        T0[0] = (i + tmp_lag) << 16 >> 16;

        i = (i + ((i << 1) << 16 >> 16)) << 16 >> 16;

        tmp_lag = (index - 9) << 16 >> 16;
        T0_frac[0] = (tmp_lag - i) << 16 >> 16;
      } else {
        i = (index - 12) << 16 >> 16;
        i = (i + tmp_lag) << 16 >> 16;
        T0[0] = (i + 1) << 16 >> 16;
        T0_frac[0] = 0;
      }
    }
  }
}

/**
 * dec_lag6.cpp Dec_lag6.
 * @param {Int16Array} T0 1-element in/out
 * @param {Int16Array} T0_frac 1-element out
 */
export function Dec_lag6(index, pit_min, pit_max, i_subfr, T0, T0_frac, pOverflow) {
  let i;
  let T0_min;
  let T0_max;
  let k;

  if (i_subfr === 0) {
    /* if 1st or 3rd subframe */
    if (index < 463) {
      /* T0 = (index+5)/6 + 17 */
      i = (index + 5) << 16 >> 16;
      i = (Math.imul(i, 5462) >> 15) << 16 >> 16;
      i = (i + 17) << 16 >> 16;
      T0[0] = i;

      /* i = 3* (*T0) */
      i = (i << 1) << 16 >> 16;
      i = (i + T0[0]) << 16 >> 16;

      /* *T0_frac = index - T0*6 + 105 */
      i = (i << 1) << 16 >> 16;
      i = (index - i) << 16 >> 16;
      T0_frac[0] = (i + 105) << 16 >> 16;
    } else {
      T0[0] = (index - 368) << 16 >> 16;
      T0_frac[0] = 0;
    }
  } else {
    /* second or fourth subframe */
    /* find T0_min and T0_max for 2nd (or 4th) subframe */
    T0_min = (T0[0] - 5) << 16 >> 16;
    if (T0_min < pit_min) {
      T0_min = pit_min;
    }
    T0_max = (T0_min + 9) << 16 >> 16;
    if (T0_max > pit_max) {
      T0_max = pit_max;
      T0_min = (T0_max - 9) << 16 >> 16;
    }

    /* i = (index+5)/6 - 1 */
    i = (index + 5) << 16 >> 16;
    i = (Math.imul(i, 5462) >> 15) << 16 >> 16;
    i = (i - 1) << 16 >> 16;
    T0[0] = (i + T0_min) << 16 >> 16;

    /* i = 3* (*T0) */
    i = (i + ((i << 1) << 16 >> 16)) << 16 >> 16;
    i = (i << 1) << 16 >> 16;

    k = (index - 3) << 16 >> 16;
    T0_frac[0] = (k - i) << 16 >> 16;
  }
}
