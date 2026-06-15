/*
 * DTX encoder, ported from opencore-amr 0.1.6 enc/src/dtx_enc.cpp
 * (dtx_encState, dtx_enc_reset, dtx_enc, dtx_buffer, tx_dtx_handler).
 * Active implementations transcribed line by line.
 */
import {
  MAX_16, MIN_16, MAX_32, add_16, sub, L_add,
} from '../common/basicop.js';
import { Log2 } from '../common/mathops.js';
import { Lsp_lsf, Lsf_lsp, Reorder_lsf } from '../common/lsp_fns.js';
import { M, L_FRAME, LSF_GAP, MRDTX } from '../common/cnst.js';
import { lsp_init_data } from '../common/tables/index.js';
import { Q_plsf_3 } from './q_plsf.js';

const DTX_HIST_SIZE = 8;
const DTX_ELAPSED_FRAMES_THRESH = 24 + 7 - 1;
const DTX_HANG_CONST = 7;

/** dtx_enc.h dtx_encState */
export class dtx_encState {
  constructor() {
    this.lsp_hist = new Int16Array(M * DTX_HIST_SIZE);
    this.log_en_hist = new Int16Array(DTX_HIST_SIZE);
    this.hist_ptr = 0;
    this.log_en_index = 0;
    this.init_lsf_vq_index = 0;
    this.lsp_index = new Int16Array(3);
    this.dtxHangoverCount = 0;
    this.decAnaElapsedCount = 0;
    this.reset();
  }

  /** dtx_enc.cpp dtx_enc_reset */
  reset() {
    this.hist_ptr = 0;
    this.log_en_index = 0;
    this.init_lsf_vq_index = 0;
    this.lsp_index[0] = 0;
    this.lsp_index[1] = 0;
    this.lsp_index[2] = 0;
    for (let i = 0; i < DTX_HIST_SIZE; i++) {
      this.lsp_hist.set(lsp_init_data, i * M);
    }
    this.log_en_hist.fill(0);
    this.dtxHangoverCount = DTX_HANG_CONST;
    this.decAnaElapsedCount = 32767;
    return 1;
  }
}

const deLsf = new Int16Array(M);
const deLsp = new Int16Array(M);
const deLspQ = new Int16Array(M);
const deLlsp = new Int32Array(M);
const dePredInit = new Int16Array(1);

/**
 * dtx_enc.cpp dtx_enc.
 * anap is a cursor object { arr, off }.
 */
export function dtx_enc(st, computeSidFlag, qSt, predState, anap, pOverflow) {
  let temp;
  let log_en;
  const lsf = deLsf;
  const lsp = deLsp;
  const lsp_q = deLspQ;
  const L_lsp = deLlsp;

  if (computeSidFlag !== 0 || st.log_en_index === 0) {
    log_en = 0;
    for (let i = M - 1; i >= 0; i--) {
      L_lsp[i] = 0;
    }

    for (let i = DTX_HIST_SIZE - 1; i >= 0; i--) {
      if (st.log_en_hist[i] < 0) {
        temp = ~(~st.log_en_hist[i] >> 2);
      } else {
        temp = st.log_en_hist[i] >> 2;
      }
      log_en = add_16(log_en, temp, pOverflow);
      for (let j = M - 1; j >= 0; j--) {
        L_lsp[j] = L_add(L_lsp[j], st.lsp_hist[i * M + j], pOverflow);
      }
    }

    if (log_en < 0) {
      log_en = ~(~log_en >> 1);
    } else {
      log_en = log_en >> 1;
    }

    for (let j = M - 1; j >= 0; j--) {
      if (L_lsp[j] < 0) {
        lsp[j] = (~(~L_lsp[j] >> 3) << 16) >> 16;
      } else {
        lsp[j] = ((L_lsp[j] >> 3) << 16) >> 16;
      }
    }

    st.log_en_index = (log_en + 2560) << 16 >> 16;
    st.log_en_index = (st.log_en_index + 128) << 16 >> 16;

    if (st.log_en_index < 0) {
      st.log_en_index = ~(~st.log_en_index >> 8);
    } else {
      st.log_en_index = st.log_en_index >> 8;
    }
    if (st.log_en_index > 63) {
      st.log_en_index = 63;
    } else if (st.log_en_index < 0) {
      st.log_en_index = 0;
    }

    log_en = (st.log_en_index << (-2 + 10)) << 16 >> 16;
    log_en = sub(log_en, 11560, pOverflow);

    if (log_en > 0) {
      log_en = 0;
    } else if (log_en < -14436) {
      log_en = -14436;
    }

    predState.past_qua_en[0] = log_en;
    predState.past_qua_en[1] = log_en;
    predState.past_qua_en[2] = log_en;
    predState.past_qua_en[3] = log_en;

    log_en = ((5443 * log_en) >> 15) << 16 >> 16;
    predState.past_qua_en_MR122[0] = log_en;
    predState.past_qua_en_MR122[1] = log_en;
    predState.past_qua_en_MR122[2] = log_en;
    predState.past_qua_en_MR122[3] = log_en;

    Lsp_lsf(lsp, 0, lsf, 0, M, pOverflow);
    Reorder_lsf(lsf, 0, LSF_GAP, M, pOverflow);
    Lsf_lsp(lsf, 0, lsp, 0, M, pOverflow);

    dePredInit[0] = st.init_lsf_vq_index;
    Q_plsf_3(qSt, MRDTX, lsp, 0, lsp_q, 0, st.lsp_index, 0, dePredInit, pOverflow);
    st.init_lsf_vq_index = dePredInit[0];
  }

  anap.arr[anap.off++] = st.init_lsf_vq_index; /* 3 bits */
  anap.arr[anap.off++] = st.lsp_index[0];      /* 8 bits */
  anap.arr[anap.off++] = st.lsp_index[1];      /* 9 bits */
  anap.arr[anap.off++] = st.lsp_index[2];      /* 9 bits */
  anap.arr[anap.off++] = st.log_en_index;      /* 6 bits */
}

