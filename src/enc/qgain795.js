/*
 * MR795 gain quantization, ported from opencore-amr 0.1.6 enc/src/qgain795.cpp
 * (MR795_gain_code_quant3, MR795_gain_code_quant_mod, MR795_gain_quant).
 * Active implementations transcribed line by line.
 */
import {
  MAX_32, sub, add_16, mult, shl, shr, pv_round,
  L_mult, L_shl, L_shr, L_sub, Mpy_32_16, Mac_32, Mac_32_16,
} from '../common/basicop.js';
import { L_Extract } from '../common/oper32b.js';
import { Pow2, sqrt_l_exp } from '../common/mathops.js';
import { MR795 } from '../common/cnst.js';
import { qua_gain_pitch, qua_gain_code } from '../common/tables/index.js';
import { q_gain_pitch, calc_unfilt_energies, gain_adapt } from './gains.js';

const NB_QUA_CODE = 32;

const q3Coeff = new Int16Array(5);
const q3CoeffLo = new Int16Array(5);
const q3ExpMax = new Int16Array(5);
const q3Hi = new Int16Array(1);
const q3Lo = new Int16Array(1);

/**
 * qgain795.cpp MR795_gain_code_quant3 (static).
 * gain_pit/gain_pit_ind/gain_cod/gain_cod_ind/qua_ener_MR122/qua_ener: outs.
 */
function MR795_gain_code_quant3(exp_gcode0, gcode0, g_pitch_cand, g_pitch_cind,
  frac_coeff, exp_coeff, gain_pit, gain_pit_ind, gain_cod, gain_cod_ind,
  qua_ener_MR122, qua_ener, pOverflow) {
  let cod_ind, pit_ind;
  let e_max, exp_code;
  let g_pitch, g2_pitch, g_code;
  const coeff = q3Coeff;
  const coeff_lo = q3CoeffLo;
  const exp_max = q3ExpMax;
  let L_tmp, L_tmp0;
  let dist_min;

  exp_code = (exp_gcode0 - 10) << 16 >> 16;
  exp_max[0] = (exp_coeff[0] - 13) << 16 >> 16;
  exp_max[1] = (exp_coeff[1] - 14) << 16 >> 16;
  exp_max[2] = (exp_coeff[2] + shl(exp_code, 1, pOverflow) + 15) << 16 >> 16;
  exp_max[3] = (exp_coeff[3] + exp_code) << 16 >> 16;
  exp_max[4] = (exp_coeff[4] + (exp_code + 1)) << 16 >> 16;

  e_max = exp_max[0];
  for (let i = 1; i < 5; i++) {
    if (exp_max[i] > e_max) {
      e_max = exp_max[i];
    }
  }
  e_max = add_16(e_max, 1, pOverflow);

  for (let i = 0; i < 5; i++) {
    const j = (e_max - exp_max[i]) << 16 >> 16;
    L_tmp = frac_coeff[i] << 16;
    L_tmp = L_shr(L_tmp, j, pOverflow);
    L_Extract(L_tmp, q3Hi, q3Lo, pOverflow);
    coeff[i] = q3Hi[0];
    coeff_lo[i] = q3Lo[0];
  }

  dist_min = MAX_32;
  cod_ind = 0;
  pit_ind = 0;
  for (let j = 0; j < 3; j++) {
    g_pitch = g_pitch_cand[j];
    g2_pitch = mult(g_pitch, g_pitch, pOverflow);
    L_tmp0 = Mpy_32_16(coeff[0], coeff_lo[0], g2_pitch, pOverflow);
    L_tmp0 = Mac_32_16(L_tmp0, coeff[1], coeff_lo[1], g_pitch, pOverflow);

    let p = 0;
    for (let i = 0; i < NB_QUA_CODE; i++) {
      g_code = qua_gain_code[p++]; /* g_fac Q11 */
      p++; /* skip log2 */
      p++; /* skip 20log10 */
      g_code = mult(g_code, gcode0, pOverflow);
      L_tmp = L_mult(g_code, g_code, pOverflow);
      L_Extract(L_tmp, q3Hi, q3Lo, pOverflow);
      const g2_code_h = q3Hi[0];
      const g2_code_l = q3Lo[0];
      L_tmp = L_mult(g_code, g_pitch, pOverflow);
      L_Extract(L_tmp, q3Hi, q3Lo, pOverflow);
      const g_pit_cod_h = q3Hi[0];
      const g_pit_cod_l = q3Lo[0];
      L_tmp = Mac_32(L_tmp0, coeff[2], coeff_lo[2], g2_code_h, g2_code_l, pOverflow);
      L_tmp = Mac_32_16(L_tmp, coeff[3], coeff_lo[3], g_code, pOverflow);
      L_tmp = Mac_32(L_tmp, coeff[4], coeff_lo[4], g_pit_cod_h, g_pit_cod_l, pOverflow);

      if (L_tmp < dist_min) {
        dist_min = L_tmp;
        cod_ind = i;
        pit_ind = j;
      }
    }
  }

  let p = (cod_ind << 2) - cod_ind;
  g_code = qua_gain_code[p++];
  qua_ener_MR122[0] = qua_gain_code[p++];
  qua_ener[0] = qua_gain_code[p];

  L_tmp = L_mult(g_code, gcode0, pOverflow);
  L_tmp = L_shr(L_tmp, (9 - exp_gcode0) << 16 >> 16, pOverflow);
  gain_cod[0] = ((L_tmp >> 16) << 16) >> 16;
  gain_cod_ind[0] = cod_ind;
  gain_pit[0] = g_pitch_cand[pit_ind];
  gain_pit_ind[0] = g_pitch_cind[pit_ind];
}

