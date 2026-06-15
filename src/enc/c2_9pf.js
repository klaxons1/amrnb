/*
 * 9-bit / 2-pulse algebraic codebook (MR475, MR515), ported from
 * opencore-amr 0.1.6 enc/src/c2_9pf.cpp (search_2i40, build_code,
 * code_2i40_9bits). Active implementations transcribed line by line.
 */
import {
  MAX_16, MIN_16, mult, add_16, pv_round, L_mult, L_mac,
} from '../common/basicop.js';
import { L_CODE, STEP } from '../common/cnst.js';
import { cor_h, cor_h_x, set_sign } from './cor.js';

const NB_PULSE = 2;

const trackTable = Int16Array.from([
  0, 1, 0, 1, -1, /* subframe 1 */
  0, -1, 1, 0, 1, /* subframe 2 */
  0, 1, 0, -1, 1, /* subframe 3 */
  0, 1, -1, 0, 1, /* subframe 4 */
]);

const codvec = new Int16Array(NB_PULSE);
const ipos = new Int16Array(NB_PULSE);
const cSign = new Int16Array(NB_PULSE);

/** c2_9pf.cpp search_2i40 (static); rr is flat L_CODE*L_CODE */
function search_2i40(subNr, dn, rr, startPos_ptr, codvecOut, pOverflow) {
  let ix = 0;
  let ps0, ps1, sq, sq1, alp, alp_16;
  let s, alp0, alp1;
  let L_temp;
  let psk, alpk;

  psk = -1;
  alpk = 1;

  codvecOut[0] = 0;
  codvecOut[1] = 1;

  for (let track1 = 0; track1 < 2; track1++) {
    /* fix starting position */
    const i = (subNr << 1) + (track1 << 3);
    ipos[0] = startPos_ptr[i];
    ipos[1] = startPos_ptr[i + 1];

    /* i0 loop: try 8 positions */
    for (let i0 = ipos[0]; i0 < L_CODE; i0 += STEP) {
      ps0 = dn[i0];
      alp0 = rr[i0 * L_CODE + i0] << 14;

      sq = -1;
      alp = 1;
      ix = ipos[1];

      for (let i1 = ipos[1]; i1 < L_CODE; i1 += STEP) {
        ps1 = (ps0 + dn[i1]) << 16 >> 16;
        alp1 = (alp0 + (rr[i1 * L_CODE + i1] << 14)) | 0;
        alp1 = (alp1 + (rr[i0 * L_CODE + i1] << 15)) | 0;
        sq1 = ((ps1 * ps1) >> 15) << 16 >> 16;
        alp_16 = (((alp1 + 0x00008000) | 0) >> 16) << 16 >> 16;
        L_temp = (alp * sq1) << 1;
        s = (L_temp - ((sq * alp_16) << 1)) | 0;
        if (s > 0) {
          sq = sq1;
          alp = alp_16;
          ix = i1;
        }
      }

      /* memorize codevector if better than the last one */
      L_temp = (alpk * sq) << 1;
      s = (L_temp - ((psk * alp) << 1)) | 0;
      if (s > 0) {
        psk = sq;
        alpk = alp;
        codvecOut[0] = i0;
        codvecOut[1] = ix;
      }
    }
  }
}

/** c2_9pf.cpp build_code (static): returns codebook index */
function build_code(subNr, codvecIn, dn_sign, cod, codOff, h, hOff, y, yOff, sign, signOff, pOverflow) {
  let i, j;
  let track, first, index;
  let rsign;
  let indx;
  let s;

  const pt = subNr + (subNr << 2); /* trackTable + subNr*5 */

  for (i = 0; i < L_CODE; i++) {
    cod[codOff + i] = 0;
  }

  indx = 0;
  rsign = 0;
  for (let k = 0; k < NB_PULSE; k++) {
    i = codvecIn[k];      /* read pulse position */
    j = dn_sign[i];       /* read sign */
    s = (i * 6554) >> 15;
    index = (s << 16) >> 16; /* index = pos/5 */
    track = (i - 5 * index) << 16 >> 16; /* track = pos%5 */
    first = trackTable[pt + track];

    if (k === 0) {
      track = 0;
      if (first !== 0) {
        index += 64; /* table bit is MSB */
      }
    } else {
      track = 1;
      index <<= 3;
    }

    if (j > 0) {
      cod[codOff + i] = 8191;
      cSign[k] = 32767;
      rsign += 1 << track;
    } else {
      cod[codOff + i] = -8192;
      cSign[k] = -32768;
    }

    indx += index;
  }
  sign[signOff] = rsign;

  let p0 = hOff - codvecIn[0];
  let p1 = hOff - codvecIn[1];
  for (i = 0; i < L_CODE; i++) {
    s = 0;
    s = L_mult(h[p0++], cSign[0], pOverflow);
    s = L_mac(s, h[p1++], cSign[1], pOverflow);
    y[yOff + i] = pv_round(s, pOverflow);
  }

  return indx;
}

const c29dn = new Int16Array(L_CODE);
const c29dn2 = new Int16Array(L_CODE);
const c29dnSign = new Int16Array(L_CODE);
const c29rr = new Int16Array(L_CODE * L_CODE);

/**
 * c2_9pf.cpp code_2i40_9bits.
 * @param {Int16Array} sign 1-element out; returns code index.
 */
export function code_2i40_9bits(subNr, x, xOff, h, hOff, T0, pitch_sharp,
  code, codeOff, y, yOff, sign, signOff, startPos_ptr, pOverflow) {
  const dn = c29dn;
  const dn2 = c29dn2;
  const dn_sign = c29dnSign;
  const rr = c29rr;
  let index;
  let sharp;
  let temp;
  let L_temp;

  L_temp = pitch_sharp << 1;
  if (L_temp !== ((L_temp << 16) >> 16)) {
    pOverflow[0] = 1;
    sharp = pitch_sharp > 0 ? MAX_16 : MIN_16;
  } else {
    sharp = (L_temp << 16) >> 16;
  }

  if (T0 < L_CODE) {
    for (let i = T0; i < L_CODE; i++) {
      temp = mult(h[hOff + i - T0], sharp, pOverflow);
      h[hOff + i] = add_16(h[hOff + i], temp, pOverflow);
    }
  }

  cor_h_x(h, hOff, x, xOff, dn, 0, 1, pOverflow);
  /* dn2[] not used in this codebook search */
  set_sign(dn, 0, dn_sign, 0, dn2, 0, 8);
  cor_h(h, hOff, dn_sign, rr, pOverflow);
  search_2i40(subNr, dn, rr, startPos_ptr, codvec, pOverflow);
  index = build_code(subNr, codvec, dn_sign, code, codeOff, h, hOff,
    y, yOff, sign, signOff, pOverflow);

  /* Include fixed-gain pitch contribution into code[] */
  if (T0 < L_CODE) {
    for (let i = T0; i < L_CODE; i++) {
      temp = mult(code[codeOff + i - T0], sharp, pOverflow);
      code[codeOff + i] = add_16(code[codeOff + i], temp, pOverflow);
    }
  }

  return index;
}
