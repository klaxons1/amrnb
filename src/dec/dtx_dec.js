/*
 * DTX decoder, ported from opencore-amr 0.1.6 dec/src/dtx_dec.cpp
 * (+ dtx_dec.h, common/include/dtx_common_def.h).
 * Active implementations transcribed line by line.
 */
import {
  MAX_16, MIN_16, MAX_32, add_16, sub, mult, shl, shr, abs_s, div_s,
  L_add, L_sub, L_mac, L_mult, L_shl, L_shr,
} from '../common/basicop.js';
import { Log2, Pow2 } from '../common/mathops.js';
import { Lsf_lsp, Lsp_lsf, Lsp_Az, Reorder_lsf } from '../common/lsp_fns.js';
import { Syn_filt } from '../common/filters.js';
import { M, L_FRAME, L_SUBFR, LSF_GAP, MRDTX } from '../common/cnst.js';
import { D_plsf_3, Init_D_plsf_3 } from './d_plsf.js';
import { A_Refl, pseudonoise, build_CN_code } from './post_pre.js';

/* dtx_dec.h enum DTXStateType */
export const SPEECH = 0;
export const DTX = 1;
export const DTX_MUTE = 2;

const DTX_MAX_EMPTY_THRESH = 50;
const DTX_HIST_SIZE = 8;
const DTX_ELAPSED_FRAMES_THRESH = 24 + 7 - 1;
const DTX_HANG_CONST = 7; /* yields eight frames of SP HANGOVER */
const PN_INITIAL_SEED = 0x70816958; /* Pseudo noise generator seed value */

/* Scaling factors for the lsp variability operation */
const lsf_hist_mean_scale = Int16Array.from([
  20000, 20000, 20000, 20000, 20000, 18000, 16384, 8192, 0, 0,
]);

/* level adjustment for different modes Q11 */
const dtx_log_en_adjust = Int16Array.from([
  -1023, /* MR475 */
  -878,  /* MR515 */
  -732,  /* MR59  */
  -586,  /* MR67  */
  -440,  /* MR74  */
  -294,  /* MR795 */
  -148,  /* MR102 */
  0,     /* MR122 */
  0,     /* MRDTX */
]);

/** dtx_dec.h dtx_decState */
export class dtx_decState {
  constructor() {
    this.since_last_sid = 0;
    this.true_sid_period_inv = 0;
    this.log_en = 0;
    this.old_log_en = 0;
    this.L_pn_seed_rx = new Int32Array(1);
    this.lsp = new Int16Array(M);
    this.lsp_old = new Int16Array(M);
    this.lsf_hist = new Int16Array(M * DTX_HIST_SIZE);
    this.lsf_hist_ptr = 0;
    this.lsf_hist_mean = new Int16Array(M * DTX_HIST_SIZE);
    this.log_pg_mean = 0;
    this.log_en_hist = new Int16Array(DTX_HIST_SIZE);
    this.log_en_hist_ptr = 0;
    this.log_en_adjust = 0;
    this.dtxHangoverCount = 0;
    this.decAnaElapsedCount = 0;
    this.sid_frame = 0;
    this.valid_data = 0;
    this.dtxHangoverAdded = 0;
    this.dtxGlobalState = DTX; /* contains previous state */
    this.data_updated = 0;     /* marker to know if CNI data is ever renewed */
    this.reset();
  }

  /** dtx_dec.cpp dtx_dec_reset */
  reset() {
    this.since_last_sid = 0;
    this.true_sid_period_inv = 1 << 13;
    this.log_en = 3500;
    this.old_log_en = 3500;
    /* low level noise for better performance in DTX handover cases */
    this.L_pn_seed_rx[0] = PN_INITIAL_SEED;

    const lspInit = [30000, 26000, 21000, 15000, 8000, 0, -8000, -15000, -21000, -26000];
    this.lsp.set(lspInit);
    this.lsp_old.set(lspInit);

    this.lsf_hist_ptr = 0;
    this.log_pg_mean = 0;
    this.log_en_hist_ptr = 0;

    /* initialize decoder lsf history */
    const lsfInit = [1384, 2077, 3420, 5108, 6742, 8122, 9863, 11092, 12714, 13701];
    this.lsf_hist.set(lsfInit, 0);
    for (let i = 1; i < DTX_HIST_SIZE; i++) {
      this.lsf_hist.copyWithin(M * i, 0, M);
    }
    this.lsf_hist_mean.fill(0);

    /* initialize decoder log frame energy */
    this.log_en_hist.fill(this.log_en);

    this.log_en_adjust = 0;
    this.dtxHangoverCount = DTX_HANG_CONST;
    this.decAnaElapsedCount = 32767;
    this.sid_frame = 0;
    this.valid_data = 0;
    this.dtxHangoverAdded = 0;
    this.dtxGlobalState = DTX;
    this.data_updated = 0;
    return 0;
  }
}

