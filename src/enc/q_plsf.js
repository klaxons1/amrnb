/*
 * LSP quantization, ported from opencore-amr 0.1.6 common/src:
 *   q_plsf.cpp (Q_plsfState), q_plsf_3.cpp (Vq_subvec4, Vq_subvec3, Q_plsf_3),
 *   q_plsf_5.cpp (Vq_subvec, Vq_subvec_s, Q_plsf_5), lsp.cpp (lspState, lsp)
 * Active implementations transcribed line by line.
 */
import { MAX_32 } from '../common/basicop.js';
import { M, MP1, LSF_GAP, LSP_PRED_FAC_MR122, MR475, MR515, MR795, MR122, MRDTX } from '../common/cnst.js';
import { Lsp_lsf, Lsf_lsp, Reorder_lsf, Az_lsp } from '../common/lsp_fns.js';
import { Lsf_wt, Int_lpc_1and3, Int_lpc_1and3_2, Int_lpc_1to3, Int_lpc_1to3_2 } from '../common/int_lpc.js';
import {
  mean_lsf_3, pred_fac_3, dico1_lsf_3, dico2_lsf_3, dico3_lsf_3,
  mr515_3_lsf, mr795_1_lsf, past_rq_init,
  mean_lsf_5, dico1_lsf_5, dico2_lsf_5, dico3_lsf_5, dico4_lsf_5, dico5_lsf_5,
  lsp_init_data,
} from '../common/tables/index.js';

const PAST_RQ_INIT_SIZE = 8;
const DICO1_SIZE = 256;
const DICO2_SIZE = 512;
const DICO3_SIZE = 512;
const MR515_3_SIZE = 128;
const MR795_1_SIZE = 512;
const DICO1_5_SIZE = 128;
const DICO2_5_SIZE = 256;
const DICO3_5_SIZE = 256;
const DICO4_5_SIZE = 256;
const DICO5_5_SIZE = 64;

/** q_plsf.h Q_plsfState */
export class Q_plsfState {
  constructor() {
    this.past_rq = new Int16Array(M); /* Past quantized prediction error, Q15 */
  }

  /** q_plsf.cpp Q_plsf_reset */
  reset() {
    this.past_rq.fill(0);
    return 0;
  }
}

/** q_plsf_3.cpp Vq_subvec4 (pOverflow intentionally unused) */
function Vq_subvec4(lsf_r1, lsf_r1Off, dico, wf1, wf1Off, dico_size, pOverflow) {
  let temp;
  let index = 0;
  let dist_min = MAX_32;
  let dist;
  let p = 0;

  const lsf_r1_0 = lsf_r1[lsf_r1Off];
  const lsf_r1_1 = lsf_r1[lsf_r1Off + 1];
  const lsf_r1_2 = lsf_r1[lsf_r1Off + 2];
  const lsf_r1_3 = lsf_r1[lsf_r1Off + 3];
  const wf1_0 = wf1[wf1Off];
  const wf1_1 = wf1[wf1Off + 1];
  const wf1_2 = wf1[wf1Off + 2];
  const wf1_3 = wf1[wf1Off + 3];

  for (let i = 0; i < dico_size; i++) {
    temp = (lsf_r1_0 - dico[p++]) << 16 >> 16;
    temp = ((wf1_0 * temp) >> 15) << 16 >> 16;
    dist = temp * temp;

    temp = (lsf_r1_1 - dico[p++]) << 16 >> 16;
    temp = ((wf1_1 * temp) >> 15) << 16 >> 16;
    dist = (dist + temp * temp) | 0;

    temp = (lsf_r1_2 - dico[p++]) << 16 >> 16;
    temp = ((wf1_2 * temp) >> 15) << 16 >> 16;
    dist = (dist + temp * temp) | 0;

    temp = (lsf_r1_3 - dico[p++]) << 16 >> 16;
    temp = ((wf1_3 * temp) >> 15) << 16 >> 16;
    dist = (dist + temp * temp) | 0;

    if (dist < dist_min) {
      dist_min = dist;
      index = i;
    }
  }

  /* Reading the selected vector */
  let pd = index << 2;
  lsf_r1[lsf_r1Off] = dico[pd++];
  lsf_r1[lsf_r1Off + 1] = dico[pd++];
  lsf_r1[lsf_r1Off + 2] = dico[pd++];
  lsf_r1[lsf_r1Off + 3] = dico[pd];

  return index;
}

