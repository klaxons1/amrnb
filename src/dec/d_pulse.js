/*
 * Algebraic codebook pulse decoders, ported from opencore-amr 0.1.6 dec/src:
 *   d2_9pf.cpp (decode_2i40_9bits), d2_11pf.cpp (decode_2i40_11bits),
 *   d3_14pf.cpp (decode_3i40_14bits), d4_17pf.cpp (decode_4i40_17bits),
 *   d8_31pf.cpp (decompress10, decompress_code, dec_8i40_31bits),
 *   d1035pf.cpp (dec_10i40_35bits)
 * Active implementations transcribed line by line.
 */
import { mult, shl, add_16, negate, L_mult, L_shr } from '../common/basicop.js';
import { L_SUBFR, L_CODE, NB_TRACK, NB_TRACK_MR102 } from '../common/cnst.js';
import { startPos, dgray } from '../common/tables/index.js';

const POS_CODE = 8191;
const NEG_CODE = 8191;

/** d2_9pf.cpp decode_2i40_9bits */
export function decode_2i40_9bits(subNr, sign, index, cod, codOff, pOverflow) {
  const pos = new Int16Array(2);
  let i, j, k;

  /* Decode the positions; table bit is the MSB */
  j = (index & 64) << 16 >> 16;
  j >>= 3;
  i = index & 7;

  k = shl(subNr, 1, pOverflow);
  k = (k + j) << 16 >> 16;
  /* pos0 = i*5 + startPos[j*8 + subNr*2] */
  pos[0] = i * 5 + startPos[k++];

  index >>= 3;
  i = index & 7;
  /* pos1 = i*5 + startPos[j*8 + subNr*2 + 1] */
  pos[1] = i * 5 + startPos[k];

  /* decode the signs and build the codeword */
  for (i = L_SUBFR - 1; i >= 0; i--) {
    cod[codOff + i] = 0;
  }
  for (j = 0; j < 2; j++) {
    i = sign & 0x1;
    cod[codOff + pos[j]] = i * 16383 - 8192;
    sign >>= 1;
  }
}

/** d2_11pf.cpp decode_2i40_11bits */
export function decode_2i40_11bits(sign, index, cod, codOff) {
  const pos = new Int16Array(2);
  let i, j;

  /* Decode the positions */
  j = index & 0x1;
  index >>= 1;
  i = index & 0x7;
  pos[0] = i * 5 + j * 2 + 1;

  index >>= 3;
  j = index & 0x3;
  index >>= 2;
  i = index & 0x7;
  if (j === 3) {
    pos[1] = i * 5 + 4;
  } else {
    pos[1] = i * 5 + j;
  }

  /* decode the signs and build the codeword */
  for (i = 0; i < L_SUBFR; i++) {
    cod[codOff + i] = 0;
  }
  for (j = 0; j < 2; j++) {
    i = sign & 1;
    cod[codOff + pos[j]] = i * 16383 - 8192;
    sign >>= 1;
  }
}

/** d3_14pf.cpp decode_3i40_14bits */
export function decode_3i40_14bits(sign, index, cod, codOff) {
  const pos = new Int16Array(3);
  let i, j;

  /* Decode the positions */
  i = index & 0x7;
  pos[0] = i * 5;

  index >>= 3;
  j = index & 0x1;
  index >>= 1;
  i = index & 0x7;
  pos[1] = i * 5 + j * 2 + 1;

  index >>= 3;
  j = index & 0x1;
  index >>= 1;
  i = index & 0x7;
  pos[2] = i * 5 + j * 2 + 2;

  /* decode the signs and build the codeword */
  for (i = 0; i < L_SUBFR; i++) {
    cod[codOff + i] = 0;
  }
  for (j = 0; j < 3; j++) {
    i = sign & 1;
    cod[codOff + pos[j]] = i * 16383 - 8192;
    sign >>= 1;
  }
}

/** d4_17pf.cpp decode_4i40_17bits */
export function decode_4i40_17bits(sign, index, cod, codOff) {
  const pos = new Int16Array(4);
  let i, j;

  /* Decode the positions */
  i = index & 0x7;
  i = dgray[i];
  pos[0] = i * 5; /* pos0 = i*5 */

  index >>= 3;
  i = index & 0x7;
  i = dgray[i];
  pos[1] = i * 5 + 1; /* pos1 = i*5+1 */

  index >>= 3;
  i = index & 0x7;
  i = dgray[i];
  pos[2] = i * 5 + 2; /* pos2 = i*5+2 */

  index >>= 3;
  j = index & 0x1;
  index >>= 1;
  i = index & 0x7;
  i = dgray[i];
  pos[3] = i * 5 + 3 + j; /* pos3 = i*5+3+j */

  /* decode the signs and build the codeword */
  for (i = 0; i < L_SUBFR; i++) {
    cod[codOff + i] = 0;
  }
  for (j = 0; j < 4; j++) {
    i = sign & 0x1;
    cod[codOff + pos[j]] = i * 16383 - 8192;
    sign >>= 1;
  }
}