const ddLspInt = new Int16Array(M);
const ddAcoeff = new Int16Array(M + 1);
const ddRefl = new Int16Array(M);
const ddEx = new Int16Array(L_SUBFR);
const ddLsfInt = new Int16Array(M);
const ddLsfIntVariab = new Int16Array(M);
const ddLspIntVariab = new Int16Array(M);
const ddAcoeffVariab = new Int16Array(M + 1);
const ddLsf = new Int16Array(M);
const ddLlsf = new Int32Array(M);
const ddExp = new Int16Array(1);
const ddFrac = new Int16Array(1);

/** dtx_dec.cpp dtx_dec */
export function dtx_dec(st, mem_syn, mem_synOff, lsfState, predState, averState,
  new_state, mode, parm, parmOff, synth, synthOff, A_t, A_tOff, pOverflow) {
  let log_en_index;
  let i, j;
  let int_fac;
  let L_log_en_int;
  const lsp_int = ddLspInt;
  let log_en_int_e;
  let log_en_int_m;
  let level;
  const acoeff = ddAcoeff;
  const refl = ddRefl;
  let pred_err;
  const ex = ddEx;
  let ma_pred_init;
  let log_pg;
  let negative;
  let lsf_mean;
  let L_lsf_mean;
  let lsf_variab_index;
  let lsf_variab_factor;
  const lsf_int = ddLsfInt;
  const lsf_int_variab = ddLsfIntVariab;
  const lsp_int_variab = ddLspIntVariab;
  const acoeff_variab = ddAcoeffVariab;
  const lsf = ddLsf;
  const L_lsf = ddLlsf;
  let ptr;
  let tmp_int_length;
  let L_temp;
  let temp;

  if (st.dtxHangoverAdded !== 0 && st.sid_frame !== 0) {
    /* sid_first after dtx hangover period, or sid_upd after dtxhangover */

    /* set log_en_adjust to correct value */
    st.log_en_adjust = dtx_log_en_adjust[mode];

    ptr = st.lsf_hist_ptr + M;
    if (ptr === 80) {
      ptr = 0;
    }
    st.lsf_hist.copyWithin(ptr, st.lsf_hist_ptr, st.lsf_hist_ptr + M);

    ptr = st.log_en_hist_ptr + 1;
    if (ptr === DTX_HIST_SIZE) {
      ptr = 0;
    }
    st.log_en_hist[ptr] = st.log_en_hist[st.log_en_hist_ptr]; /* Q11 */

    /* compute mean log energy and lsp from decoded signal (SID_FIRST) */
    st.log_en = 0;
    for (i = M - 1; i >= 0; i--) {
      L_lsf[i] = 0;
    }

    /* average energy and lsp */
    for (i = DTX_HIST_SIZE - 1; i >= 0; i--) {
      if (st.log_en_hist[i] < 0) {
        temp = ~(~st.log_en_hist[i] >> 3);
      } else {
        temp = st.log_en_hist[i] >> 3;
      }
      st.log_en = add_16(st.log_en, temp, pOverflow);
      for (j = M - 1; j >= 0; j--) {
        L_lsf[j] = L_add(L_lsf[j], st.lsf_hist[i * M + j], pOverflow);
      }
    }

    for (j = M - 1; j >= 0; j--) {
      if (L_lsf[j] < 0) {
        lsf[j] = (~(~L_lsf[j] >> 3) << 16) >> 16;
      } else {
        lsf[j] = ((L_lsf[j] >> 3) << 16) >> 16;
      }
    }

    Lsf_lsp(lsf, 0, st.lsp, 0, M, pOverflow);

    /* make log_en speech coder mode independent; added again before synth */
    st.log_en = sub(st.log_en, st.log_en_adjust, pOverflow);

    /* compute lsf variability vector */
    st.lsf_hist_mean.set(st.lsf_hist.subarray(0, 80));

    for (i = M - 1; i >= 0; i--) {
      L_lsf_mean = 0;
      /* compute mean lsf */
      for (j = 8 - 1; j >= 0; j--) {
        L_lsf_mean = L_add(L_lsf_mean, st.lsf_hist_mean[i + j * M], pOverflow);
      }

      if (L_lsf_mean < 0) {
        lsf_mean = (~(~L_lsf_mean >> 3) << 16) >> 16;
      } else {
        lsf_mean = ((L_lsf_mean >> 3) << 16) >> 16;
      }

      /* subtract mean and limit to within reasonable limits;
         the upper lsf's are attenuated */
      for (j = 8 - 1; j >= 0; j--) {
        /* subtract mean */
        st.lsf_hist_mean[i + j * M] =
          sub(st.lsf_hist_mean[i + j * M], lsf_mean, pOverflow);

        /* attenuate deviation from mean, especially for upper lsf's */
        st.lsf_hist_mean[i + j * M] =
          mult(st.lsf_hist_mean[i + j * M], lsf_hist_mean_scale[i], pOverflow);

        /* limit the deviation */
        if (st.lsf_hist_mean[i + j * M] < 0) {
          negative = 1;
        } else {
          negative = 0;
        }
        st.lsf_hist_mean[i + j * M] = abs_s(st.lsf_hist_mean[i + j * M]);

        /* apply soft limit */
        if (st.lsf_hist_mean[i + j * M] > 655) {
          st.lsf_hist_mean[i + j * M] =
            655 + ((st.lsf_hist_mean[i + j * M] - 655) >> 2);
        }

        /* apply hard limit */
        if (st.lsf_hist_mean[i + j * M] > 1310) {
          st.lsf_hist_mean[i + j * M] = 1310;
        }

        if (negative !== 0) {
          st.lsf_hist_mean[i + j * M] = -st.lsf_hist_mean[i + j * M];
        }
      }
    }
  }

  if (st.sid_frame !== 0) {
    /* Set old SID parameters, always shift even if no new valid_data */
    st.lsp_old.set(st.lsp);
    st.old_log_en = st.log_en;

    if (st.valid_data !== 0) {
      /* new data available (no CRC) */
      /* Compute interpolation factor; limit to 32 frames */
      tmp_int_length = st.since_last_sid;
      st.since_last_sid = 0;

      if (tmp_int_length >= 32) {
        tmp_int_length = 32;
      }

      L_temp = tmp_int_length << 10;
      if (L_temp !== ((L_temp << 16) >> 16)) {
        pOverflow[0] = 1;
        L_temp = tmp_int_length > 0 ? MAX_16 : MIN_16;
      }
      temp = (L_temp << 16) >> 16;

      if (tmp_int_length >= 2) {
        st.true_sid_period_inv = div_s(1 << 10, temp);
      } else {
        st.true_sid_period_inv = 1 << 14; /* 0.5 in Q15 */
      }

      Init_D_plsf_3(lsfState, parm[parmOff]);
      D_plsf_3(lsfState, MRDTX, 0, parm, parmOff + 1, st.lsp, 0, pOverflow);

      /* reset for next speech frame */
      lsfState.past_r_q.fill(0);

      log_en_index = parm[parmOff + 4];
      /* Q11 and divide by 4 */
      if (log_en_index > 63 || log_en_index < -64) {
        st.log_en = log_en_index > 0 ? MAX_16 : MIN_16;
      } else {
        st.log_en = (log_en_index << (11 - 2)) << 16 >> 16;
      }

      /* Subtract 2.5 in Q11 */
      st.log_en = (st.log_en - 2560 * 2) << 16 >> 16;

      /* Index 0 is reserved for silence */
      if (log_en_index === 0) {
        st.log_en = MIN_16;
      }

      /* no interpolation at startup after coder reset
         or when SID_UPD has been received right after SPEECH */
      if (st.data_updated === 0 || st.dtxGlobalState === SPEECH) {
        st.lsp_old.set(st.lsp);
        st.old_log_en = st.log_en;
      }
    } /* endif valid_data */

    /* initialize gain predictor memory of other modes */
    if (st.log_en < 0) {
      temp = ~(~st.log_en >> 1);
    } else {
      temp = st.log_en >> 1;
    }
    ma_pred_init = (temp - 9000) << 16 >> 16;
    if (ma_pred_init > 0) {
      ma_pred_init = 0;
    } else if (ma_pred_init < -14436) {
      ma_pred_init = -14436;
    }

    predState.past_qua_en[0] = ma_pred_init;
    predState.past_qua_en[1] = ma_pred_init;
    predState.past_qua_en[2] = ma_pred_init;
    predState.past_qua_en[3] = ma_pred_init;

    /* past_qua_en for other modes than MR122 */
    ma_pred_init = (Math.imul(ma_pred_init, 5443) >> 15) << 16 >> 16;
    /* scale down by factor 20*log10(2) in Q15 */
    predState.past_qua_en_MR122[0] = ma_pred_init;
    predState.past_qua_en_MR122[1] = ma_pred_init;
    predState.past_qua_en_MR122[2] = ma_pred_init;
    predState.past_qua_en_MR122[3] = ma_pred_init;
  } /* endif sid_frame */

  /* CN generation: recompute level adjustment factor Q11
     st->log_en_adjust = 0.9*st->log_en_adjust + 0.1*dtx_log_en_adjust[mode] */
  if (dtx_log_en_adjust[mode] > 1023) {
    temp = MAX_16;
  } else if (dtx_log_en_adjust[mode] < -1024) {
    temp = MIN_16;
  } else {
    temp = (Math.imul(dtx_log_en_adjust[mode] << 5, 3277) >> 15) << 16 >> 16;
  }

  if (temp < 0) {
    temp = ~(~temp >> 5);
  } else {
    temp >>= 5;
  }
  st.log_en_adjust = add_16(
    (Math.imul(st.log_en_adjust, 29491) >> 15) << 16 >> 16, temp, pOverflow);

  /* Interpolate SID info */
  int_fac = shl((st.since_last_sid + 1) << 16 >> 16, 10, pOverflow); /* Q10 */
  int_fac = mult(int_fac, st.true_sid_period_inv, pOverflow); /* Q10*Q15->Q10 */

  /* Maximize to 1.0 in Q10 */
  if (int_fac > 1024) {
    int_fac = 16384;
  } else if (int_fac < -2048) {
    int_fac = MIN_16;
  } else {
    int_fac = (int_fac << 4) << 16 >> 16; /* Q10 -> Q14 */
  }

  L_log_en_int = L_mult(int_fac, st.log_en, pOverflow); /* Q14 * Q11 -> Q26 */
  for (i = M - 1; i >= 0; i--) {
    lsp_int[i] = mult(int_fac, st.lsp[i], pOverflow); /* Q14 * Q15 -> Q14 */
  }

  int_fac = (16384 - int_fac) << 16 >> 16; /* 1-k in Q14 */

  /* (Q14 * Q11 -> Q26) + Q26 -> Q26 */
  L_log_en_int = L_mac(L_log_en_int, int_fac, st.old_log_en, pOverflow);
  for (i = M - 1; i >= 0; i--) {
    /* Q14 + (Q14 * Q15 -> Q14) -> Q14 */
    lsp_int[i] = add_16(lsp_int[i], mult(int_fac, st.lsp_old[i], pOverflow), pOverflow);
    L_temp = lsp_int[i] << 1; /* Q14 -> Q15 */
    if (L_temp !== ((L_temp << 16) >> 16)) {
      pOverflow[0] = 1;
      L_temp = lsp_int[i] > 0 ? MAX_16 : MIN_16;
    }
    lsp_int[i] = (L_temp << 16) >> 16;
  }

  /* compute the amount of lsf variability */
  lsf_variab_factor = (st.log_pg_mean - 2457) << 16 >> 16; /* -0.6 in Q12 */
  /* *0.3 Q12*Q15 -> Q12 */
  lsf_variab_factor = (4096 - mult(lsf_variab_factor, 9830, pOverflow)) << 16 >> 16;

  /* limit to values between 0..1 in Q12 */
  if (lsf_variab_factor > 4095) {
    lsf_variab_factor = MAX_16;
  } else if (lsf_variab_factor < 0) {
    lsf_variab_factor = 0;
  } else {
    lsf_variab_factor = (lsf_variab_factor << 3) << 16 >> 16; /* -> Q15 */
  }

  /* get index of vector to do variability with */
  lsf_variab_index = pseudonoise(st.L_pn_seed_rx, 3);

  /* convert to lsf */
  Lsp_lsf(lsp_int, 0, lsf_int, 0, M, pOverflow);

  /* apply lsf variability */
  lsf_int_variab.set(lsf_int);
  for (i = M - 1; i >= 0; i--) {
    lsf_int_variab[i] = add_16(lsf_int_variab[i],
      mult(lsf_variab_factor, st.lsf_hist_mean[i + lsf_variab_index * M], pOverflow),
      pOverflow);
  }

  /* make sure that LSP's are ordered */
  Reorder_lsf(lsf_int, 0, LSF_GAP, M, pOverflow);
  Reorder_lsf(lsf_int_variab, 0, LSF_GAP, M, pOverflow);

  /* copy lsf to speech decoders lsf state */
  lsfState.past_lsf_q.set(lsf_int);

  /* convert to lsp */
  Lsf_lsp(lsf_int, 0, lsp_int, 0, M, pOverflow);
  Lsf_lsp(lsf_int_variab, 0, lsp_int_variab, 0, M, pOverflow);

  /* Compute acoeffs Q12: acoeff for level normalization and postfilter,
     acoeff_variab for synthesis filter */
  Lsp_Az(lsp_int, 0, acoeff, 0, pOverflow);
  Lsp_Az(lsp_int_variab, 0, acoeff_variab, 0, pOverflow);

  /* For use in postfilter */
  for (i = 0; i <= M; i++) {
    A_t[A_tOff + i] = acoeff[i];
    A_t[A_tOff + M + 1 + i] = acoeff[i];
    A_t[A_tOff + 2 * (M + 1) + i] = acoeff[i];
    A_t[A_tOff + 3 * (M + 1) + i] = acoeff[i];
  }

  /* Compute reflection coefficients Q15 */
  A_Refl(acoeff, 1, refl, 0, pOverflow);

  /* Compute prediction error in Q15 */
  pred_err = MAX_16; /* 0.99997 in Q15 */
  for (i = 0; i < M; i++) {
    L_temp = (refl[i] * refl[i]) >> 15;
    if (L_temp <= 0x00007fff) {
      temp = (MAX_16 - L_temp) << 16 >> 16;
    } else {
      pOverflow[0] = 1;
      temp = 0;
    }
    pred_err = mult(pred_err, temp, pOverflow);
  }

  /* compute logarithm of prediction gain */
  Log2(pred_err, ddExp, ddFrac, pOverflow);
  const log_pg_e = ddExp[0];
  const log_pg_m = ddFrac[0];

  /* convert exponent and mantissa to Word16 Q12 */
  log_pg = shl((log_pg_e - 15) << 16 >> 16, 12, pOverflow); /* Q12 */
  log_pg = shr(sub(0, add_16(log_pg, shr(log_pg_m, 15 - 12, pOverflow),
    pOverflow), pOverflow), 1, pOverflow);
  st.log_pg_mean = add_16(mult(29491, st.log_pg_mean, pOverflow),
    mult(3277, log_pg, pOverflow), pOverflow);

  /* Compute interpolated log energy */
  L_log_en_int = L_shr(L_log_en_int, 10, pOverflow); /* Q26 -> Q16 */

  /* Add 4 in Q16 */
  L_log_en_int = L_add(L_log_en_int, 4 * 65536, pOverflow);

  /* subtract prediction gain */
  L_log_en_int = L_sub(L_log_en_int, L_shl(log_pg, 4, pOverflow), pOverflow);

  /* adjust level to speech coder mode */
  L_log_en_int = L_add(L_log_en_int, L_shl(st.log_en_adjust, 5, pOverflow), pOverflow);

  log_en_int_e = ((L_log_en_int >> 16) << 16) >> 16;
  log_en_int_m = (L_shr(L_sub(L_log_en_int, log_en_int_e << 16, pOverflow),
    1, pOverflow) << 16) >> 16;
  level = (Pow2(log_en_int_e, log_en_int_m, pOverflow) << 16) >> 16; /* Q4 */

  for (i = 0; i < 4; i++) {
    /* Compute innovation vector */
    build_CN_code(st.L_pn_seed_rx, ex, 0, pOverflow);
    for (j = L_SUBFR - 1; j >= 0; j--) {
      ex[j] = mult(level, ex[j], pOverflow);
    }
    /* Synthesize */
    Syn_filt(acoeff_variab, 0, ex, 0, synth, synthOff + i * L_SUBFR, L_SUBFR,
      mem_syn, mem_synOff, 1);
  }

  /* reset codebook averaging variables */
  averState.hangVar = 20;
  averState.hangCount = 0;

  if (new_state === DTX_MUTE) {
    /* mute comfort noise as it has been quite a long time since
       last SID update was performed */
    tmp_int_length = st.since_last_sid;
    if (tmp_int_length > 32) {
      tmp_int_length = 32;
    } else if (tmp_int_length <= 0) {
      /* safety guard against division by zero */
      tmp_int_length = 8;
    }

    L_temp = tmp_int_length << 10;
    if (L_temp !== ((L_temp << 16) >> 16)) {
      pOverflow[0] = 1;
      L_temp = tmp_int_length > 0 ? MAX_16 : MIN_16;
    }
    temp = (L_temp << 16) >> 16;
    st.true_sid_period_inv = div_s(1 << 10, temp);

    st.since_last_sid = 0;
    st.lsp_old.set(st.lsp);
    st.old_log_en = st.log_en;
    /* subtract 1/8 in Q11 i.e -6/8 dB */
    st.log_en = (st.log_en - 256) << 16 >> 16;
    if (st.log_en < 0) {
      st.log_en = 0;
    }
  }

  /* reset interpolation length timer if data has been updated */
  if (st.sid_frame !== 0
    && (st.valid_data !== 0 || (st.valid_data === 0 && st.dtxHangoverAdded !== 0))) {
    st.since_last_sid = 0;
    st.data_updated = 1;
  }
}