const qmCoeff = new Int16Array(5);
const qmCoeffLo = new Int16Array(5);
const qmExpCoeff = new Int16Array(5);
const qmHi = new Int16Array(1);
const qmLo = new Int16Array(1);
const qmExp = new Int16Array(1);

/**
 * qgain795.cpp MR795_gain_code_quant_mod (static).
 * gain_cod is 1-element in/out; qua_ener_MR122/qua_ener outs; returns index.
 */
function MR795_gain_code_quant_mod(gain_pit, exp_gcode0, gcode0,
  frac_en, exp_en, alpha, gain_cod_unq, gain_cod,
  qua_ener_MR122, qua_ener, pOverflow) {
  let index;
  let tmp;
  let one_alpha;
  let exp, e_max;
  let g2_pitch, g_code;
  const coeff = qmCoeff;
  const coeff_lo = qmCoeffLo;
  const exp_coeff = qmExpCoeff;
  let L_tmp, L_t0, L_t1;
  let dist_min;
  let gain_code;

  gain_code = shl(gain_cod[0], (10 - exp_gcode0) << 16 >> 16, pOverflow);
  g2_pitch = mult(gain_pit, gain_pit, pOverflow);
  one_alpha = add_16((32767 - alpha) << 16 >> 16, 1, pOverflow);

  L_t1 = L_mult(alpha, frac_en[1], pOverflow);
  L_t1 = L_shl(L_t1, 1, pOverflow);
  tmp = ((L_t1 >> 16) << 16) >> 16;
  L_t1 = L_mult(tmp, g2_pitch, pOverflow);
  exp_coeff[1] = (exp_en[1] - 15) << 16 >> 16;

  tmp = ((L_shl(L_mult(alpha, frac_en[2], pOverflow), 1, pOverflow) >> 16) << 16) >> 16;
  coeff[2] = mult(tmp, gain_pit, pOverflow);
  exp = (exp_gcode0 - 10) << 16 >> 16;
  exp_coeff[2] = add_16(exp_en[2], exp, pOverflow);

  coeff[3] = ((L_shl(L_mult(alpha, frac_en[3], pOverflow), 1, pOverflow) >> 16) << 16) >> 16;
  exp = (shl(exp_gcode0, 1, pOverflow) - 7) << 16 >> 16;
  exp_coeff[3] = add_16(exp_en[3], exp, pOverflow);

  coeff[4] = mult(one_alpha, frac_en[3], pOverflow);
  exp_coeff[4] = add_16(exp_coeff[3], 1, pOverflow);

  L_tmp = L_mult(alpha, frac_en[0], pOverflow);
  L_t0 = sqrt_l_exp(L_tmp, qmExp, pOverflow);
  exp = qmExp[0];
  exp = (exp + 47) << 16 >> 16;
  exp_coeff[0] = (exp_en[0] - exp) << 16 >> 16;

  e_max = (exp_coeff[0] + 31) << 16 >> 16;
  for (let i = 1; i <= 4; i++) {
    if (exp_coeff[i] > e_max) {
      e_max = exp_coeff[i];
    }
  }

  tmp = (e_max - exp_coeff[1]) << 16 >> 16;
  L_t1 = L_shr(L_t1, tmp, pOverflow);
  for (let i = 2; i <= 4; i++) {
    tmp = (e_max - exp_coeff[i]) << 16 >> 16;
    L_tmp = coeff[i] << 16;
    L_tmp = L_shr(L_tmp, tmp, pOverflow);
    L_Extract(L_tmp, qmHi, qmLo, pOverflow);
    coeff[i] = qmHi[0];
    coeff_lo[i] = qmLo[0];
  }

  exp = (e_max - 31) << 16 >> 16;
  tmp = (exp - exp_coeff[0]) << 16 >> 16;
  L_t0 = L_shr(L_t0, shr(tmp, 1, pOverflow), pOverflow);
  if ((tmp & 0x1) !== 0) {
    L_Extract(L_t0, qmHi, qmLo, pOverflow);
    coeff[0] = qmHi[0];
    coeff_lo[0] = qmLo[0];
    L_t0 = Mpy_32_16(coeff[0], coeff_lo[0], 23170, pOverflow); /* 1/sqrt(2) */
  }

  dist_min = MAX_32;
  index = 0;
  let p = 0;
  for (let i = 0; i < NB_QUA_CODE; i++) {
    g_code = qua_gain_code[p++];
    p++;
    p++;
    g_code = mult(g_code, gcode0, pOverflow);

    if (g_code >= gain_code) {
      break;
    }

    L_tmp = L_mult(g_code, g_code, pOverflow);
    L_Extract(L_tmp, qmHi, qmLo, pOverflow);
    const g2_code_h = qmHi[0];
    const g2_code_l = qmLo[0];
    tmp = sub(g_code, gain_cod_unq, pOverflow);
    L_tmp = L_mult(tmp, tmp, pOverflow);
    L_Extract(L_tmp, qmHi, qmLo, pOverflow);
    const d2_code_h = qmHi[0];
    const d2_code_l = qmLo[0];

    L_tmp = Mac_32_16(L_t1, coeff[2], coeff_lo[2], g_code, pOverflow);
    L_tmp = Mac_32(L_tmp, coeff[3], coeff_lo[3], g2_code_h, g2_code_l, pOverflow);
    L_tmp = sqrt_l_exp(L_tmp, qmExp, pOverflow);
    L_tmp = L_shr(L_tmp, shr(qmExp[0], 1, pOverflow), pOverflow);
    tmp = pv_round(L_sub(L_tmp, L_t0, pOverflow), pOverflow);
    L_tmp = L_mult(tmp, tmp, pOverflow);
    L_tmp = Mac_32(L_tmp, coeff[4], coeff_lo[4], d2_code_h, d2_code_l, pOverflow);

    if (L_tmp < dist_min) {
      dist_min = L_tmp;
      index = i;
    }
  }

  p = (index << 2) - index;
  g_code = qua_gain_code[p++];
  qua_ener_MR122[0] = qua_gain_code[p++];
  qua_ener[0] = qua_gain_code[p];

  L_tmp = L_mult(g_code, gcode0, pOverflow);
  L_tmp = L_shr(L_tmp, (9 - exp_gcode0) << 16 >> 16, pOverflow);
  gain_cod[0] = ((L_tmp >> 16) << 16) >> 16;

  return index;
}