/** q_plsf_3.cpp Vq_subvec3 (pOverflow intentionally unused) */
function Vq_subvec3(lsf_r1, lsf_r1Off, dico, wf1, wf1Off, dico_size, use_half, pOverflow) {
  let temp;
  let p_dico_index = 0;
  let index = 0;
  let dist_min = MAX_32;
  let dist;
  let p = 0;

  const lsf_r1_0 = lsf_r1[lsf_r1Off];
  const lsf_r1_1 = lsf_r1[lsf_r1Off + 1];
  const lsf_r1_2 = lsf_r1[lsf_r1Off + 2];
  const wf1_0 = wf1[wf1Off];
  const wf1_1 = wf1[wf1Off + 1];
  const wf1_2 = wf1[wf1Off + 2];

  if (use_half !== 0) {
    p_dico_index = 3;
  }

  for (let i = 0; i < dico_size; i++) {
    temp = (lsf_r1_0 - dico[p++]) << 16 >> 16;
    temp = ((wf1_0 * temp) >> 15) << 16 >> 16;
    dist = temp * temp;

    temp = (lsf_r1_1 - dico[p++]) << 16 >> 16;
    temp = ((wf1_1 * temp) >> 15) << 16 >> 16;
    dist = (dist + temp * temp) | 0;

    temp = (lsf_r1_2 - dico[p++]) << 16 >> 16;
    temp = ((wf1_2 * temp) >> 15) << 16 >> 16;
    dist = (dist + temp * temp) | 0;

    if (dist < dist_min) {
      dist_min = dist;
      index = i;
    }

    p = p + p_dico_index;
  }

  let pd = 3 * index;
  if (use_half !== 0) {
    pd += 3 * index;
  }

  /* Reading the selected vector */
  lsf_r1[lsf_r1Off] = dico[pd++];
  lsf_r1[lsf_r1Off + 1] = dico[pd++];
  lsf_r1[lsf_r1Off + 2] = dico[pd];

  return index;
}

/** q_plsf_5.cpp Vq_subvec (pOverflow intentionally unused) */
function Vq_subvec(lsf_r1, lsf_r1Off, lsf_r2, lsf_r2Off, dico,
  wf1, wf1Off, wf2, wf2Off, dico_size, pOverflow) {
  let index = 0;
  let temp;
  let dist_min = MAX_32;
  let dist;
  let p = 0;

  const wf1_0 = wf1[wf1Off];
  const wf1_1 = wf1[wf1Off + 1];
  const wf2_0 = wf2[wf2Off];
  const wf2_1 = wf2[wf2Off + 1];

  const aux1 = lsf_r1[lsf_r1Off] * wf1_0;
  const aux2 = lsf_r1[lsf_r1Off + 1] * wf1_1;
  const aux3 = lsf_r2[lsf_r2Off] * wf2_0;
  const aux4 = lsf_r2[lsf_r2Off + 1] * wf2_1;

  for (let i = 0; i < dico_size; i++) {
    temp = (((aux1 - wf1_0 * dico[p++]) | 0) >> 15) << 16 >> 16;
    dist = temp * temp;
    if (dist >= dist_min) {
      p += 3;
      continue;
    }

    temp = (((aux2 - wf1_1 * dico[p++]) | 0) >> 15) << 16 >> 16;
    dist = (dist + temp * temp) | 0;
    if (dist >= dist_min) {
      p += 2;
      continue;
    }

    temp = (((aux3 - wf2_0 * dico[p++]) | 0) >> 15) << 16 >> 16;
    dist = (dist + temp * temp) | 0;
    if (dist >= dist_min) {
      p += 1;
      continue;
    }

    temp = (((aux4 - wf2_1 * dico[p++]) | 0) >> 15) << 16 >> 16;
    dist = (dist + temp * temp) | 0;

    if (dist < dist_min) {
      dist_min = dist;
      index = i;
    }
  }

  /* Reading the selected vector */
  let pd = index << 2;
  lsf_r1[lsf_r1Off] = dico[pd++];
  lsf_r1[lsf_r1Off + 1] = dico[pd++];
  lsf_r2[lsf_r2Off] = dico[pd++];
  lsf_r2[lsf_r2Off + 1] = dico[pd];

  return index;
}