const dauExp = new Int16Array(1);
const dauFrac = new Int16Array(1);

/** dtx_dec.cpp dtx_dec_activity_update */
export function dtx_dec_activity_update(st, lsf, lsfOff, frame, frameOff, pOverflow) {
  let L_frame_en;
  let L_temp;
  let log_en_e;
  let log_en_m;
  let log_en;

  /* update lsp history */
  st.lsf_hist_ptr += M;
  if (st.lsf_hist_ptr === 80) {
    st.lsf_hist_ptr = 0;
  }
  for (let i = 0; i < M; i++) {
    st.lsf_hist[st.lsf_hist_ptr + i] = lsf[lsfOff + i];
  }

  /* compute log energy based on frame energy */
  L_frame_en = 0; /* Q0 */
  for (let i = L_FRAME - 1; i >= 0; i--) {
    L_temp = frame[frameOff + i] * frame[frameOff + i];
    if (L_temp !== 0x40000000) {
      L_temp = L_temp << 1;
    } else {
      L_temp = MAX_32;
    }
    L_frame_en = L_add(L_frame_en, L_temp, pOverflow);
  }

  Log2(L_frame_en, dauExp, dauFrac, pOverflow);
  log_en_e = dauExp[0];
  log_en_m = dauFrac[0];

  /* convert exponent and mantissa to Word16 Q10 */
  L_temp = log_en_e << 10;
  if (L_temp !== ((L_temp << 16) >> 16)) {
    pOverflow[0] = 1;
    L_temp = log_en_e > 0 ? MAX_16 : MIN_16;
  }
  log_en_e = (L_temp << 16) >> 16;

  if (log_en_m < 0) {
    log_en_m = ~(~log_en_m >> 5);
  } else {
    log_en_m >>= 5;
  }
  log_en = (log_en_e + log_en_m) << 16 >> 16;

  /* divide with L_FRAME i.e subtract with log2(L_FRAME) = 7.32193 */
  log_en = (log_en - (7497 + 1024)) << 16 >> 16;

  /* insert into log energy buffer; log_en in decoder is Q11 */
  st.log_en_hist_ptr += 1;
  if (st.log_en_hist_ptr === DTX_HIST_SIZE) {
    st.log_en_hist_ptr = 0;
  }
  st.log_en_hist[st.log_en_hist_ptr] = log_en; /* Q11 */
}

