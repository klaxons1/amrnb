/*
 * Subframe pre/post processing, ported from opencore-amr 0.1.6 enc/src:
 *   spreproc.cpp (subframePreProc), spstproc.cpp (subframePostProc)
 * Active implementations transcribed line by line.
 */
import { M, MP1, L_SUBFR, SHARPMAX, MR122, MR102 } from '../common/cnst.js';
import { Weight_Ai, Residu, Syn_filt } from '../common/filters.js';

const ppAp1 = new Int16Array(MP1);
const ppAp2 = new Int16Array(MP1);

/** spreproc.cpp subframePreProc */
export function subframePreProc(mode, gamma1, gamma1_12k2, gamma2,
  A, AOff, Aq, AqOff, speech, speechOff, mem_err, mem_errOff, mem_w0, mem_w0Off,
  zero, zeroOff, ai_zero, ai_zeroOff, exc, excOff, h1, h1Off, xn, xnOff,
  res2, res2Off, error, errorOff) {
  const Ap1 = ppAp1;
  const Ap2 = ppAp2;
  let g1;

  if (mode === MR122 || mode === MR102) {
    g1 = gamma1_12k2;
  } else {
    g1 = gamma1;
  }

  Weight_Ai(A, AOff, g1, 0, Ap1, 0);
  Weight_Ai(A, AOff, gamma2, 0, Ap2, 0);

  for (let i = 0; i <= M; i++) ai_zero[ai_zeroOff + i] = Ap1[i];

  Syn_filt(Aq, AqOff, ai_zero, ai_zeroOff, h1, h1Off, L_SUBFR, zero, zeroOff, 0);
  Syn_filt(Ap2, 0, h1, h1Off, h1, h1Off, L_SUBFR, zero, zeroOff, 0);

  Residu(Aq, AqOff, speech, speechOff, res2, res2Off, L_SUBFR);
  for (let i = 0; i < L_SUBFR; i++) exc[excOff + i] = res2[res2Off + i];

  Syn_filt(Aq, AqOff, exc, excOff, error, errorOff, L_SUBFR, mem_err, mem_errOff, 0);
  Residu(Ap1, 0, error, errorOff, xn, xnOff, L_SUBFR);
  Syn_filt(Ap2, 0, xn, xnOff, xn, xnOff, L_SUBFR, mem_w0, mem_w0Off, 0);
}

/**
 * spstproc.cpp subframePostProc.
 * sharp is a 1-element Int16Array out.
 */
export function subframePostProc(speech, speechOff, mode, i_subfr, gain_pit,
  gain_code, Aq, AqOff, synth, synthOff, xn, xnOff, code, codeOff,
  y1, y1Off, y2, y2Off, mem_syn, mem_synOff, mem_err, mem_errOff,
  mem_w0, mem_w0Off, exc, excOff, sharp, pOverflow) {
  let temp;
  let L_temp, L_temp2;
  let tempShift, kShift, pitch_fac;

  if (mode !== MR122) {
    tempShift = 1;
    kShift = 16 - 2 - 1;
    pitch_fac = gain_pit;
  } else {
    tempShift = 2;
    kShift = 16 - 4 - 1;
    pitch_fac = gain_pit >> 1;
  }

  if (gain_pit < SHARPMAX) {
    sharp[0] = gain_pit;
  } else {
    sharp[0] = SHARPMAX;
  }

  /* Total excitation = gain_pit*exc + gain_code*code */
  let pExc = excOff + i_subfr;
  let pCode = codeOff;
  for (let i = L_SUBFR >> 1; i !== 0; i--) {
    L_temp = (exc[pExc++] * pitch_fac) << 1;
    L_temp2 = (exc[pExc--] * pitch_fac) << 1;
    L_temp = (L_temp + ((code[pCode++] * gain_code) << 1)) | 0;
    L_temp2 = (L_temp2 + ((code[pCode++] * gain_code) << 1)) | 0;
    L_temp = L_temp << tempShift;
    L_temp2 = L_temp2 << tempShift;
    exc[pExc++] = (((L_temp + 0x08000) | 0) >> 16) << 16 >> 16;
    exc[pExc++] = (((L_temp2 + 0x08000) | 0) >> 16) << 16 >> 16;
  }

  Syn_filt(Aq, AqOff, exc, excOff + i_subfr, synth, synthOff + i_subfr, L_SUBFR,
    mem_syn, mem_synOff, 1);

  for (let i = L_SUBFR - M, j = 0; i < L_SUBFR; i++, j++) {
    mem_err[mem_errOff + j] =
      (speech[speechOff + i_subfr + i] - synth[synthOff + i_subfr + i]) << 16 >> 16;

    L_temp = y1[y1Off + i] * gain_pit;
    temp = ((L_temp >> 14) << 16) >> 16;
    L_temp = y2[y2Off + i] * gain_code;
    temp = (temp + ((L_temp >> kShift) << 16 >> 16)) << 16 >> 16;
    mem_w0[mem_w0Off + j] = (xn[xnOff + i] - temp) << 16 >> 16;
  }
}
