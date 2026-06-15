/*
 * 11-bit / 2-pulse algebraic codebook (MR59), ported from opencore-amr 0.1.6
 * enc/src/c2_11pf.cpp (search_2i40, build_code, code_2i40_11bits).
 * Active implementations transcribed line by line.
 */
import {
  mult, add_16, shl, pv_round, L_mac,
} from '../common/basicop.js';
import { L_CODE, STEP } from '../common/cnst.js';
import { cor_h, cor_h_x, set_sign } from './cor.js';

const NB_PULSE = 2;
const startPos1 = Int16Array.from([1, 3]);
const startPos2 = Int16Array.from([0, 1, 2, 4]);

const codvec = new Int16Array(NB_PULSE);
const ipos = new Int16Array(NB_PULSE);
const cSign = new Int16Array(NB_PULSE);

/** c2_11pf.cpp search_2i40 (static) */
function search_2i40(dn, rr, codvecOut, pOverflow) {
  let ix = 0;
  let ps0, ps1, sq, sq1, alp, alp_16;
  let s, alp0, alp1;
  let psk, alpk;

  psk = -1;
  alpk = 1;
  codvecOut[0] = 0;
  codvecOut[1] = 1;

  for (let track1 = 0; track1 < 2; track1++) {
    for (let track2 = 0; track2 < 4; track2++) {
      ipos[0] = startPos1[track1];
      ipos[1] = startPos2[track2];

      for (let i0 = ipos[0]; i0 < L_CODE; i0 += STEP) {
        ps0 = dn[i0];
        alp0 = rr[i0 * L_CODE + i0] << 14;

        sq = -1;
        alp = 1;
        ix = ipos[1];

        for (let i1 = ipos[1]; i1 < L_CODE; i1 += STEP) {
          ps1 = add_16(ps0, dn[i1], pOverflow);
          alp1 = (alp0 + (rr[i1 * L_CODE + i1] << 14)) | 0;
          alp1 = (alp1 + (rr[i0 * L_CODE + i1] << 15)) | 0;
          sq1 = ((ps1 * ps1) >> 15) << 16 >> 16;
          alp_16 = (((alp1 + 0x00008000) | 0) >> 16) << 16 >> 16;
          s = (alp * sq1) << 1;
          s = (s - ((sq * alp_16) << 1)) | 0;
          if (s > 0) {
            sq = sq1;
            alp = alp_16;
            ix = i1;
          }
        }

        s = (alpk * sq) << 1;
        s = (s - ((psk * alp) << 1)) | 0;
        if (s > 0) {
          psk = sq;
          alpk = alp;
          codvecOut[0] = i0;
          codvecOut[1] = ix;
        }
      }
    }
  }
}

/** c2_11pf.cpp build_code (static): returns codebook index */
function build_code(codvecIn, dn_sign, cod, codOff, h, hOff, y, yOff, sign, signOff, pOverflow) {
  let i, j;
  let track, index;
  let indx, rsign;
  let tempWord;
  let s;

  for (i = 0; i < L_CODE; i++) {
    cod[codOff + i] = 0;
  }
  indx = 0;
  rsign = 0;

  for (let k = 0; k < NB_PULSE; k++) {
    i = codvecIn[k];   /* read pulse position */
    j = dn_sign[i];    /* read sign */

    index = ((i * 6554) >> 15) << 16 >> 16; /* index = pos/5 */
    tempWord = ((index << 3) + (index << 1)) << 16 >> 16;
    tempWord >>= 1;
    track = (i - tempWord) << 16 >> 16; /* track = pos%5 */
    tempWord = track;

    if (tempWord === 0) {
      track = 1;
      index <<= 6;
    } else if (track === 1) {
      tempWord = k;
      if (tempWord === 0) {
        track = 0;
        index <<= 1;
      } else {
        track = 1;
        tempWord = index << 6;
        index = (tempWord + 16) << 16 >> 16;
      }
    } else if (track === 2) {
      track = 1;
      tempWord = index << 6;
      index = (tempWord + 32) << 16 >> 16;
    } else if (track === 3) {
      track = 0;
      tempWord = index << 1;
      index = (tempWord + 1) << 16 >> 16;
    } else if (track === 4) {
      track = 1;
      tempWord = index << 6;
      index = (tempWord + 48) << 16 >> 16;
    }

    if (j > 0) {
      cod[codOff + i] = 8191;
      cSign[k] = 32767;
      tempWord = shl(1, track, pOverflow);
      rsign = add_16(rsign, tempWord, pOverflow);
    } else {
      cod[codOff + i] = -8192;
      cSign[k] = -32768;
    }

    indx = add_16(indx, index, pOverflow);
  }
  sign[signOff] = rsign;

  let p0 = hOff - codvecIn[0];
  let p1 = hOff - codvecIn[1];
  for (i = 0; i < L_CODE; i++) {
    s = 0;
    s = L_mac(s, h[p0++], cSign[0], pOverflow);
    s = L_mac(s, h[p1++], cSign[1], pOverflow);
    y[yOff + i] = pv_round(s, pOverflow);
  }

  return indx;
}

const c211dn = new Int16Array(L_CODE);
const c211dn2 = new Int16Array(L_CODE);
const c211dnSign = new Int16Array(L_CODE);
const c211rr = new Int16Array(L_CODE * L_CODE);

/**
 * c2_11pf.cpp code_2i40_11bits.
 * @param {Int16Array} sign 1-element out; returns code index.
 */
export function code_2i40_11bits(x, xOff, h, hOff, T0, pitch_sharp,
  code, codeOff, y, yOff, sign, signOff, pOverflow) {
  const dn = c211dn;
  const dn2 = c211dn2;
  const dn_sign = c211dnSign;
  const rr = c211rr;
  let index;
  let tempWord;

  const sharp = (pitch_sharp << 1) << 16 >> 16;

  if (T0 < L_CODE) {
    for (let i = T0; i < L_CODE; i++) {
      tempWord = mult(h[hOff + i - T0], sharp, pOverflow);
      h[hOff + i] = add_16(h[hOff + i], tempWord, pOverflow);
    }
  }

  cor_h_x(h, hOff, x, xOff, dn, 0, 1, pOverflow);
  set_sign(dn, 0, dn_sign, 0, dn2, 0, 8);
  cor_h(h, hOff, dn_sign, rr, pOverflow);
  search_2i40(dn, rr, codvec, pOverflow);
  index = build_code(codvec, dn_sign, code, codeOff, h, hOff, y, yOff,
    sign, signOff, pOverflow);

  if (T0 < L_CODE) {
    for (let i = T0; i < L_CODE; i++) {
      tempWord = mult(code[codeOff + i - T0], sharp, pOverflow);
      code[codeOff + i] = add_16(code[codeOff + i], tempWord, pOverflow);
    }
  }

  return index;
}
