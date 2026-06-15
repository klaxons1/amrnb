/*
 * 31-bit / 8-pulse algebraic codebook (MR102), ported from opencore-amr
 * 0.1.6 enc/src/c8_31pf.cpp (build_code, compress10, compress_code,
 * code_8i40_31bits). Active implementations transcribed line by line.
 */
import { pv_round, L_mac } from '../common/basicop.js';
import { L_CODE, NB_TRACK_MR102, STEP_MR102 } from '../common/cnst.js';
import { cor_h, cor_h_x2, set_sign12k2 } from './cor.js';
import { search_10and8i40 } from './s10_8pf.js';

const NB_PULSE = 8;
const POS_CODE = 8191;
const NEG_CODE = 8191;
const POS_SIGN = 32767;
const NEG_SIGN = -32768;

const bcSign = new Int16Array(NB_PULSE);

/** c8_31pf.cpp build_code (static) */
function build_code(codvec, sign, signOff, cod, codOff, h, hOff, y, yOff,
  sign_indx, pos_indx, pOverflow) {
  let i, j;
  let track, sign_index, pos_index;
  const _sign = bcSign;
  let s;

  for (i = 0; i < L_CODE; i++) cod[codOff + i] = 0;
  for (i = 0; i < NB_TRACK_MR102; i++) {
    pos_indx[i] = -1;
    sign_indx[i] = -1;
  }

  for (let k = 0; k < NB_PULSE; k++) {
    i = codvec[k];
    j = sign[signOff + i];
    pos_index = i >> 2; /* index = pos/4 */
    track = i & 3;      /* track = pos%4 */

    if (j > 0) {
      cod[codOff + i] = (cod[codOff + i] + POS_CODE) << 16 >> 16;
      _sign[k] = POS_SIGN;
      sign_index = 0;
    } else {
      cod[codOff + i] = (cod[codOff + i] - NEG_CODE) << 16 >> 16;
      _sign[k] = NEG_SIGN;
      sign_index = 1;
    }

    if (pos_indx[track] < 0) {
      pos_indx[track] = pos_index;
      sign_indx[track] = sign_index;
    } else if (((sign_index ^ sign_indx[track]) & 1) === 0) {
      if (pos_indx[track] <= pos_index) {
        pos_indx[track + NB_TRACK_MR102] = pos_index;
      } else {
        pos_indx[track + NB_TRACK_MR102] = pos_indx[track];
        pos_indx[track] = pos_index;
        sign_indx[track] = sign_index;
      }
    } else if (pos_indx[track] <= pos_index) {
      pos_indx[track + NB_TRACK_MR102] = pos_indx[track];
      pos_indx[track] = pos_index;
      sign_indx[track] = sign_index;
    } else {
      pos_indx[track + NB_TRACK_MR102] = pos_index;
    }
  }

  const p = new Array(NB_PULSE);
  for (let k = 0; k < NB_PULSE; k++) {
    p[k] = hOff - codvec[k];
  }
  for (i = 0; i < L_CODE; i++) {
    s = 0;
    for (let k = 0; k < NB_PULSE; k++) {
      s = L_mac(s, h[p[k]++], _sign[k], pOverflow);
    }
    y[yOff + i] = pv_round(s, pOverflow);
  }
}

/** c8_31pf.cpp compress10 (static, pOverflow intentionally unused) */
function compress10(pos_indxA, pos_indxB, pos_indxC, pOverflow) {
  let indx;
  let ia, ib, ic;
  let tempWord32;

  ia = pos_indxA >> 1;
  ib = pos_indxB >> 1;
  tempWord32 = (ib * 5) << 1;
  tempWord32 = tempWord32 >> 1;
  ib = (tempWord32 << 16) >> 16;
  ic = pos_indxC >> 1;
  tempWord32 = (ic * 25) << 1;
  tempWord32 = tempWord32 >> 1;
  ic = (tempWord32 << 16) >> 16;
  ib += ic;
  ib += ia;
  indx = (ib << 3) << 16 >> 16;

  ia = pos_indxA & 1;
  ib = ((pos_indxB & 1) << 1) << 16 >> 16;
  ic = ((pos_indxC & 1) << 2) << 16 >> 16;
  ib += ic;
  ib += ia;
  indx = (indx + ib) << 16 >> 16;
  return indx;
}

/** c8_31pf.cpp compress_code (static) */
function compress_code(sign_indx, pos_indx, indx, indxOff, pOverflow) {
  let ia, ib, ic;
  let tempWord32;

  for (let i = 0; i < NB_TRACK_MR102; i++) {
    indx[indxOff + i] = sign_indx[i];
  }

  indx[indxOff + NB_TRACK_MR102] = compress10(pos_indx[0], pos_indx[4], pos_indx[1], pOverflow);
  indx[indxOff + NB_TRACK_MR102 + 1] = compress10(pos_indx[2], pos_indx[6], pos_indx[5], pOverflow);

  /* Third index */
  ib = pos_indx[7] >> 1;
  ib &= 1;
  ia = pos_indx[3] >> 1;
  if (ib === 1) {
    ia = 4 - ia;
  }
  ib = pos_indx[7] >> 1;
  tempWord32 = (ib * 5) << 1;
  tempWord32 = tempWord32 >> 1;
  ib = (tempWord32 << 16) >> 16;
  ib += ia;
  ib <<= 5;
  ib += 12;
  ic = ((ib * 1311) >> 15) << 16 >> 16;
  ic <<= 2;
  ia = pos_indx[3] & 1;
  ib = ((pos_indx[7] & 1) << 1) << 16 >> 16;
  ib += ic;
  ib += ia;
  indx[indxOff + NB_TRACK_MR102 + 2] = ib;
}

const c831dn = new Int16Array(L_CODE);
const c831sign = new Int16Array(L_CODE);
const c831rr = new Int16Array(L_CODE * L_CODE);
const c831ipos = new Int16Array(NB_PULSE);
const c831posMax = new Int16Array(NB_TRACK_MR102);
const c831codvec = new Int16Array(NB_PULSE);
const c831linSigns = new Int16Array(NB_TRACK_MR102);
const c831linCode = new Int16Array(NB_PULSE);

/** c8_31pf.cpp code_8i40_31bits */
export function code_8i40_31bits(x, xOff, cn, cnOff, h, hOff,
  cod, codOff, y, yOff, indx, indxOff, pOverflow) {
  const dn = c831dn;
  const sign = c831sign;
  const rr = c831rr;
  const ipos = c831ipos;
  const pos_max = c831posMax;
  const codvec = c831codvec;
  const linear_signs = c831linSigns;
  const linear_codewords = c831linCode;

  cor_h_x2(h, hOff, x, xOff, dn, 0, 2, NB_TRACK_MR102, STEP_MR102, pOverflow);
  set_sign12k2(dn, 0, cn, cnOff, sign, 0, pos_max, 0, NB_TRACK_MR102, ipos, 0, STEP_MR102, pOverflow);
  cor_h(h, hOff, sign, rr, pOverflow);
  search_10and8i40(NB_PULSE, STEP_MR102, NB_TRACK_MR102, dn, rr, ipos, pos_max, codvec, pOverflow);
  build_code(codvec, sign, 0, cod, codOff, h, hOff, y, yOff,
    linear_signs, linear_codewords, pOverflow);
  compress_code(linear_signs, linear_codewords, indx, indxOff, pOverflow);
}