const deScratchExp = new Int16Array(1);
const deScratchFrac = new Int16Array(1);

/** dtx_enc.cpp dtx_buffer */
export function dtx_buffer(st, lsp_new, lsp_newOff, speech, speechOff, pOverflow) {
  let L_frame_en;
  let L_temp;
  let log_en;

  st.hist_ptr += 1;
  if (st.hist_ptr === DTX_HIST_SIZE) {
    st.hist_ptr = 0;
  }
  st.lsp_hist.set(lsp_new.subarray(lsp_newOff, lsp_newOff + M), st.hist_ptr * M);

  L_frame_en = 0; /* Q0 */
  let p = speechOff;
  for (let i = L_FRAME; i !== 0; i--) {
    L_frame_en = (L_frame_en + ((speech[p] * speech[p]) << 1)) | 0;
    p++;
    if (L_frame_en < 0) {
      L_frame_en = MAX_32;
      break;
    }
  }

  Log2(L_frame_en, deScratchExp, deScratchFrac, pOverflow);
  const log_en_e = deScratchExp[0];
  const log_en_m = deScratchFrac[0];

  L_temp = log_en_e << 10;
  if (L_temp !== ((L_temp << 16) >> 16)) {
    pOverflow[0] = 1;
    log_en = log_en_e > 0 ? MAX_16 : MIN_16;
  } else {
    log_en = (L_temp << 16) >> 16;
  }

  log_en = (log_en + (log_en_m >> (15 - 10))) << 16 >> 16;
  log_en = (log_en - 8521) << 16 >> 16;

  st.log_en_hist[st.hist_ptr] = log_en >> 1; /* Q10 */
}

/** dtx_enc.cpp tx_dtx_handler: returns compute_new_sid_possible; usedMode 1-elt */
export function tx_dtx_handler(st, vad_flag, usedMode, pOverflow) {
  let compute_new_sid_possible;
  let count;

  st.decAnaElapsedCount = add_16(st.decAnaElapsedCount, 1, pOverflow);

  compute_new_sid_possible = 0;
  if (vad_flag !== 0) {
    st.dtxHangoverCount = DTX_HANG_CONST;
  } else {
    /* non-speech */
    if (st.dtxHangoverCount === 0) {
      st.decAnaElapsedCount = 0;
      usedMode[0] = MRDTX;
      compute_new_sid_possible = 1;
    } else {
      st.dtxHangoverCount -= 1;
      count = add_16(st.decAnaElapsedCount, st.dtxHangoverCount, pOverflow);
      if (count < DTX_ELAPSED_FRAMES_THRESH) {
        usedMode[0] = MRDTX;
      }
    }
  }

  return compute_new_sid_possible;
}
