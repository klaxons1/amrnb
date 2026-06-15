/*
 * MR475 gain quantization, ported from opencore-amr 0.1.6 enc/src/qgain475.cpp
 * (MR475_quant_store_results, MR475_update_unq_pred, MR475_gain_quant).
 * Active implementations transcribed line by line.
 */
import {
  MAX_32, shr_r, div_s, pv_round, L_shl, L_shr, Mpy_32_16,
} from '../common/basicop.js';
import { Pow2, Log2 } from '../common/mathops.js';
import { gc_pred, gc_pred_update } from '../common/gc_pred.js';
import { MR475 } from '../common/cnst.js';
import { table_gain_MR475 } from '../common/tables/index.js';

const MR475_VQ_SIZE = 256;
const MIN_QUA_ENER = -5443;
const MIN_QUA_ENER_MR122 = -32768;
const MAX_QUA_ENER = 3037;
const MAX_QUA_ENER_MR122 = 18284;

const sExp = new Int16Array(1);
const sFrac = new Int16Array(1);

/** qgain475.cpp MR475_quant_store_results (static) */
function MR475_quant_store_results(pred_st, table, pOff, gcode0, exp_gcode0,
  gain_pit, gain_cod, pOverflow) {
  let g_code;
  let exp;
  let frac;
  let tmp;
  let L_tmp;
  let qua_ener_MR122;
  let qua_ener;

  gain_pit[0] = table[pOff++];
  g_code = table[pOff++];

  L_tmp = (g_code * gcode0) << 1;
  tmp = (10 - exp_gcode0) << 16 >> 16;
  L_tmp = L_shr(L_tmp, tmp, pOverflow);
  gain_cod[0] = ((L_tmp >> 16) << 16) >> 16;

  Log2(g_code, sExp, sFrac, pOverflow);
  exp = sExp[0];
  frac = sFrac[0];
  exp = (exp - 12) << 16 >> 16;
  tmp = shr_r(frac, 5, pOverflow);
  qua_ener_MR122 = exp << 10;
  qua_ener_MR122 = (tmp + qua_ener_MR122) << 16 >> 16;
  L_tmp = Mpy_32_16(exp, frac, 24660, pOverflow);
  L_tmp = L_tmp << 13;
  qua_ener = (((L_tmp + 0x00008000) | 0) >> 16) << 16 >> 16;

  gc_pred_update(pred_st, qua_ener_MR122, qua_ener);
}

/** qgain475.cpp MR475_update_unq_pred */
export function MR475_update_unq_pred(pred_st, exp_gcode0, frac_gcode0,
  cod_gain_exp, cod_gain_frac, pOverflow) {
  let tmp;
  let exp;
  let frac;
  let qua_ener;
  let qua_ener_MR122;
  let L_tmp;

  if (cod_gain_frac <= 0) {
    qua_ener = MIN_QUA_ENER;
    qua_ener_MR122 = MIN_QUA_ENER_MR122;
  } else {
    frac_gcode0 = (Pow2(14, frac_gcode0, pOverflow) << 16) >> 16;
    if (cod_gain_frac >= frac_gcode0) {
      cod_gain_frac >>= 1;
      cod_gain_exp = (cod_gain_exp + 1) << 16 >> 16;
    }

    frac = div_s(cod_gain_frac, frac_gcode0);
    tmp = (cod_gain_exp - exp_gcode0) << 16 >> 16;
    tmp = (tmp - 1) << 16 >> 16;

    Log2(frac, sExp, sFrac, pOverflow);
    exp = sExp[0];
    frac = sFrac[0];
    exp = (exp + tmp) << 16 >> 16;

    qua_ener_MR122 = shr_r(frac, 5, pOverflow);
    tmp = exp << 10;
    qua_ener_MR122 = (qua_ener_MR122 + tmp) << 16 >> 16;

    if (qua_ener_MR122 > MAX_QUA_ENER_MR122) {
      qua_ener = MAX_QUA_ENER;
      qua_ener_MR122 = MAX_QUA_ENER_MR122;
    } else {
      L_tmp = Mpy_32_16(exp, frac, 24660, pOverflow);
      L_tmp = L_shl(L_tmp, 13, pOverflow);
      qua_ener = pv_round(L_tmp, pOverflow);
    }
  }

  gc_pred_update(pred_st, qua_ener_MR122, qua_ener);
}