/** q_plsf_5.cpp Vq_subvec_s (pOverflow intentionally unused) */
function Vq_subvec_s(lsf_r1, lsf_r1Off, lsf_r2, lsf_r2Off, dico,
  wf1, wf1Off, wf2, wf2Off, dico_size, pOverflow) {
  let index = 0;
  let sign = 0;
  let temp, temp1, temp2;
  let dist_min = MAX_32;
  let dist1, dist2;
  let p = 0;

  const lsf_r1_0 = lsf_r1[lsf_r1Off];
  const lsf_r1_1 = lsf_r1[lsf_r1Off + 1];
  const lsf_r2_0 = lsf_r2[lsf_r2Off];
  const lsf_r2_1 = lsf_r2[lsf_r2Off + 1];
  const wf1_0 = wf1[wf1Off];
  const wf1_1 = wf1[wf1Off + 1];
  const wf2_0 = wf2[wf2Off];
  const wf2_1 = wf2[wf2Off + 1];

  for (let i = 0; i < dico_size; i++) {
    /* test positive */
    temp = dico[p++];
    temp1 = (lsf_r1_0 - temp) << 16 >> 16;
    temp2 = (lsf_r1_0 + temp) << 16 >> 16;
    temp1 = ((wf1_0 * temp1) >> 15) << 16 >> 16;
    temp2 = ((wf1_0 * temp2) >> 15) << 16 >> 16;
    dist1 = temp1 * temp1;
    dist2 = temp2 * temp2;

    temp = dico[p++];
    temp1 = (lsf_r1_1 - temp) << 16 >> 16;
    temp2 = (lsf_r1_1 + temp) << 16 >> 16;
    temp1 = ((wf1_1 * temp1) >> 15) << 16 >> 16;
    temp2 = ((wf1_1 * temp2) >> 15) << 16 >> 16;
    dist1 = (dist1 + temp1 * temp1) | 0;
    dist2 = (dist2 + temp2 * temp2) | 0;

    if (dist1 >= dist_min && dist2 >= dist_min) {
      p += 2;
      continue;
    }

    temp = dico[p++];
    temp1 = (lsf_r2_0 - temp) << 16 >> 16;
    temp2 = (lsf_r2_0 + temp) << 16 >> 16;
    temp1 = ((wf2_0 * temp1) >> 15) << 16 >> 16;
    temp2 = ((wf2_0 * temp2) >> 15) << 16 >> 16;
    dist1 = (dist1 + temp1 * temp1) | 0;
    dist2 = (dist2 + temp2 * temp2) | 0;

    temp = dico[p++];
    temp1 = (lsf_r2_1 - temp) << 16 >> 16;
    temp2 = (lsf_r2_1 + temp) << 16 >> 16;
    temp1 = ((wf2_1 * temp1) >> 15) << 16 >> 16;
    temp2 = ((wf2_1 * temp2) >> 15) << 16 >> 16;
    dist1 = (dist1 + temp1 * temp1) | 0;
    dist2 = (dist2 + temp2 * temp2) | 0;

    if (dist1 < dist_min) {
      dist_min = dist1;
      index = i;
      sign = 0;
    }

    /* test negative */
    if (dist2 < dist_min) {
      dist_min = dist2;
      index = i;
      sign = 1;
    }
  }

  /* Reading the selected vector */
  let pd = index << 2;
  index <<= 1;
  if (sign) {
    lsf_r1[lsf_r1Off] = (-dico[pd++]) << 16 >> 16;
    lsf_r1[lsf_r1Off + 1] = (-dico[pd++]) << 16 >> 16;
    lsf_r2[lsf_r2Off] = (-dico[pd++]) << 16 >> 16;
    lsf_r2[lsf_r2Off + 1] = (-dico[pd]) << 16 >> 16;
    index += 1;
  } else {
    lsf_r1[lsf_r1Off] = dico[pd++];
    lsf_r1[lsf_r1Off + 1] = dico[pd++];
    lsf_r2[lsf_r2Off] = dico[pd++];
    lsf_r2[lsf_r2Off + 1] = dico[pd];
  }

  return index;
}

