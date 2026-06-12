/*
 * Error-concealment gains and LSP averaging, ported from opencore-amr 0.1.6
 * dec/src/ec_gains.cpp and dec/src/lsp_avg.cpp.
 * Active implementations transcribed line by line.
 */
import { sub, mult, pv_round, L_mac, L_msu } from '../common/basicop.js';
import { gmed_n } from '../common/mathops.js';
import { gc_pred_average_limited, gc_pred_update } from '../common/gc_pred.js';
import { M } from '../common/cnst.js';
import { mean_lsf_5 } from '../common/tables/index.js';

/** ec_gains.h ec_gain_pitchState */
export class ec_gain_pitchState {
  constructor() {
    this.pbuf = new Int16Array(5);
    this.past_gain_pit = 0;
    this.prev_gp = 0;
    this.reset();
  }

  /** ec_gains.cpp ec_gain_pitch_reset */
  reset() {
    this.pbuf.fill(1640);
    this.past_gain_pit = 0;
    this.prev_gp = 16384;
    return 0;
  }
}

/** ec_gains.h ec_gain_codeState */
export class ec_gain_codeState {
  constructor() {
    this.gbuf = new Int16Array(5);
    this.past_gain_code = 0;
    this.prev_gc = 0;
    this.reset();
  }

  /** ec_gains.cpp ec_gain_code_reset */
  reset() {
    this.gbuf.fill(1);
    this.past_gain_code = 0;
    this.prev_gc = 1;
    return 0;
  }
}

const cdown = Int16Array.from([32767, 32112, 32112, 32112, 32112, 32112, 22937]);
const pdown = Int16Array.from([32767, 32112, 32112, 26214, 9830, 6553, 6553]);

const ecQuaEnerMR122 = new Int16Array(1);
const ecQuaEner = new Int16Array(1);

/**
 * ec_gains.cpp ec_gain_code.
 * @param {Int16Array} gain_code 1-element out
 */
export function ec_gain_code(st, pred_state, state, gain_code, pOverflow) {
  /* calculate median of last five gain values */
  let tmp = gmed_n(st.gbuf, 0, 5);

  /* new gain = minimum(median, past_gain) * cdown[state] */
  if (sub(tmp, st.past_gain_code, pOverflow) > 0) {
    tmp = st.past_gain_code;
  }
  tmp = mult(tmp, cdown[state], pOverflow);
  gain_code[0] = tmp;

  /* update table of past quantized energies with average of current values */
  gc_pred_average_limited(pred_state, ecQuaEnerMR122, ecQuaEner, pOverflow);
  gc_pred_update(pred_state, ecQuaEnerMR122[0], ecQuaEner[0]);
}

/**
 * ec_gains.cpp ec_gain_code_update.
 * @param {Int16Array} gain_code 1-element in/out
 */
export function ec_gain_code_update(st, bfi, prev_bf, gain_code, pOverflow) {
  /* limit gain_code by previous good gain if previous frame was bad */
  if (bfi === 0) {
    if (prev_bf !== 0) {
      if (sub(gain_code[0], st.prev_gc, pOverflow) > 0) {
        gain_code[0] = st.prev_gc;
      }
    }
    st.prev_gc = gain_code[0];
  }

  /* update EC states: previous gain, gain buffer */
  st.past_gain_code = gain_code[0];
  for (let i = 1; i < 5; i++) {
    st.gbuf[i - 1] = st.gbuf[i];
  }
  st.gbuf[4] = gain_code[0];
}

/**
 * ec_gains.cpp ec_gain_pitch.
 * @param {Int16Array} gain_pitch 1-element out (Q14)
 */
export function ec_gain_pitch(st, state, gain_pitch, pOverflow) {
  /* calculate median of last five gains */
  let tmp = gmed_n(st.pbuf, 0, 5);

  /* new gain = minimum(median, past_gain) * pdown[state] */
  if (sub(tmp, st.past_gain_pit, pOverflow) > 0) {
    tmp = st.past_gain_pit;
  }
  gain_pitch[0] = mult(tmp, pdown[state], pOverflow);
}

/**
 * ec_gains.cpp ec_gain_pitch_update.
 * @param {Int16Array} gain_pitch 1-element in/out
 */
export function ec_gain_pitch_update(st, bfi, prev_bf, gain_pitch, pOverflow) {
  if (bfi === 0) {
    if (prev_bf !== 0) {
      if (sub(gain_pitch[0], st.prev_gp, pOverflow) > 0) {
        gain_pitch[0] = st.prev_gp;
      }
    }
    st.prev_gp = gain_pitch[0];
  }

  st.past_gain_pit = gain_pitch[0];
  if (sub(st.past_gain_pit, 16384, pOverflow) > 0) {
    /* if (st->past_gain_pit > 1.0) */
    st.past_gain_pit = 16384;
  }
  for (let i = 1; i < 5; i++) {
    st.pbuf[i - 1] = st.pbuf[i];
  }
  st.pbuf[4] = st.past_gain_pit;
}

const EXPCONST = 5243; /* 0.16 in Q15 */

/** lsp_avg.h lsp_avgState */
export class lsp_avgState {
  constructor() {
    this.lsp_meanSave = new Int16Array(M); /* Averaged LSPs */
    this.reset();
  }

  /** lsp_avg.cpp lsp_avg_reset */
  reset() {
    this.lsp_meanSave.set(mean_lsf_5);
    return 0;
  }
}

/** lsp_avg.cpp lsp_avg */
export function lsp_avg(st, lsp, lspOff, pOverflow) {
  let L_tmp; /* Q31 */
  for (let i = 0; i < M; i++) {
    /* mean = 0.84*mean */
    L_tmp = st.lsp_meanSave[i] << 16;
    L_tmp = L_msu(L_tmp, EXPCONST, st.lsp_meanSave[i], pOverflow);
    /* Add 0.16 of newest LSPs to mean */
    L_tmp = L_mac(L_tmp, EXPCONST, lsp[lspOff + i], pOverflow);
    /* Save means */
    st.lsp_meanSave[i] = pv_round(L_tmp, pOverflow); /* Q15 */
  }
}
