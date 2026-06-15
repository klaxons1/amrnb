/*
 * Algebraic codebook search dispatcher, ported from opencore-amr 0.1.6
 * enc/src/cbsearch.cpp (cbsearch). Active implementation transcribed
 * line by line.
 */
import { mult, add_16, shl } from '../common/basicop.js';
import {
  L_SUBFR, MR475, MR515, MR59, MR67, MR74, MR795, MR102, MR122,
} from '../common/cnst.js';
import { startPos, gray } from '../common/tables/index.js';
import { code_2i40_9bits } from './c2_9pf.js';
import { code_2i40_11bits } from './c2_11pf.js';
import { code_3i40_14bits } from './c3_14pf.js';
import { code_4i40_17bits } from './c4_17pf.js';
import { code_8i40_31bits } from './c8_31pf.js';
import { code_10i40_35bits } from './c1035pf.js';

const cbIndex = new Int16Array(1);

/**
 * cbsearch.cpp cbsearch.
 * anap is a cursor object { arr, off } into the analysis-params array.
 */
export function cbsearch(x, xOff, h, hOff, T0, pitch_sharp, gain_pit,
  res2, res2Off, code, codeOff, y, yOff, anap, mode, subNr, pOverflow) {
  let temp;
  let pit_sharpTmp;

  if (mode === MR475 || mode === MR515) {
    anap.arr[anap.off++] = code_2i40_9bits(subNr, x, xOff, h, hOff, T0,
      pitch_sharp, code, codeOff, y, yOff, cbIndex, 0, startPos, pOverflow);
    anap.arr[anap.off++] = cbIndex[0]; /* sign index */
  } else if (mode === MR59) {
    anap.arr[anap.off++] = code_2i40_11bits(x, xOff, h, hOff, T0,
      pitch_sharp, code, codeOff, y, yOff, cbIndex, 0, pOverflow);
    anap.arr[anap.off++] = cbIndex[0];
  } else if (mode === MR67) {
    anap.arr[anap.off++] = code_3i40_14bits(x, xOff, h, hOff, T0,
      pitch_sharp, code, codeOff, y, yOff, cbIndex, 0, pOverflow);
    anap.arr[anap.off++] = cbIndex[0];
  } else if (mode === MR74 || mode === MR795) {
    anap.arr[anap.off++] = code_4i40_17bits(x, xOff, h, hOff, T0,
      pitch_sharp, code, codeOff, y, yOff, cbIndex, 0, gray, pOverflow);
    anap.arr[anap.off++] = cbIndex[0];
  } else if (mode === MR102) {
    /* include pitch contribution into impulse resp. h1[] */
    pit_sharpTmp = shl(pitch_sharp, 1, pOverflow);
    for (let i = T0; i < L_SUBFR; i++) {
      temp = mult(h[hOff + i - T0], pit_sharpTmp, pOverflow);
      h[hOff + i] = add_16(h[hOff + i], temp, pOverflow);
    }

    code_8i40_31bits(x, xOff, res2, res2Off, h, hOff, code, codeOff, y, yOff,
      anap.arr, anap.off, pOverflow);
    anap.off += 7;

    /* Add the pitch contribution to code[] */
    for (let i = T0; i < L_SUBFR; i++) {
      temp = mult(code[codeOff + i - T0], pit_sharpTmp, pOverflow);
      code[codeOff + i] = add_16(code[codeOff + i], temp, pOverflow);
    }
  } else {
    /* MR122 */
    pit_sharpTmp = shl(gain_pit, 1, pOverflow);
    for (let i = T0; i < L_SUBFR; i++) {
      temp = (h[hOff + i - T0] * pit_sharpTmp) >> 15;
      h[hOff + i] = add_16(h[hOff + i], temp, pOverflow);
    }

    code_10i40_35bits(x, xOff, res2, res2Off, h, hOff, code, codeOff, y, yOff,
      anap.arr, anap.off, gray, pOverflow);
    anap.off += 10;

    for (let i = T0; i < L_SUBFR; i++) {
      temp = mult(code[codeOff + i - T0], pit_sharpTmp, pOverflow);
      code[codeOff + i] = add_16(code[codeOff + i], temp, pOverflow);
    }
  }
}
