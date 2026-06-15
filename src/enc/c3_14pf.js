/*
 * 14-bit / 3-pulse algebraic codebook (MR67), ported from opencore-amr 0.1.6
 * enc/src/c3_14pf.cpp (search_3i40, build_code, code_3i40_14bits).
 * Active implementations transcribed line by line.
 */
import {
  mult, add_16, pv_round, L_mult, L_mac, L_msu,
} from '../common/basicop.js';
import { L_CODE, STEP } from '../common/cnst.js';
import { cor_h, cor_h_x, set_sign } from './cor.js';

const NB_PULSE = 3;

const codvec = new Int16Array(NB_PULSE);
const ipos = new Int16Array(NB_PULSE);
const cSign = new Int16Array(NB_PULSE);

/** c3_14pf.cpp search_3i40 (static) */
function search_3i40(dn, dn2, rr, codvecOut, pOverflow) {
  let i0, i1, i2;
  let ix = 0;
  let ps = 0;
  let pos;
  let psk, ps0, ps1, sq, sq1;
  let alpk, alp, alp_16;
  let s, alp0, alp1;

  psk = -1;
  alpk = 1;
  for (let i = 0; i < NB_PULSE; i++) {
    codvecOut[i] = i;
  }

  for (let track1 = 1; track1 < 4; track1 += 2) {
    for (let track2 = 2; track2 < 5; track2 += 2) {
      ipos[0] = 0;
      ipos[1] = track1;
      ipos[2] = track2;

      for (let i = 0; i < NB_PULSE; i++) {
        for (i0 = ipos[0]; i0 < L_CODE; i0 += STEP) {
          if (dn2[i0] >= 0) {
            ps0 = dn[i0];
            alp0 = rr[i0 * L_CODE + i0] << 14;

            sq = -1;
            alp = 1;
            ps = 0;
            ix = ipos[1];

            for (i1 = ipos[1]; i1 < L_CODE; i1 += STEP) {
              ps1 = (ps0 + dn[i1]) << 16 >> 16;
              alp1 = (alp0 + (rr[i1 * L_CODE + i1] << 14)) | 0;
              alp1 = (alp1 + (rr[i0 * L_CODE + i1] << 15)) | 0;
              sq1 = ((ps1 * ps1) >> 15) << 16 >> 16;
              alp_16 = (((alp1 + 0x00008000) | 0) >> 16) << 16 >> 16;
              s = (alp * sq1) << 1;
              s = (s - ((sq * alp_16) << 1)) | 0;
              if (s > 0) {
                sq = sq1;
                ps = ps1;
                alp = alp_16;
                ix = i1;
              }
            }
            i1 = ix;

            ps0 = ps;
            alp0 = alp << 14;
            sq = -1;
            alp = 1;
            ps = 0;
            ix = ipos[2];

            for (i2 = ipos[2]; i2 < L_CODE; i2 += STEP) {
              ps1 = (ps0 + dn[i2]) << 16 >> 16;
              alp1 = (alp0 + (rr[i2 * L_CODE + i2] << 12)) | 0;
              alp1 = (alp1 + (rr[i1 * L_CODE + i2] << 13)) | 0;
              alp1 = (alp1 + (rr[i0 * L_CODE + i2] << 13)) | 0;
              sq1 = ((ps1 * ps1) >> 15) << 16 >> 16;
              alp_16 = (((alp1 + 0x00008000) | 0) >> 16) << 16 >> 16;
              s = (alp * sq1) << 1;
              s = (s - ((sq * alp_16) << 1)) | 0;
              if (s > 0) {
                sq = sq1;
                ps = ps1;
                alp = alp_16;
                ix = i2;
              }
            }
            i2 = ix;

            s = L_mult(alpk, sq, pOverflow);
            s = L_msu(s, psk, alp, pOverflow);
            if (s > 0) {
              psk = sq;
              alpk = alp;
              codvecOut[0] = i0;
              codvecOut[1] = i1;
              codvecOut[2] = i2;
            }
          }
        }

        pos = ipos[2];
        ipos[2] = ipos[1];
        ipos[1] = ipos[0];
        ipos[0] = pos;
      }
    }
  }
}

/** c3_14pf.cpp build_code (static): returns codebook index */
function build_code(codvecIn, dn_sign, cod, codOff, h, hOff, y, yOff, sign, signOff, pOverflow) {
  let i, j;
  let track, index;
  let indx, rsign;
  let s;

  for (i = 0; i < L_CODE; i++) {
    cod[codOff + i] = 0;
  }
  indx = 0;
  rsign = 0;

  for (let k = 0; k < NB_PULSE; k++) {
    i = codvecIn[k];   /* read pulse position */
    j = dn_sign[i];    /* read sign */

    index = ((i * 6554) >> 15) << 16 >> 16;
    s = (index * 5) << 1;
    s >>= 1;
    track = (i - ((s << 16) >> 16)) << 16 >> 16;

    if (track === 1) {
      index <<= 4;
    } else if (track === 2) {
      track = 2;
      index <<= 8;
    } else if (track === 3) {
      track = 1;
      index <<= 4;
      index += 8;
    } else if (track === 4) {
      track = 2;
      index <<= 8;
      index += 128;
    }

    if (j > 0) {
      cod[codOff + i] = 8191;
      cSign[k] = 32767;
      track = (1 << track) << 16 >> 16;
      rsign += track;
    } else {
      cod[codOff + i] = -8192;
      cSign[k] = -32768;
    }

    indx += index;
  }
  sign[signOff] = rsign;

  let p0 = hOff - codvecIn[0];
  let p1 = hOff - codvecIn[1];
  let p2 = hOff - codvecIn[2];
  for (i = 0; i < L_CODE; i++) {
    s = 0;
    s = L_mac(s, h[p0++], cSign[0], pOverflow);
    s = L_mac(s, h[p1++], cSign[1], pOverflow);
    s = L_mac(s, h[p2++], cSign[2], pOverflow);
    y[yOff + i] = pv_round(s, pOverflow);
  }

  return indx;
}

const c314dn = new Int16Array(L_CODE);
const c314dn2 = new Int16Array(L_CODE);
const c314dnSign = new Int16Array(L_CODE);
const c314rr = new Int16Array(L_CODE * L_CODE);

/**
 * c3_14pf.cpp code_3i40_14bits.
 * @param {Int16Array} sign 1-element out; returns code index.
 */
export function code_3i40_14bits(x, xOff, h, hOff, T0, pitch_sharp,
  code, codeOff, y, yOff, sign, signOff, pOverflow) {
  const dn = c314dn;
  const dn2 = c314dn2;
  const dn_sign = c314dnSign;
  const rr = c314rr;
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
  set_sign(dn, 0, dn_sign, 0, dn2, 0, 6);
  cor_h(h, hOff, dn_sign, rr, pOverflow);
  search_3i40(dn, dn2, rr, codvec, pOverflow);
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