/** d8_31pf.cpp decompress10 (static) */
function decompress10(MSBs, LSBs, index1, index2, index3, pos_indx, pOverflow) {
  let ia, ib, ic;
  let tempWord32;

  if (MSBs > 124) {
    MSBs = 124;
  }
  ia = mult(MSBs, 1311, pOverflow);
  tempWord32 = L_mult(ia, 25, pOverflow);
  ia = ((MSBs - (tempWord32 >> 1)) << 16) >> 16;
  ib = mult(ia, 6554, pOverflow);
  tempWord32 = L_mult(ib, 5, pOverflow);
  ib = (ia - (((tempWord32 >> 1) << 16) >> 16)) << 16 >> 16;
  ib = shl(ib, 1, pOverflow);

  ic = (LSBs - ((LSBs >> 2) << 2)) << 16 >> 16;
  pos_indx[index1] = (ib + (ic & 1)) << 16 >> 16;

  ib = mult(ia, 6554, pOverflow);
  ib = shl(ib, 1, pOverflow);

  pos_indx[index2] = (ib + (ic >> 1)) << 16 >> 16;

  ib = LSBs >> 2;
  ic = mult(MSBs, 1311, pOverflow);
  ic = shl(ic, 1, pOverflow);
  pos_indx[index3] = add_16(ib, ic, pOverflow);
}

const dcSignIndx = new Int16Array(NB_TRACK_MR102);
const dcPosIndx = new Int16Array(8);

/** d8_31pf.cpp decompress_code (static) */
function decompress_code(indx, indxOff, sign_indx, pos_indx, pOverflow) {
  let ia, ib;
  let MSBs, LSBs, MSBs0_24;
  let tempWord32;

  for (let i = 0; i < NB_TRACK_MR102; i++) {
    sign_indx[i] = indx[indxOff + i];
  }

  /* First index: 7+1x3 bits */
  MSBs = indx[indxOff + NB_TRACK_MR102] >> 3;
  LSBs = indx[indxOff + NB_TRACK_MR102] & 0x7;
  decompress10(MSBs, LSBs, 0, 4, 1, pos_indx, pOverflow);

  /* Second index: 7+1x3 bits */
  MSBs = indx[indxOff + NB_TRACK_MR102 + 1] >> 3;
  LSBs = indx[indxOff + NB_TRACK_MR102 + 1] & 0x7;
  decompress10(MSBs, LSBs, 2, 6, 5, pos_indx, pOverflow);

  /* Third index: 5+1x2 bits */
  MSBs = indx[indxOff + NB_TRACK_MR102 + 2] >> 2;
  LSBs = indx[indxOff + NB_TRACK_MR102 + 2] & 0x3;
  tempWord32 = L_mult(MSBs, 25, pOverflow);
  ia = (L_shr(tempWord32, 1, pOverflow) << 16) >> 16;
  ia = (ia + 12) << 16 >> 16;
  MSBs0_24 = ia >> 5;

  ia = mult(MSBs0_24, 6554, pOverflow);
  ia &= 1;

  ib = mult(MSBs0_24, 6554, pOverflow);
  tempWord32 = L_mult(ib, 5, pOverflow);
  ib = (MSBs0_24 - (((tempWord32 >> 1) << 16) >> 16)) << 16 >> 16;

  if (ia === 1) {
    ib = (4 - ib) << 16 >> 16;
  }
  ib = shl(ib, 1, pOverflow);

  ia = LSBs & 0x1;
  pos_indx[3] = add_16(ib, ia, pOverflow);

  ia = mult(MSBs0_24, 6554, pOverflow);
  ia = shl(ia, 1, pOverflow);
  pos_indx[7] = (ia + (LSBs >> 1)) << 16 >> 16;
}

/** d8_31pf.cpp dec_8i40_31bits (MR102) */
export function dec_8i40_31bits(index, indexOff, cod, codOff, pOverflow) {
  let pos1, pos2, sign;
  const linear_signs = dcSignIndx;
  const linear_codewords = dcPosIndx;

  for (let i = 0; i < L_CODE; i++) {
    cod[codOff + i] = 0;
  }

  decompress_code(index, indexOff, linear_signs, linear_codewords, pOverflow);

  /* decode the positions and signs of pulses and build the codeword */
  for (let j = 0; j < NB_TRACK_MR102; j++) {
    /* position of pulse "j" */
    pos1 = ((linear_codewords[j] << 2) + j) << 16 >> 16;
    if (linear_signs[j] === 0) {
      sign = POS_CODE; /* +1.0 */
    } else {
      sign = -NEG_CODE; /* -1.0 */
    }

    if (pos1 < L_SUBFR) {
      cod[codOff + pos1] = sign; /* avoid buffer overflow */
    }

    /* position of pulse "j+4" */
    pos2 = ((linear_codewords[j + 4] << 2) + j) << 16 >> 16;
    if (pos2 < pos1) {
      sign = negate(sign);
    }
    if (pos2 < L_SUBFR) {
      cod[codOff + pos2] = (cod[codOff + pos2] + sign) << 16 >> 16; /* += */
    }
  }
}

/** d1035pf.cpp dec_10i40_35bits (MR122) */
export function dec_10i40_35bits(index, indexOff, cod, codOff) {
  let pos1, pos2, sign, tmp, i;

  for (i = 0; i < L_CODE; i++) {
    cod[codOff + i] = 0;
  }

  /* decode the positions and signs of pulses and build the codeword */
  for (let j = 0; j < NB_TRACK; j++) {
    /* compute index i */
    tmp = index[indexOff + j];
    i = tmp & 7;
    i = dgray[i];
    i = (i * 5) << 16 >> 16;
    pos1 = (i + j) << 16 >> 16; /* position of pulse "j" */

    i = (tmp >> 3) & 1;
    sign = i === 0 ? 4096 : -4096;

    cod[codOff + pos1] = sign;

    /* compute index i for pulse "j+5" */
    i = index[indexOff + j + 5] & 7;
    i = dgray[i];
    i = (i * 5) << 16 >> 16;
    pos2 = (i + j) << 16 >> 16;

    if (pos2 < pos1) {
      sign = negate(sign);
    }
    cod[codOff + pos2] = (cod[codOff + pos2] + sign) << 16 >> 16; /* += */
  }
}