const m475Coeff = new Int16Array(10);
const m475CoeffLo = new Int16Array(10);
const m475ExpMax = new Int16Array(10);
const m475SfExp = new Int16Array(1);
const m475SfFrac = new Int16Array(1);
const m475Dummy1 = new Int16Array(1);
const m475Dummy2 = new Int16Array(1);

/**
 * qgain475.cpp MR475_gain_quant: jointly quantizes subframe-0 and -1 gains.
 * gain_pit/gain_cod outs are 1-element Int16Array; returns code index.
 */
export function MR475_gain_quant(pred_st, sf0_exp_gcode0, sf0_frac_gcode0,
  sf0_exp_coeff, sf0_frac_coeff, sf0_exp_target_en, sf0_frac_target_en,
  sf1_code_nosharp, sf1_code_nosharpOff, sf1_exp_gcode0, sf1_frac_gcode0,
  sf1_exp_coeff, sf1_frac_coeff, sf1_exp_target_en, sf1_frac_target_en,
  gp_limit, sf0_gain_pit, sf0_gain_cod, sf1_gain_pit, sf1_gain_cod, pOverflow) {
  let index = 0;
  let tmp;
  let exp;
  let sf0_gcode0, sf1_gcode0;
  let g_pitch, g2_pitch, g_code, g2_code, g_pit_cod;
  const coeff = m475Coeff;
  const coeff_lo = m475CoeffLo;
  const exp_max = m475ExpMax;
  let L_tmp;
  let dist_min;

  sf0_gcode0 = (Pow2(14, sf0_frac_gcode0, pOverflow) << 16) >> 16;
  sf1_gcode0 = (Pow2(14, sf1_frac_gcode0, pOverflow) << 16) >> 16;

  exp = (sf0_exp_gcode0 - 11) << 16 >> 16;
  exp_max[0] = (sf0_exp_coeff[0] - 13) << 16 >> 16;
  exp_max[1] = (sf0_exp_coeff[1] - 14) << 16 >> 16;
  exp_max[2] = (sf0_exp_coeff[2] + (15 + (exp << 1))) << 16 >> 16;
  exp_max[3] = (sf0_exp_coeff[3] + exp) << 16 >> 16;
  exp_max[4] = (sf0_exp_coeff[4] + (1 + exp)) << 16 >> 16;
  exp = (sf1_exp_gcode0 - 11) << 16 >> 16;
  exp_max[5] = (sf1_exp_coeff[0] - 13) << 16 >> 16;
  exp_max[6] = (sf1_exp_coeff[1] - 14) << 16 >> 16;
  exp_max[7] = (sf1_exp_coeff[2] + (15 + (exp << 1))) << 16 >> 16;
  exp_max[8] = (sf1_exp_coeff[3] + exp) << 16 >> 16;
  exp_max[9] = (sf1_exp_coeff[4] + (1 + exp)) << 16 >> 16;

  /* align target energies of the two subframes by shifting the smaller frac */
  exp = (sf0_exp_target_en - sf1_exp_target_en) << 16 >> 16;
  if (exp > 0) {
    sf1_frac_target_en = sf1_frac_target_en >> exp;
  } else {
    sf0_frac_target_en = sf0_frac_target_en >> -exp;
  }

  exp = 0;
  tmp = shr_r(sf1_frac_target_en, 1, pOverflow); /* ceil(0.5*en(sf1)) */
  if (tmp > sf0_frac_target_en) {
    exp = 1;
  } else {
    tmp = ((sf0_frac_target_en + 3) >> 2) << 16 >> 16; /* ceil(0.25*en(sf0)) */
    if (tmp > sf1_frac_target_en) {
      exp = -1;
    }
  }
  for (let i = 0; i < 5; i++) {
    exp_max[i] = (exp_max[i] + exp) << 16 >> 16;
  }

  /* find max exponent */
  exp = exp_max[0];
  for (let i = 9; i > 0; i--) {
    if (exp_max[i] > exp) {
      exp = exp_max[i];
    }
  }
  exp++;

  let p = 0;
  for (let i = 0; i < 5; i++) {
    tmp = (exp - exp_max[i]) << 16 >> 16;
    L_tmp = sf0_frac_coeff[p++] << 16;
    L_tmp = L_shr(L_tmp, tmp, pOverflow);
    coeff[i] = ((L_tmp >> 16) << 16) >> 16;
    coeff_lo[i] = (((L_tmp >> 1) - ((L_tmp >> 16) << 15)) << 16) >> 16;
  }
  p = 0;
  for (let i = 5; i < 10; i++) {
    tmp = (exp - exp_max[i]) << 16 >> 16;
    L_tmp = sf1_frac_coeff[p++] << 16;
    L_tmp = L_shr(L_tmp, tmp, pOverflow);
    coeff[i] = ((L_tmp >> 16) << 16) >> 16;
    coeff_lo[i] = (((L_tmp >> 1) - ((L_tmp >> 16) << 15)) << 16) >> 16;
  }

  dist_min = MAX_32;
  p = 0;
  for (let i = 0; i < MR475_VQ_SIZE; i++) {
    g_pitch = table_gain_MR475[p++];
    g_code = table_gain_MR475[p++];

    g_code = ((g_code * sf0_gcode0) >> 15) << 16 >> 16;
    g2_pitch = ((g_pitch * g_pitch) >> 15) << 16 >> 16;
    g2_code = ((g_code * g_code) >> 15) << 16 >> 16;
    g_pit_cod = ((g_code * g_pitch) >> 15) << 16 >> 16;

    L_tmp = (Mpy_32_16(coeff[0], coeff_lo[0], g2_pitch, pOverflow)
      + Mpy_32_16(coeff[1], coeff_lo[1], g_pitch, pOverflow)
      + Mpy_32_16(coeff[2], coeff_lo[2], g2_code, pOverflow)
      + Mpy_32_16(coeff[3], coeff_lo[3], g_code, pOverflow)
      + Mpy_32_16(coeff[4], coeff_lo[4], g_pit_cod, pOverflow)) | 0;

    tmp = (g_pitch - gp_limit) << 16 >> 16;
    g_pitch = table_gain_MR475[p++];
    g_code = table_gain_MR475[p++];

    if (tmp <= 0 && g_pitch <= gp_limit) {
      g_code = ((g_code * sf1_gcode0) >> 15) << 16 >> 16;
      g2_pitch = ((g_pitch * g_pitch) >> 15) << 16 >> 16;
      g2_code = ((g_code * g_code) >> 15) << 16 >> 16;
      g_pit_cod = ((g_code * g_pitch) >> 15) << 16 >> 16;

      L_tmp = (L_tmp
        + (Mpy_32_16(coeff[5], coeff_lo[5], g2_pitch, pOverflow)
          + Mpy_32_16(coeff[6], coeff_lo[6], g_pitch, pOverflow)
          + Mpy_32_16(coeff[7], coeff_lo[7], g2_code, pOverflow)
          + Mpy_32_16(coeff[8], coeff_lo[8], g_code, pOverflow)
          + Mpy_32_16(coeff[9], coeff_lo[9], g_pit_cod, pOverflow))) | 0;

      if (L_tmp < dist_min) {
        dist_min = L_tmp;
        index = i;
      }
    }
  }

  /* store results for subframe 0 and update predictor with quantized gains */
  tmp = index << 2;
  MR475_quant_store_results(pred_st, table_gain_MR475, tmp, sf0_gcode0,
    sf0_exp_gcode0, sf0_gain_pit, sf0_gain_cod, pOverflow);

  /* re-run prediction for subframe 1 (with quantized gains) */
  m475SfExp[0] = sf1_exp_gcode0;
  m475SfFrac[0] = sf1_frac_gcode0;
  gc_pred(pred_st, MR475, sf1_code_nosharp, sf1_code_nosharpOff,
    m475SfExp, m475SfFrac, m475Dummy1, m475Dummy2, pOverflow);
  sf1_exp_gcode0 = m475SfExp[0];
  sf1_frac_gcode0 = m475SfFrac[0];
  sf1_gcode0 = (Pow2(14, sf1_frac_gcode0, pOverflow) << 16) >> 16;

  tmp += 2;
  MR475_quant_store_results(pred_st, table_gain_MR475, tmp, sf1_gcode0,
    sf1_exp_gcode0, sf1_gain_pit, sf1_gain_cod, pOverflow);

  return index;
}
