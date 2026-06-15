/*
 * 35-bit / 10-pulse algebraic codebook (MR122), ported from opencore-amr
 * 0.1.6 enc/src/c1035pf.cpp (q_p, build_code, code_10i40_35bits).
 * Active implementations transcribed line by line.
 */
import { L_CODE, NB_TRACK, STEP } from '../common/cnst.js';
import { cor_h, cor_h_x, set_sign12k2 } from './cor.js';
import { search_10and8i40 } from './s10_8pf.js';

const NB_PULSE = 10;

/** c1035pf.cpp q_p (static): Gray-code a pulse position index */
function q_p(indx, pInd, n, gray_ptr) {
  const tmp = indx[pInd];
  if (n < 5) {
    indx[pInd] = (tmp & 0x8) | gray_ptr[tmp & 0x7];
  } else {
    indx[pInd] = gray_ptr[tmp & 0x7];
  }
}

const bcSign = new Int16Array(NB_PULSE);

/** c1035pf.cpp build_code (static) */
function build_code(codvec, sign, signOff, cod, codOff, h, hOff, y, yOff, indx, indxOff, pOverflow) {
  let i, track, index;
  const _sign = bcSign;
  let s;
  let temp;

  for (i = 0; i < L_CODE; i++) cod[codOff + i] = 0;
  for (i = 0; i < NB_TRACK; i++) indx[indxOff + i] = -1; /* memset 0xFF */

  let p0v = 0;
  for (let k = 0; k < NB_PULSE; k++) {
    i = codvec[p0v++];
    index = (i * 6554) >> 15; /* index = pos/5 */
    track = (i - (index + (index << 2))) << 16 >> 16;

    if (sign[signOff + i] > 0) {
      cod[codOff + i] = (cod[codOff + i] + 4096) << 16 >> 16;
      _sign[k] = 8192;
    } else {
      cod[codOff + i] = (cod[codOff + i] - 4096) << 16 >> 16;
      _sign[k] = -8192;
      index += 8;
    }

    const p1 = indxOff + track;
    temp = indx[p1];
    if (temp < 0) {
      indx[p1] = index;
    } else if (((index ^ temp) & 8) === 0) {
      if (temp <= index) {
        indx[p1 + 5] = index;
      } else {
        indx[p1 + 5] = temp;
        indx[p1] = index;
      }
    } else if ((temp & 7) <= (index & 7)) {
      indx[p1 + 5] = temp;
      indx[p1] = index;
    } else {
      indx[p1 + 5] = index;
    }
  }

  const p = new Array(NB_PULSE);
  for (let k = 0; k < NB_PULSE; k++) {
    p[k] = hOff - codvec[k];
  }
  let pY = yOff;
  for (i = L_CODE; i !== 0; i--) {
    s = 0;
    for (let k = 0; k < NB_PULSE; k++) {
      s = (s + ((h[p[k]++] * _sign[k]) >> 7)) | 0;
    }
    y[pY++] = ((s + 0x080) | 0) >> 8;
  }
}

const c1035dn = new Int16Array(L_CODE);
const c1035sign = new Int16Array(L_CODE);
const c1035rr = new Int16Array(L_CODE * L_CODE);
const c1035ipos = new Int16Array(NB_PULSE);
const c1035posMax = new Int16Array(NB_TRACK);
const c1035codvec = new Int16Array(NB_PULSE);

/** c1035pf.cpp code_10i40_35bits */
export function code_10i40_35bits(x, xOff, cn, cnOff, h, hOff,
  cod, codOff, y, yOff, indx, indxOff, gray_ptr, pOverflow) {
  const dn = c1035dn;
  const sign = c1035sign;
  const rr = c1035rr;
  const ipos = c1035ipos;
  const pos_max = c1035posMax;
  const codvec = c1035codvec;

  cor_h_x(h, hOff, x, xOff, dn, 0, 2, pOverflow);
  set_sign12k2(dn, 0, cn, cnOff, sign, 0, pos_max, 0, NB_TRACK, ipos, 0, STEP, pOverflow);
  cor_h(h, hOff, sign, rr, pOverflow);
  search_10and8i40(NB_PULSE, STEP, NB_TRACK, dn, rr, ipos, pos_max, codvec, pOverflow);
  build_code(codvec, sign, 0, cod, codOff, h, hOff, y, yOff, indx, indxOff, pOverflow);

  for (let i = 0; i < 10; i++) {
    q_p(indx, indxOff + i, i, gray_ptr);
  }
}