const q3Lsf1 = new Int16Array(M);
const q3Wf1 = new Int16Array(M);
const q3LsfP = new Int16Array(M);
const q3LsfR1 = new Int16Array(M);
const q3Lsf1Q = new Int16Array(M);
const q3TempR1 = new Int16Array(M);
const q3TempP = new Int16Array(M);

/**
 * q_plsf_3.cpp Q_plsf_3.
 * @param {Int16Array} pred_init_i 1-element out (DTX init index)
 */
export function Q_plsf_3(st, mode, lsp1, lsp1Off, lsp1_q, lsp1_qOff,
  indice, indiceOff, pred_init_i, pOverflow) {
  const lsf1 = q3Lsf1;
  const wf1 = q3Wf1;
  const lsf_p = q3LsfP;
  const lsf_r1 = q3LsfR1;
  const lsf1_q = q3Lsf1Q;
  const temp_r1 = q3TempR1;
  const temp_p = q3TempP;
  let temp;
  let L_pred_init_err;
  let L_min_pred_init_err;
  let L_temp;

  /* convert LSFs to normalize frequency domain 0..16384 */
  Lsp_lsf(lsp1, lsp1Off, lsf1, 0, M, pOverflow);

  /* compute LSF weighting factors (Q13) */
  Lsf_wt(lsf1, 0, wf1, 0, pOverflow);

  /* Compute predicted LSF and prediction error */
  if (mode !== MRDTX) {
    for (let i = 0; i < M; i++) {
      temp = ((st.past_rq[i] * pred_fac_3[i]) >> 15) << 16 >> 16;
      lsf_p[i] = mean_lsf_3[i] + temp;
      lsf_r1[i] = lsf1[i] - lsf_p[i];
    }
  } else {
    /* DTX mode: search the init vector that yields lowest prediction
       residual energy */
    pred_init_i[0] = 0;
    L_min_pred_init_err = 0x7fffffff;
    for (let j = 0; j < PAST_RQ_INIT_SIZE; j++) {
      L_pred_init_err = 0;
      for (let i = 0; i < M; i++) {
        temp_p[i] = mean_lsf_3[i] + past_rq_init[j * M + i];
        temp_r1[i] = lsf1[i] - temp_p[i];
        L_temp = temp_r1[i] * temp_r1[i];
        L_pred_init_err = (L_pred_init_err + (L_temp << 1)) | 0;
      }
      if (L_pred_init_err < L_min_pred_init_err) {
        L_min_pred_init_err = L_pred_init_err;
        lsf_r1.set(temp_r1);
        lsf_p.set(temp_p);
        st.past_rq.set(past_rq_init.subarray(j * M, j * M + M));
        pred_init_i[0] = j;
      }
    }
  }

  /* Split-VQ of prediction error */
  if (mode === MR475 || mode === MR515) {
    indice[indiceOff] = Vq_subvec3(lsf_r1, 0, dico1_lsf_3, wf1, 0,
      DICO1_SIZE, 0, pOverflow);
    indice[indiceOff + 1] = Vq_subvec3(lsf_r1, 3, dico2_lsf_3, wf1, 3,
      DICO2_SIZE / 2, 1, pOverflow);
    indice[indiceOff + 2] = Vq_subvec4(lsf_r1, 6, mr515_3_lsf, wf1, 6,
      MR515_3_SIZE, pOverflow);
  } else if (mode === MR795) {
    indice[indiceOff] = Vq_subvec3(lsf_r1, 0, mr795_1_lsf, wf1, 0,
      MR795_1_SIZE, 0, pOverflow);
    indice[indiceOff + 1] = Vq_subvec3(lsf_r1, 3, dico2_lsf_3, wf1, 3,
      DICO2_SIZE, 0, pOverflow);
    indice[indiceOff + 2] = Vq_subvec4(lsf_r1, 6, dico3_lsf_3, wf1, 6,
      DICO3_SIZE, pOverflow);
  } else {
    /* MR59, MR67, MR74, MR102, MRDTX */
    indice[indiceOff] = Vq_subvec3(lsf_r1, 0, dico1_lsf_3, wf1, 0,
      DICO1_SIZE, 0, pOverflow);
    indice[indiceOff + 1] = Vq_subvec3(lsf_r1, 3, dico2_lsf_3, wf1, 3,
      DICO2_SIZE, 0, pOverflow);
    indice[indiceOff + 2] = Vq_subvec4(lsf_r1, 6, dico3_lsf_3, wf1, 6,
      DICO3_SIZE, pOverflow);
  }

  /* Compute quantized LSFs and update the past quantized residual */
  for (let i = 0; i < M; i++) {
    lsf1_q[i] = lsf_r1[i] + lsf_p[i];
    st.past_rq[i] = lsf_r1[i];
  }

  /* verification that LSFs has minimum distance of LSF_GAP Hz */
  Reorder_lsf(lsf1_q, 0, LSF_GAP, M, pOverflow);

  /* convert LSFs to the cosine domain */
  Lsf_lsp(lsf1_q, 0, lsp1_q, lsp1_qOff, M, pOverflow);
}

