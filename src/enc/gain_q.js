/*
 * Gain quantizer dispatcher, ported from opencore-amr 0.1.6 enc/src/gain_q.cpp
 * (gainQuantState, gainQuant). Active implementation transcribed line by line.
 */
import { shl } from '../common/basicop.js';
import { L_SUBFR, MR475, MR122, MR795 } from '../common/cnst.js';
import { gc_predState, gc_pred, gc_pred_update } from '../common/gc_pred.js';
import {
  G_code, q_gain_code, calc_filt_energies, calc_target_energy, Qua_gain,
  GainAdaptState,
} from './gains.js';
import { MR475_gain_quant, MR475_update_unq_pred } from './qgain475.js';
import { MR795_gain_quant } from './qgain795.js';

const NPRED = 4;

/** gain_q.h gainQuantState */
export class gainQuantState {
  constructor() {
    this.sf0_exp_gcode0 = 0;
    this.sf0_frac_gcode0 = 0;
    this.sf0_exp_target_en = 0;
    this.sf0_frac_target_en = 0;
    this.sf0_exp_coeff = new Int16Array(5);
    this.sf0_frac_coeff = new Int16Array(5);
    this.gain_idx_off = 0; /* JS: offset into anap.arr for sf0 gain index */
    this.gc_predSt = new gc_predState();
    this.gc_predUnqSt = new gc_predState();
    this.adaptSt = new GainAdaptState();
    this.reset();
  }

  /** gain_q.cpp gainQuant_reset */
  reset() {
    this.sf0_exp_gcode0 = 0;
    this.sf0_frac_gcode0 = 0;
    this.sf0_exp_target_en = 0;
    this.sf0_frac_target_en = 0;
    this.sf0_exp_coeff.fill(0);
    this.sf0_frac_coeff.fill(0);
    this.gain_idx_off = 0;
    this.gc_predSt.reset();
    this.gc_predUnqSt.reset();
    this.adaptSt.reset();
    return 0;
  }
}

const gqExp = new Int16Array(1);
const gqFrac = new Int16Array(1);
const gqExpEn = new Int16Array(1);
const gqFracEn = new Int16Array(1);
const gqQuaEnerMR122 = new Int16Array(1);
const gqQuaEner = new Int16Array(1);
const gqFracCoeff = new Int16Array(5);
const gqExpCoeff = new Int16Array(5);
const gqCodGainFrac = new Int16Array(1);
const gqCodGainExp = new Int16Array(1);
const gqSf0ExpGc = new Int16Array(1);
const gqSf0FracGc = new Int16Array(1);
const gqSf0ExpTen = new Int16Array(1);
const gqSf0FracTen = new Int16Array(1);

/**
 * gain_q.cpp gainQuant.
 * gain_pit (in/out), gain_cod / sf0_gain_pit / sf0_gain_cod (out): 1-elt arrays.
 * anap is a cursor object { arr, off }.
 */
