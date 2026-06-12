/*
 * LSF decoding, ported from opencore-amr 0.1.6 dec/src:
 *   d_plsf.cpp (D_plsfState, D_plsf_reset), d_plsf_3.cpp (D_plsf_3,
 *   Init_D_plsf_3), d_plsf_5.cpp (D_plsf_5), int_lsf.cpp (Int_lsf)
 * Active implementations transcribed line by line.
 */
import { mult, add_16, sub, shl, negate } from '../common/basicop.js';
import { M, MR475, MR515, MR795, MRDTX, LSF_GAP, LSP_PRED_FAC_MR122 } from '../common/cnst.js';
import { Reorder_lsf, Lsf_lsp } from '../common/lsp_fns.js';
import {
  mean_lsf_3, pred_fac_3, dico1_lsf_3, dico2_lsf_3, dico3_lsf_3,
  mr515_3_lsf, mr795_1_lsf, mean_lsf_5, dico1_lsf_5, dico2_lsf_5,
  dico3_lsf_5, dico4_lsf_5, dico5_lsf_5, past_rq_init,
} from '../common/tables/index.js';

/* d_plsf_3.cpp */
const ALPHA = 29491;    /* ALPHA    ->  0.9         */
const ONE_ALPHA = 3277; /* ONE_ALPHA-> (1.0-ALPHA)  */
/* d_plsf_5.cpp uses different smoothing (0.95) */
const ALPHA_5 = 31128;
const ONE_ALPHA_5 = 1639;

const DICO1_SIZE = 256;
const DICO2_SIZE = 512;
const DICO3_SIZE = 512;
const MR515_3_SIZE = 128;
const MR795_1_SIZE = 512;

/** d_plsf.h D_plsfState */
export class D_plsfState {
  constructor() {
    this.past_r_q = new Int16Array(M);   /* Past quantized prediction error, Q15 */
    this.past_lsf_q = new Int16Array(M); /* Past dequantized lsfs,           Q15 */
    this.reset();
  }

  /** d_plsf.cpp D_plsf_reset */
  reset() {
    this.past_r_q.fill(0);
    this.past_lsf_q.set(mean_lsf_5);
    return 0;
  }
}

/** d_plsf_3.cpp Init_D_plsf_3: past_rq_init[] index [0, 7] */
export function Init_D_plsf_3(st, index) {
  st.past_r_q.set(past_rq_init.subarray(index * M, index * M + M));
}

const lsf1_r3 = new Int16Array(M);
const lsf1_q3 = new Int16Array(M);

/** d_plsf_3.cpp D_plsf_3 */
export function D_plsf_3(st, mode, bfi, indice, indiceOff, lsp1_q, lsp1_qOff, pOverflow) {
  let temp;
  let index;
  const lsf1_r = lsf1_r3;
  const lsf1_q = lsf1_q3;

  if (bfi !== 0) {
    /* if bad frame: use the past LSFs slightly shifted towards their mean */
    for (let i = 0; i < M; i++) {
      temp = mult(st.past_lsf_q[i], ALPHA, pOverflow);
      index = mult(mean_lsf_3[i], ONE_ALPHA, pOverflow);
      lsf1_q[i] = add_16(index, temp, pOverflow);
    }

    /* estimate past quantized residual to be used in next frame */
    if (mode !== MRDTX) {
      for (let i = 0; i < M; i++) {
        temp = mult(st.past_r_q[i], pred_fac_3[i], pOverflow);
        temp = add_16(mean_lsf_3[i], temp, pOverflow);
        st.past_r_q[i] = sub(lsf1_q[i], temp, pOverflow);
      }
    } else {
      for (let i = 0; i < M; i++) {
        temp = add_16(mean_lsf_3[i], st.past_r_q[i], pOverflow);
        st.past_r_q[i] = sub(lsf1_q[i], temp, pOverflow);
      }
    }
  } else {
    /* if good LSFs received */
    let index_limit_1 = 0;
    const index_limit_2 = (DICO2_SIZE - 1) * 3;
    let index_limit_3 = 0;
    let p_cb1;
    let p_cb3;
    const p_cb2 = dico2_lsf_3;

    if (mode === MR475 || mode === MR515) {
      p_cb1 = dico1_lsf_3;
      p_cb3 = mr515_3_lsf;
      index_limit_1 = (DICO1_SIZE - 1) * 3;
      index_limit_3 = (MR515_3_SIZE - 1) * 4;
    } else if (mode === MR795) {
      p_cb1 = mr795_1_lsf;
      p_cb3 = dico3_lsf_3;
      index_limit_1 = (MR795_1_SIZE - 1) * 3;
      index_limit_3 = (DICO3_SIZE - 1) * 4;
    } else {
      /* MR59, MR67, MR74, MR102, MRDTX */
      p_cb1 = dico1_lsf_3;
      p_cb3 = dico3_lsf_3;
      index_limit_1 = (DICO1_SIZE - 1) * 3;
      index_limit_3 = (DICO3_SIZE - 1) * 4;
    }

    /* decode prediction residuals from 3 received indices */
    let pInd = indiceOff;
    index = indice[pInd++];
    temp = index + (index << 1); /* 3*index */
    if (temp > index_limit_1) {
      temp = index_limit_1; /* avoid buffer overrun */
    }
    lsf1_r[0] = p_cb1[temp];
    lsf1_r[1] = p_cb1[temp + 1];
    lsf1_r[2] = p_cb1[temp + 2];

    index = indice[pInd++];
    if (mode === MR475 || mode === MR515) {
      /* MR475, MR515 only using every second entry */
      index <<= 1;
    }
    temp = index + (index << 1); /* 3*index */
    if (temp > index_limit_2) {
      temp = index_limit_2;
    }
    lsf1_r[3] = p_cb2[temp];
    lsf1_r[4] = p_cb2[temp + 1];
    lsf1_r[5] = p_cb2[temp + 2];

    index = indice[pInd++];
    temp = index << 2;
    if (temp > index_limit_3) {
      temp = index_limit_3;
    }
    lsf1_r[6] = p_cb3[temp];
    lsf1_r[7] = p_cb3[temp + 1];
    lsf1_r[8] = p_cb3[temp + 2];
    lsf1_r[9] = p_cb3[temp + 3];

    /* Compute quantized LSFs and update the past quantized residual */
    if (mode !== MRDTX) {
      for (let i = 0; i < M; i++) {
        temp = mult(st.past_r_q[i], pred_fac_3[i], pOverflow);
        temp = add_16(mean_lsf_3[i], temp, pOverflow);
        lsf1_q[i] = add_16(lsf1_r[i], temp, pOverflow);
        st.past_r_q[i] = lsf1_r[i];
      }
    } else {
      for (let i = 0; i < M; i++) {
        temp = add_16(mean_lsf_3[i], st.past_r_q[i], pOverflow);
        lsf1_q[i] = add_16(lsf1_r[i], temp, pOverflow);
        st.past_r_q[i] = lsf1_r[i];
      }
    }
  }

  /* verification that LSFs has minimum distance of LSF_GAP Hz */
  Reorder_lsf(lsf1_q, 0, LSF_GAP, M, pOverflow);
  st.past_lsf_q.set(lsf1_q);

  /* convert LSFs to the cosine domain */
  Lsf_lsp(lsf1_q, 0, lsp1_q, lsp1_qOff, M, pOverflow);
}

