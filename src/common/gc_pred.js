/*
 * Codebook gain MA prediction, ported from opencore-amr 0.1.6
 * common/src/gc_pred.cpp + common/include/gc_pred.h.
 * Active implementations transcribed line by line.
 *
 * C output pointers (Word16 *exp_gcode0 etc.) become 1-element Int16Array
 * parameters.
 */
import {
  MAX_32, MIN_32, L_add, L_sub, L_shl, norm_l, pv_round, add_16,
} from './basicop.js';
import { Log2, Log2_norm } from './mathops.js';
import { L_SUBFR, MR122, MR102, MR795, MR74, MR67 } from './cnst.js';

const NPRED = 4; /* number of prediction taps */
const MEAN_ENER_MR122 = 783741; /* 36/(20*log10(2)) (Q17) */
const MIN_ENERGY = -14336;      /* 14                 Q10 */
const MIN_ENERGY_MR122 = -2381; /* 14 / (20*log10(2)) Q10 */

/* MA prediction coefficients (Q13) and MR122 version (Q6) */
const pred = Int16Array.from([5571, 4751, 2785, 1556]);
const pred_MR122 = Int16Array.from([44, 37, 22, 12]);

/** gc_pred.h gc_predState */
export class gc_predState {
  constructor() {
    this.past_qua_en = new Int16Array(NPRED);       /* normal MA memory, Q10 */
    this.past_qua_en_MR122 = new Int16Array(NPRED); /* MR122 MA memory,  Q10 */
    this.reset();
  }

  /** gc_pred.cpp gc_pred_reset */
  reset() {
    for (let i = 0; i < NPRED; i++) {
      this.past_qua_en[i] = MIN_ENERGY;
      this.past_qua_en_MR122[i] = MIN_ENERGY_MR122;
    }
    return 0;
  }
}

const scratchExp = new Int16Array(1);
const scratchFrac = new Int16Array(1);

/** gc_pred.cpp gc_pred */
export function gc_pred(st, mode, code, codeOff,
  exp_gcode0, frac_gcode0, exp_en, frac_en, pOverflow) {
  let L_temp1, L_temp2;
  let L_tmp;
  let ener_code;
  let ener;
  let exp_code, gcode0;
  let tmp;
  let pCode = codeOff;

  /* energy of code: ener_code = sum(code[i]^2) */
  ener_code = 0;
  /* MR122: Q12*Q12 -> Q25 ; others: Q13*Q13 -> Q27 */
  for (let i = L_SUBFR >> 2; i !== 0; i--) {
    tmp = code[pCode++];
    ener_code += (tmp * tmp) >> 3;
    tmp = code[pCode++];
    ener_code += (tmp * tmp) >> 3;
    tmp = code[pCode++];
    ener_code += (tmp * tmp) >> 3;
    tmp = code[pCode++];
    ener_code += (tmp * tmp) >> 3;
  }
  ener_code = (ener_code << 4) | 0; /* C Word32 shift wraps */

  if (ener_code >> 31) {
    /* Check for saturation */
    ener_code = MAX_32;
  }

  if (mode === MR122) {
    /* ener_code = ener_code / lcode; lcode = 40; 1/40 = 26214 Q20 */
    ener_code = (pv_round(ener_code, pOverflow) * 26214) << 1;

    /* ener_code = 1/2 * Log2(ener_code); Note: Log2=log2+30 */
    Log2(ener_code, scratchExp, scratchFrac, pOverflow);
    const exp = scratchExp[0];
    const frac = scratchFrac[0];

    /* Q16 for log() -> Q17 for 1/2 log() */
    L_temp1 = (exp - 30) << 16;
    ener_code = (L_temp1 + (frac << 1)) | 0;

    /* predicted energy: ener(Q24) = MEAN_ENER + sum(pred[i]*past_qua_en[i]) */
    ener = MEAN_ENER_MR122; /* Q24 (Q17) */
    for (let i = 0; i < NPRED; i++) {
      L_temp1 = (st.past_qua_en_MR122[i] * pred_MR122[i]) << 1;
      ener = L_add(ener, L_temp1, pOverflow);
      /* Q10 * Q6 -> Q17 */
    }

    /* predicted codebook gain: gc0 = Pow2(ener - ener_code) */
    /* Q16 */
    L_temp1 = L_sub(ener, ener_code, pOverflow);
    exp_gcode0[0] = (L_temp1 >> 17) << 16 >> 16;
    L_temp2 = exp_gcode0[0] << 15;
    L_temp1 >>= 2;
    frac_gcode0[0] = ((L_temp1 - L_temp2) << 16) >> 16;
  } else {
    /* all modes except 12.2 */
    /* Compute: means_ener - 10log10(ener_code/L_SUBFR) */
    exp_code = norm_l(ener_code);
    ener_code = L_shl(ener_code, exp_code, pOverflow);

    /* Log2 = log2 + 27 */
    Log2_norm(ener_code, exp_code, scratchExp, scratchFrac);
    const exp = scratchExp[0];
    const frac = scratchFrac[0];

    /* fact = 10/log2(10) = 3.01 = 24660 Q13 */
    L_temp2 = (exp * -24660) << 1;
    L_tmp = (frac * -24660) >> 15;

    /* Sign-extend resulting product */
    if (L_tmp & 0x00010000) {
      L_tmp = L_tmp | (0xffff0000 | 0);
    }
    L_tmp = L_tmp << 1;
    L_tmp = L_add(L_tmp, L_temp2, pOverflow);

    if (mode === MR102) {
      /* mean = 33 dB */
      L_temp2 = 16678 << 7;
      L_tmp = L_add(L_tmp, L_temp2, pOverflow); /* Q14 */
    } else if (mode === MR795) {
      /* exp_en = -11-exp_code */
      frac_en[0] = (ener_code >> 16) << 16 >> 16;
      exp_en[0] = -11 - exp_code;

      /* mean = 36 dB */
      L_temp2 = 17062 << 7;
      L_tmp = L_add(L_tmp, L_temp2, pOverflow); /* Q14 */
    } else if (mode === MR74) {
      /* mean = 30 dB */
      L_temp2 = 32588 << 6;
      L_tmp = L_add(L_tmp, L_temp2, pOverflow); /* Q14 */
    } else if (mode === MR67) {
      /* mean = 28.75 dB */
      L_temp2 = 32268 << 6;
      L_tmp = L_add(L_tmp, L_temp2, pOverflow); /* Q14 */
    } else {
      /* MR59, MR515, MR475: mean = 33 dB */
      L_temp2 = 16678 << 7;
      L_tmp = L_add(L_tmp, L_temp2, pOverflow); /* Q14 */
    }

    /* Compute gcode0: Sum(pred[i]*past_qua_en[i]) - ener_code + mean_ener */
    /* Q24 */
    if (L_tmp > 0x001fffff) {
      pOverflow[0] = 1;
      L_tmp = MAX_32;
    } else if (L_tmp < -2097152) {
      pOverflow[0] = 1;
      L_tmp = MIN_32;
    } else {
      L_tmp = L_tmp << 10;
    }

    for (let i = 0; i < 4; i++) {
      L_temp2 = (pred[i] * st.past_qua_en[i]) << 1;
      L_tmp = L_add(L_tmp, L_temp2, pOverflow); /* Q13 * Q10 -> Q24 */
    }

    gcode0 = (L_tmp >> 16) << 16 >> 16; /* Q8 */

    /* gcode0 = pow(10.0, gcode0/20) = pow(2, 0.166*gcode0) */
    if (mode === MR74) {
      /* For IS641 bitexactness: 5439 Q15 = 0.165985 */
      L_tmp = (gcode0 * 5439) << 1; /* Q8 * Q15 -> Q24 */
    } else {
      L_tmp = (gcode0 * 5443) << 1; /* Q8 * Q15 -> Q24 */
    }

    if (L_tmp < 0) {
      L_tmp = ~((~L_tmp) >> 8);
    } else {
      L_tmp = L_tmp >> 8; /* -> Q16 */
    }

    exp_gcode0[0] = (L_tmp >> 16) << 16 >> 16;

    if (L_tmp < 0) {
      L_temp1 = ~((~L_tmp) >> 1);
    } else {
      L_temp1 = L_tmp >> 1;
    }
    L_temp2 = exp_gcode0[0] << 15;
    frac_gcode0[0] = (L_sub(L_temp1, L_temp2, pOverflow) << 16) >> 16;
    /* -> Q0.Q15 */
  }
}