const q795GpCand = new Int16Array(3);
const q795GpCind = new Int16Array(3);
const q795FracEn = new Int16Array(4);
const q795ExpEn = new Int16Array(4);
const q795Ltpg = new Int16Array(1);
const q795Alpha = new Int16Array(1);
const q795PitIdx = new Int16Array(1);
const q795CodIdx = new Int16Array(1);

/**
 * qgain795.cpp MR795_gain_quant.
 * gain_pit (in/out), gain_cod/qua_ener_MR122/qua_ener (out): 1-element arrays.
 * anap is a cursor object { arr, off }.
 */
export function MR795_gain_quant(adapt_st, res, resOff, exc, excOff, code, codeOff,
  frac_coeff, exp_coeff, exp_code_en, frac_code_en, exp_gcode0, frac_gcode0,
  L_subfr, cod_gain_frac, cod_gain_exp, gp_limit, gain_pit, gain_cod,
  qua_ener_MR122, qua_ener, anap, pOverflow) {
  const frac_en = q795FracEn;
  const exp_en = q795ExpEn;
  let gcode0;
  let exp;
  let gain_cod_unq;

  let gain_pit_index = q_gain_pitch(MR795, gp_limit, gain_pit,
    q795GpCand, q795GpCind, pOverflow);

  gcode0 = (Pow2(14, frac_gcode0, pOverflow) << 16) >> 16; /* Q14 */

  MR795_gain_code_quant3(exp_gcode0, gcode0, q795GpCand, q795GpCind,
    frac_coeff, exp_coeff, gain_pit, q795PitIdx, gain_cod, q795CodIdx,
    qua_ener_MR122, qua_ener, pOverflow);
  gain_pit_index = q795PitIdx[0];
  let gain_cod_index = q795CodIdx[0];

  calc_unfilt_energies(res, resOff, exc, excOff, code, codeOff, gain_pit[0],
    L_subfr, frac_en, exp_en, q795Ltpg, pOverflow);

  gain_adapt(adapt_st, q795Ltpg[0], gain_cod[0], q795Alpha, pOverflow);

  if (frac_en[0] !== 0 && q795Alpha[0] > 0) {
    frac_en[3] = frac_code_en;
    exp_en[3] = exp_code_en;
    exp = (sub(cod_gain_exp, exp_gcode0, pOverflow) + 10) << 16 >> 16;
    gain_cod_unq = shl(cod_gain_frac, exp, pOverflow);
    gain_cod_index = MR795_gain_code_quant_mod(gain_pit[0], exp_gcode0, gcode0,
      frac_en, exp_en, q795Alpha[0], gain_cod_unq, gain_cod,
      qua_ener_MR122, qua_ener, pOverflow);
  }

  anap.arr[anap.off++] = gain_pit_index;
  anap.arr[anap.off++] = gain_cod_index;
}