const lsf1_r5 = new Int16Array(M);
const lsf2_r5 = new Int16Array(M);
const lsf1_q5 = new Int16Array(M);
const lsf2_q5 = new Int16Array(M);

/** d_plsf_5.cpp D_plsf_5 (MR122) */
export function D_plsf_5(st, bfi, indice, indiceOff, lsp1_q, lsp1_qOff,
  lsp2_q, lsp2_qOff, pOverflow) {
  let temp;
  let sign;
  let i;
  const lsf1_r = lsf1_r5;
  const lsf2_r = lsf2_r5;
  const lsf1_q = lsf1_q5;
  const lsf2_q = lsf2_q5;

  if (bfi !== 0) {
    /* if bad frame: use the past LSFs slightly shifted towards their mean */
    for (i = 0; i < M; i++) {
      temp = ((st.past_lsf_q[i] * ALPHA_5) >> 15) << 16 >> 16;
      sign = ((mean_lsf_5[i] * ONE_ALPHA_5) >> 15) << 16 >> 16;
      lsf1_q[i] = add_16(sign, temp, pOverflow);
      lsf2_q[i] = lsf1_q[i];

      /* estimate past quantized residual to be used in next frame */
      temp = ((st.past_r_q[i] * LSP_PRED_FAC_MR122) >> 15) << 16 >> 16;
      temp = add_16(mean_lsf_5[i], temp, pOverflow);
      st.past_r_q[i] = sub(lsf2_q[i], temp, pOverflow);
    }
  } else {
    /* if good LSFs received: decode prediction residuals from 5 indices */
    temp = shl(indice[indiceOff], 2, pOverflow);
    lsf1_r[0] = dico1_lsf_5[temp];
    lsf1_r[1] = dico1_lsf_5[temp + 1];
    lsf2_r[0] = dico1_lsf_5[temp + 2];
    lsf2_r[1] = dico1_lsf_5[temp + 3];

    temp = shl(indice[indiceOff + 1], 2, pOverflow);
    lsf1_r[2] = dico2_lsf_5[temp];
    lsf1_r[3] = dico2_lsf_5[temp + 1];
    lsf2_r[2] = dico2_lsf_5[temp + 2];
    lsf2_r[3] = dico2_lsf_5[temp + 3];

    sign = indice[indiceOff + 2] & 1;
    if (indice[indiceOff + 2] < 0) {
      i = ~(~indice[indiceOff + 2] >> 1);
    } else {
      i = indice[indiceOff + 2] >> 1;
    }
    temp = shl(i, 2, pOverflow);
    if (sign === 0) {
      lsf1_r[4] = dico3_lsf_5[temp];
      lsf1_r[5] = dico3_lsf_5[temp + 1];
      lsf2_r[4] = dico3_lsf_5[temp + 2];
      lsf2_r[5] = dico3_lsf_5[temp + 3];
    } else {
      lsf1_r[4] = negate(dico3_lsf_5[temp]);
      lsf1_r[5] = negate(dico3_lsf_5[temp + 1]);
      lsf2_r[4] = negate(dico3_lsf_5[temp + 2]);
      lsf2_r[5] = negate(dico3_lsf_5[temp + 3]);
    }

    temp = shl(indice[indiceOff + 3], 2, pOverflow);
    lsf1_r[6] = dico4_lsf_5[temp];
    lsf1_r[7] = dico4_lsf_5[temp + 1];
    lsf2_r[6] = dico4_lsf_5[temp + 2];
    lsf2_r[7] = dico4_lsf_5[temp + 3];

    temp = shl(indice[indiceOff + 4], 2, pOverflow);
    lsf1_r[8] = dico5_lsf_5[temp];
    lsf1_r[9] = dico5_lsf_5[temp + 1];
    lsf2_r[8] = dico5_lsf_5[temp + 2];
    lsf2_r[9] = dico5_lsf_5[temp + 3];

    /* Compute quantized LSFs and update the past quantized residual */
    for (i = 0; i < M; i++) {
      temp = mult(st.past_r_q[i], LSP_PRED_FAC_MR122, pOverflow);
      temp = add_16(mean_lsf_5[i], temp, pOverflow);
      lsf1_q[i] = add_16(lsf1_r[i], temp, pOverflow);
      lsf2_q[i] = add_16(lsf2_r[i], temp, pOverflow);
      st.past_r_q[i] = lsf2_r[i];
    }
  }

  /* verification that LSFs have minimum distance of LSF_GAP Hz */
  Reorder_lsf(lsf1_q, 0, LSF_GAP, M, pOverflow);
  Reorder_lsf(lsf2_q, 0, LSF_GAP, M, pOverflow);
  st.past_lsf_q.set(lsf2_q);

  /* convert LSFs to the cosine domain */
  Lsf_lsp(lsf1_q, 0, lsp1_q, lsp1_qOff, M, pOverflow);
  Lsf_lsp(lsf2_q, 0, lsp2_q, lsp2_qOff, M, pOverflow);
}