const q5Lsf1 = new Int16Array(M);
const q5Lsf2 = new Int16Array(M);
const q5Wf1 = new Int16Array(M);
const q5Wf2 = new Int16Array(M);
const q5LsfP = new Int16Array(M);
const q5LsfR1 = new Int16Array(M);
const q5LsfR2 = new Int16Array(M);
const q5Lsf1Q = new Int16Array(M);
const q5Lsf2Q = new Int16Array(M);

/** q_plsf_5.cpp Q_plsf_5 (MR122) */
export function Q_plsf_5(st, lsp1, lsp1Off, lsp2, lsp2Off,
  lsp1_q, lsp1_qOff, lsp2_q, lsp2_qOff, indice, indiceOff, pOverflow) {
  const lsf1 = q5Lsf1;
  const lsf2 = q5Lsf2;
  const wf1 = q5Wf1;
  const wf2 = q5Wf2;
  const lsf_p = q5LsfP;
  const lsf_r1 = q5LsfR1;
  const lsf_r2 = q5LsfR2;
  const lsf1_q = q5Lsf1Q;
  const lsf2_q = q5Lsf2Q;

  /* convert LSFs to normalize frequency domain 0..16384 */
  Lsp_lsf(lsp1, lsp1Off, lsf1, 0, M, pOverflow);
  Lsp_lsf(lsp2, lsp2Off, lsf2, 0, M, pOverflow);

  /* Compute LSF weighting factors (Q13) */
  Lsf_wt(lsf1, 0, wf1, 0, pOverflow);
  Lsf_wt(lsf2, 0, wf2, 0, pOverflow);

  /* Compute predicted LSF and prediction error */
  for (let i = 0; i < M; i++) {
    lsf_p[i] = mean_lsf_5[i] + (((st.past_rq[i] * LSP_PRED_FAC_MR122) >> 15) << 16 >> 16);
    lsf_r1[i] = lsf1[i] - lsf_p[i];
    lsf_r2[i] = lsf2[i] - lsf_p[i];
  }

  /* Split-MQ of prediction error */
  indice[indiceOff] = Vq_subvec(lsf_r1, 0, lsf_r2, 0, dico1_lsf_5,
    wf1, 0, wf2, 0, DICO1_5_SIZE, pOverflow);
  indice[indiceOff + 1] = Vq_subvec(lsf_r1, 2, lsf_r2, 2, dico2_lsf_5,
    wf1, 2, wf2, 2, DICO2_5_SIZE, pOverflow);
  indice[indiceOff + 2] = Vq_subvec_s(lsf_r1, 4, lsf_r2, 4, dico3_lsf_5,
    wf1, 4, wf2, 4, DICO3_5_SIZE, pOverflow);
  indice[indiceOff + 3] = Vq_subvec(lsf_r1, 6, lsf_r2, 6, dico4_lsf_5,
    wf1, 6, wf2, 6, DICO4_5_SIZE, pOverflow);
  indice[indiceOff + 4] = Vq_subvec(lsf_r1, 8, lsf_r2, 8, dico5_lsf_5,
    wf1, 8, wf2, 8, DICO5_5_SIZE, pOverflow);

  /* Compute quantized LSFs and update the past quantized residual */
  for (let i = 0; i < M; i++) {
    lsf1_q[i] = lsf_r1[i] + lsf_p[i];
    lsf2_q[i] = lsf_r2[i] + lsf_p[i];
    st.past_rq[i] = lsf_r2[i];
  }

  /* verification that LSFs has minimum distance of LSF_GAP */
  Reorder_lsf(lsf1_q, 0, LSF_GAP, M, pOverflow);
  Reorder_lsf(lsf2_q, 0, LSF_GAP, M, pOverflow);

  /* convert LSFs to the cosine domain */
  Lsf_lsp(lsf1_q, 0, lsp1_q, lsp1_qOff, M, pOverflow);
  Lsf_lsp(lsf2_q, 0, lsp2_q, lsp2_qOff, M, pOverflow);
}