export function gainQuant(st, mode, res, resOff, exc, excOff, code, codeOff,
  xn, xnOff, xn2, xn2Off, y1, y1Off, Y2, Y2Off, g_coeff, g_coeffOff,
  even_subframe, gp_limit, sf0_gain_pit, sf0_gain_cod, gain_pit, gain_cod,
  anap, pOverflow) {
  let temp;

  if (mode === MR475) {
    if (even_subframe !== 0) {
      /* reserve the gain index slot; snapshot predictor into Unq predictor */
      st.gain_idx_off = anap.off;
      anap.off++;

      st.gc_predUnqSt.past_qua_en.set(st.gc_predSt.past_qua_en.subarray(0, NPRED));
      st.gc_predUnqSt.past_qua_en_MR122.set(st.gc_predSt.past_qua_en_MR122.subarray(0, NPRED));

      gc_pred(st.gc_predUnqSt, mode, code, codeOff, gqSf0ExpGc, gqSf0FracGc,
        gqExpEn, gqFracEn, pOverflow);
      st.sf0_exp_gcode0 = gqSf0ExpGc[0];
      st.sf0_frac_gcode0 = gqSf0FracGc[0];

      calc_filt_energies(mode, xn, xnOff, xn2, xn2Off, y1, y1Off, Y2, Y2Off,
        g_coeff, g_coeffOff, st.sf0_frac_coeff, st.sf0_exp_coeff,
        gqCodGainFrac, gqCodGainExp, pOverflow);

      temp = (gqCodGainExp[0] + 1) << 16 >> 16;
      gain_cod[0] = shl(gqCodGainFrac[0], temp, pOverflow);

      calc_target_energy(xn, xnOff, gqSf0ExpTen, gqSf0FracTen, pOverflow);
      st.sf0_exp_target_en = gqSf0ExpTen[0];
      st.sf0_frac_target_en = gqSf0FracTen[0];

      MR475_update_unq_pred(st.gc_predUnqSt, st.sf0_exp_gcode0, st.sf0_frac_gcode0,
        gqCodGainExp[0], gqCodGainFrac[0], pOverflow);
    } else {
      gc_pred(st.gc_predUnqSt, mode, code, codeOff, gqExp, gqFrac,
        gqExpEn, gqFracEn, pOverflow);

      calc_filt_energies(mode, xn, xnOff, xn2, xn2Off, y1, y1Off, Y2, Y2Off,
        g_coeff, g_coeffOff, gqFracCoeff, gqExpCoeff,
        gqCodGainFrac, gqCodGainExp, pOverflow);

      calc_target_energy(xn, xnOff, gqExpEn, gqFracEn, pOverflow);

      anap.arr[st.gain_idx_off] = MR475_gain_quant(st.gc_predSt,
        st.sf0_exp_gcode0, st.sf0_frac_gcode0, st.sf0_exp_coeff, st.sf0_frac_coeff,
        st.sf0_exp_target_en, st.sf0_frac_target_en,
        code, codeOff, gqExp[0], gqFrac[0], gqExpCoeff, gqFracCoeff,
        gqExpEn[0], gqFracEn[0], gp_limit,
        sf0_gain_pit, sf0_gain_cod, gain_pit, gain_cod, pOverflow);
    }
  } else {
    gc_pred(st.gc_predSt, mode, code, codeOff, gqExp, gqFrac,
      gqExpEn, gqFracEn, pOverflow);

    if (mode === MR122) {
      gain_cod[0] = G_code(xn2, xn2Off, Y2, Y2Off, pOverflow);
      anap.arr[anap.off++] = q_gain_code(mode, gqExp[0], gqFrac[0], gain_cod,
        gqQuaEnerMR122, gqQuaEner, pOverflow);
    } else {
      calc_filt_energies(mode, xn, xnOff, xn2, xn2Off, y1, y1Off, Y2, Y2Off,
        g_coeff, g_coeffOff, gqFracCoeff, gqExpCoeff,
        gqCodGainFrac, gqCodGainExp, pOverflow);

      if (mode === MR795) {
        MR795_gain_quant(st.adaptSt, res, resOff, exc, excOff, code, codeOff,
          gqFracCoeff, gqExpCoeff, gqExpEn[0], gqFracEn[0], gqExp[0], gqFrac[0],
          L_SUBFR, gqCodGainFrac[0], gqCodGainExp[0], gp_limit,
          gain_pit, gain_cod, gqQuaEnerMR122, gqQuaEner, anap, pOverflow);
      } else {
        anap.arr[anap.off++] = Qua_gain(mode, gqExp[0], gqFrac[0],
          gqFracCoeff, gqExpCoeff, gp_limit, gain_pit, gain_cod,
          gqQuaEnerMR122, gqQuaEner, pOverflow);
      }
    }

    gc_pred_update(st.gc_predSt, gqQuaEnerMR122[0], gqQuaEner[0]);
  }
}