/** gc_pred.cpp gc_pred_update */
export function gc_pred_update(st, qua_ener_MR122, qua_ener) {
  st.past_qua_en[3] = st.past_qua_en[2];
  st.past_qua_en_MR122[3] = st.past_qua_en_MR122[2];

  st.past_qua_en[2] = st.past_qua_en[1];
  st.past_qua_en_MR122[2] = st.past_qua_en_MR122[1];

  st.past_qua_en[1] = st.past_qua_en[0];
  st.past_qua_en_MR122[1] = st.past_qua_en_MR122[0];

  st.past_qua_en_MR122[0] = qua_ener_MR122; /*    log2 (qua_err), Q10 */
  st.past_qua_en[0] = qua_ener;             /* 20*log10(qua_err), Q10 */
}

/**
 * gc_pred.cpp gc_pred_average_limited.
 * @param {Int16Array} ener_avg_MR122 1-element out
 * @param {Int16Array} ener_avg 1-element out
 */
export function gc_pred_average_limited(st, ener_avg_MR122, ener_avg, pOverflow) {
  let av_pred_en;

  /* do average in MR122 mode (log2() domain) */
  av_pred_en = 0;
  for (let i = 0; i < NPRED; i++) {
    av_pred_en = add_16(av_pred_en, st.past_qua_en_MR122[i], pOverflow);
  }

  /* av_pred_en = 0.25*av_pred_en (with sign-extension) */
  if (av_pred_en < 0) {
    av_pred_en = (((av_pred_en >> 2) | 0xc000) << 16) >> 16;
  } else {
    av_pred_en >>= 2;
  }

  if (av_pred_en < MIN_ENERGY_MR122) {
    av_pred_en = MIN_ENERGY_MR122;
  }
  ener_avg_MR122[0] = av_pred_en;

  /* do average for other modes (20*log10() domain) */
  av_pred_en = 0;
  for (let i = 0; i < NPRED; i++) {
    av_pred_en = add_16(av_pred_en, st.past_qua_en[i], pOverflow);
  }

  if (av_pred_en < 0) {
    av_pred_en = (((av_pred_en >> 2) | 0xc000) << 16) >> 16;
  } else {
    av_pred_en >>= 2;
  }

  if (av_pred_en < MIN_ENERGY) {
    av_pred_en = MIN_ENERGY;
  }
  ener_avg[0] = av_pred_en;
}