/** lsp.h lspState */
export class lspState {
  constructor() {
    this.lsp_old = new Int16Array(M);
    this.lsp_old_q = new Int16Array(M);
    this.qSt = new Q_plsfState();
    this.reset();
  }

  /** lsp.cpp lsp_reset */
  reset() {
    this.lsp_old.set(lsp_init_data);
    this.lsp_old_q.set(this.lsp_old);
    this.qSt.reset();
    return 0;
  }
}

const lspNewQ = new Int16Array(M);
const lspMid = new Int16Array(M);
const lspMidQ = new Int16Array(M);
const lspPredInitI = new Int16Array(1);

/**
 * lsp.cpp lsp: LSP computation + quantization.
 * anap is a cursor object { arr, off } advancing through the analysis params.
 */
export function lsp_fn(st, req_mode, used_mode, az, azOff, azQ, azQOff,
  lsp_new, lsp_newOff, anap, pOverflow) {
  const lsp_new_q = lspNewQ; /* LSPs at 4th subframe */
  const lsp_mid = lspMid;    /* LSPs at 2nd subframe */
  const lsp_mid_q = lspMidQ;

  if (req_mode === MR122) {
    Az_lsp(az, azOff + MP1, lsp_mid, 0, st.lsp_old, 0, pOverflow);
    Az_lsp(az, azOff + MP1 * 3, lsp_new, lsp_newOff, lsp_mid, 0, pOverflow);

    /* Find interpolated LPC parameters in all subframes (unquantized) */
    Int_lpc_1and3_2(st.lsp_old, 0, lsp_mid, 0, lsp_new, lsp_newOff,
      az, azOff, pOverflow);

    if (used_mode !== MRDTX) {
      /* LSP quantization (lsp_mid[] and lsp_new[] jointly quantized) */
      Q_plsf_5(st.qSt, lsp_mid, 0, lsp_new, lsp_newOff,
        lsp_mid_q, 0, lsp_new_q, 0, anap.arr, anap.off, pOverflow);
      Int_lpc_1and3(st.lsp_old_q, 0, lsp_mid_q, 0, lsp_new_q, 0,
        azQ, azQOff, pOverflow);

      /* Advance analysis parameters pointer */
      anap.off += 5;
    }
  } else {
    Az_lsp(az, azOff + MP1 * 3, lsp_new, lsp_newOff, st.lsp_old, 0, pOverflow);

    /* Find interpolated LPC parameters in all subframes (unquantized) */
    Int_lpc_1to3_2(st.lsp_old, 0, lsp_new, lsp_newOff, az, azOff, pOverflow);

    if (used_mode !== MRDTX) {
      /* LSP quantization */
      Q_plsf_3(st.qSt, req_mode, lsp_new, lsp_newOff, lsp_new_q, 0,
        anap.arr, anap.off, lspPredInitI, pOverflow);
      Int_lpc_1to3(st.lsp_old_q, 0, lsp_new_q, 0, azQ, azQOff, pOverflow);

      /* Advance analysis parameters pointer */
      anap.off += 3;
    }
  }

  /* update the LSPs for the next frame */
  st.lsp_old.set(lsp_new.subarray(lsp_newOff, lsp_newOff + M));
  if (used_mode !== MRDTX) {
    st.lsp_old_q.set(lsp_new_q);
  }
}