/** int_lsf.cpp Int_lsf: interpolate LSF for subframe i_subfr (0,40,80,120) */
export function Int_lsf(lsf_old, lsf_oldOff, lsf_new, lsf_newOff, i_subfr,
  lsf_out, lsf_outOff, pOverflow) {
  let temp1;
  let temp2;

  if (i_subfr === 0) {
    for (let i = M - 1; i >= 0; i--) {
      if (lsf_old[lsf_oldOff + i] < 0) {
        temp1 = ~(~lsf_old[lsf_oldOff + i] >> 2);
      } else {
        temp1 = lsf_old[lsf_oldOff + i] >> 2;
      }
      if (lsf_new[lsf_newOff + i] < 0) {
        temp2 = ~(~lsf_new[lsf_newOff + i] >> 2);
      } else {
        temp2 = lsf_new[lsf_newOff + i] >> 2;
      }
      lsf_out[lsf_outOff + i] = add_16(
        (lsf_old[lsf_oldOff + i] - temp1) << 16 >> 16,
        temp2 << 16 >> 16, pOverflow);
    }
  } else if (i_subfr === 40) {
    for (let i = M - 1; i >= 0; i--) {
      if (lsf_old[lsf_oldOff + i] < 0) {
        temp1 = ~(~lsf_old[lsf_oldOff + i] >> 1);
      } else {
        temp1 = lsf_old[lsf_oldOff + i] >> 1;
      }
      if (lsf_new[lsf_newOff + i] < 0) {
        temp2 = ~(~lsf_new[lsf_newOff + i] >> 1);
      } else {
        temp2 = lsf_new[lsf_newOff + i] >> 1;
      }
      lsf_out[lsf_outOff + i] = temp1 + temp2;
    }
  } else if (i_subfr === 80) {
    for (let i = M - 1; i >= 0; i--) {
      if (lsf_old[lsf_oldOff + i] < 0) {
        temp1 = ~(~lsf_old[lsf_oldOff + i] >> 2);
      } else {
        temp1 = lsf_old[lsf_oldOff + i] >> 2;
      }
      if (lsf_new[lsf_newOff + i] < 0) {
        temp2 = ~(~lsf_new[lsf_newOff + i] >> 2);
      } else {
        temp2 = lsf_new[lsf_newOff + i] >> 2;
      }
      lsf_out[lsf_outOff + i] = add_16(
        temp1 << 16 >> 16,
        (lsf_new[lsf_newOff + i] - temp2) << 16 >> 16, pOverflow);
    }
  } else if (i_subfr === 120) {
    for (let i = M - 1; i >= 0; i--) {
      lsf_out[lsf_outOff + i] = lsf_new[lsf_newOff + i];
    }
  }
}