/** dtx_dec.cpp rx_dtx_handler: returns new DTXStateType */
export function rx_dtx_handler(st, frame_type, pOverflow) {
  let newState;
  let encState;

  /* DTX if SID frame or previously in DTX{_MUTE} and (NO_RX OR BAD_SPEECH) */
  /* RXFrameType values (frame.h): RX_SID_FIRST=4, RX_SID_UPDATE=5,
     RX_SID_BAD=6, RX_NO_DATA=7, RX_SPEECH_BAD=3, RX_ONSET=2 */
  if (frame_type === 4 /* RX_SID_FIRST */
    || frame_type === 5 /* RX_SID_UPDATE */
    || frame_type === 6 /* RX_SID_BAD */
    || ((st.dtxGlobalState === DTX || st.dtxGlobalState === DTX_MUTE)
      && (frame_type === 7 /* RX_NO_DATA */ || frame_type === 3 /* RX_SPEECH_BAD */
        || frame_type === 2 /* RX_ONSET */))) {
    newState = DTX;

    /* stay in mute for these input types */
    if (st.dtxGlobalState === DTX_MUTE
      && (frame_type === 6 || frame_type === 4
        || frame_type === 2 || frame_type === 7)) {
      newState = DTX_MUTE;
    }

    /* evaluate if noise parameters are too old;
       since_last_sid is reset when CN parameters have been updated */
    st.since_last_sid += 1;

    /* no update of sid parameters in DTX for a long while;
       SID_UPDATE frames handled separately to avoid entering DTX_MUTE
       for late SID_UPDATE frames */
    if (frame_type !== 5 && st.since_last_sid > DTX_MAX_EMPTY_THRESH) {
      newState = DTX_MUTE;
    }
  } else {
    newState = SPEECH;
    st.since_last_sid = 0;
  }

  /* reset the decAnaElapsed Counter when receiving CNI data the first time,
     to robustify counter mismatch after handover */
  if (st.data_updated === 0 && frame_type === 5) {
    st.decAnaElapsedCount = 0;
  }

  /* update the SPE-SPD DTX hangover synchronization */
  st.decAnaElapsedCount = add_16(st.decAnaElapsedCount, 1, pOverflow);
  st.dtxHangoverAdded = 0;

  if (frame_type === 4 || frame_type === 5 || frame_type === 6
    || frame_type === 2 || frame_type === 7) {
    encState = DTX;
    if (frame_type === 7 && newState === SPEECH) {
      encState = SPEECH;
    }
  } else {
    encState = SPEECH;
  }

  if (encState === SPEECH) {
    st.dtxHangoverCount = DTX_HANG_CONST;
  } else if (st.decAnaElapsedCount > DTX_ELAPSED_FRAMES_THRESH) {
    st.dtxHangoverAdded = 1;
    st.decAnaElapsedCount = 0;
    st.dtxHangoverCount = 0;
  } else if (st.dtxHangoverCount === 0) {
    st.decAnaElapsedCount = 0;
  } else {
    st.dtxHangoverCount -= 1;
  }

  if (newState !== SPEECH) {
    /* DTX or DTX_MUTE: CN data is not in a first SID, first SIDs are marked
       as SID_BAD but will do backwards analysis if a hangover period has
       been added according to the state machine above */
    st.sid_frame = 0;
    st.valid_data = 0;

    if (frame_type === 4) {
      st.sid_frame = 1;
    } else if (frame_type === 5) {
      st.sid_frame = 1;
      st.valid_data = 1;
    } else if (frame_type === 6) {
      st.sid_frame = 1;
      st.dtxHangoverAdded = 0; /* use old data */
    }
  }

  /* newState is used by both SPEECH AND DTX synthesis routines */
  return newState;
}
