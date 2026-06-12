/*
 * LPC interpolation, ported from opencore-amr 0.1.6 common/src/int_lpc.cpp.
 * Active implementations transcribed line by line.
 */
import { M, MP1 } from './cnst.js';
import { Lsp_Az } from './lsp_fns.js';

const lspTmp = new Int16Array(M);

/** int_lpc.cpp Int_lpc_1and3: Az[AZ_SIZE] for all 4 subframes */
export function Int_lpc_1and3(lsp_old, lsp_oldOff, lsp_mid, lsp_midOff,
  lsp_new, lsp_newOff, Az, AzOff, pOverflow) {
  const lsp = lspTmp;

  /* lsp[i] = lsp_mid[i] * 0.5 + lsp_old[i] * 0.5 */
  for (let i = 0; i < M; i++) {
    lsp[i] = (lsp_old[lsp_oldOff + i] >> 1) + (lsp_mid[lsp_midOff + i] >> 1);
  }

  Lsp_Az(lsp, 0, Az, AzOff, pOverflow); /* Subframe 1 */
  Lsp_Az(lsp_mid, lsp_midOff, Az, AzOff + MP1, pOverflow); /* Subframe 2 */

  for (let i = 0; i < M; i++) {
    lsp[i] = (lsp_mid[lsp_midOff + i] >> 1) + (lsp_new[lsp_newOff + i] >> 1);
  }

  Lsp_Az(lsp, 0, Az, AzOff + 2 * MP1, pOverflow); /* Subframe 3 */
  Lsp_Az(lsp_new, lsp_newOff, Az, AzOff + 3 * MP1, pOverflow); /* Subframe 4 */
}

/** int_lpc.cpp Int_lpc_1and3_2: only subframes 1 and 3 (2,4 already known) */
export function Int_lpc_1and3_2(lsp_old, lsp_oldOff, lsp_mid, lsp_midOff,
  lsp_new, lsp_newOff, Az, AzOff, pOverflow) {
  const lsp = lspTmp;

  for (let i = 0; i < M; i++) {
    lsp[i] = (lsp_old[lsp_oldOff + i] >> 1) + (lsp_mid[lsp_midOff + i] >> 1);
  }
  Lsp_Az(lsp, 0, Az, AzOff, pOverflow); /* Subframe 1 */

  for (let i = 0; i < M; i++) {
    lsp[i] = (lsp_mid[lsp_midOff + i] >> 1) + (lsp_new[lsp_newOff + i] >> 1);
  }
  Lsp_Az(lsp, 0, Az, AzOff + 2 * MP1, pOverflow); /* Subframe 3 */
}

/** int_lpc.cpp Int_lpc_1to3: Az[AZ_SIZE] for all 4 subframes */
export function Int_lpc_1to3(lsp_old, lsp_oldOff, lsp_new, lsp_newOff,
  Az, AzOff, pOverflow) {
  const lsp = lspTmp;
  let temp;

  for (let i = 0; i < M; i++) {
    temp = (lsp_old[lsp_oldOff + i] - (lsp_old[lsp_oldOff + i] >> 2)) << 16 >> 16;
    lsp[i] = temp + (lsp_new[lsp_newOff + i] >> 2);
  }
  Lsp_Az(lsp, 0, Az, AzOff, pOverflow); /* Subframe 1 */

  for (let i = 0; i < M; i++) {
    lsp[i] = (lsp_new[lsp_newOff + i] >> 1) + (lsp_old[lsp_oldOff + i] >> 1);
  }
  Lsp_Az(lsp, 0, Az, AzOff + MP1, pOverflow); /* Subframe 2 */

  for (let i = 0; i < M; i++) {
    temp = (lsp_new[lsp_newOff + i] - (lsp_new[lsp_newOff + i] >> 2)) << 16 >> 16;
    lsp[i] = temp + (lsp_old[lsp_oldOff + i] >> 2);
  }
  Lsp_Az(lsp, 0, Az, AzOff + 2 * MP1, pOverflow); /* Subframe 3 */

  Lsp_Az(lsp_new, lsp_newOff, Az, AzOff + 3 * MP1, pOverflow); /* Subframe 4 */
}

/** int_lpc.cpp Int_lpc_1to3_2: only subframes 1, 2, 3 (4 already known) */
export function Int_lpc_1to3_2(lsp_old, lsp_oldOff, lsp_new, lsp_newOff,
  Az, AzOff, pOverflow) {
  const lsp = lspTmp;
  let temp;

  for (let i = 0; i < M; i++) {
    temp = (lsp_old[lsp_oldOff + i] - (lsp_old[lsp_oldOff + i] >> 2)) << 16 >> 16;
    lsp[i] = temp + (lsp_new[lsp_newOff + i] >> 2);
  }
  Lsp_Az(lsp, 0, Az, AzOff, pOverflow); /* Subframe 1 */

  for (let i = 0; i < M; i++) {
    lsp[i] = (lsp_new[lsp_newOff + i] >> 1) + (lsp_old[lsp_oldOff + i] >> 1);
  }
  Lsp_Az(lsp, 0, Az, AzOff + MP1, pOverflow); /* Subframe 2 */

  for (let i = 0; i < M; i++) {
    temp = (lsp_new[lsp_newOff + i] - (lsp_new[lsp_newOff + i] >> 2)) << 16 >> 16;
    lsp[i] = temp + (lsp_old[lsp_oldOff + i] >> 2);
  }
  Lsp_Az(lsp, 0, Az, AzOff + 2 * MP1, pOverflow); /* Subframe 3 */
}

/** lsfwt.cpp Lsf_wt (pOverflow intentionally unused) */
export function Lsf_wt(lsf, lsfOff, wf, wfOff, pOverflow) {
  let temp;
  let wgt_fct;
  let pWf = wfOff;
  let pLsf = lsfOff;
  let pLsf2 = lsfOff + 1;

  /* wf[0] = lsf[1] - 0 */
  wf[pWf++] = lsf[pLsf2++];
  for (let i = 4; i !== 0; i--) {
    wf[pWf++] = lsf[pLsf2++] - lsf[pLsf++];
    wf[pWf++] = lsf[pLsf2++] - lsf[pLsf++];
  }
  /* wf[9] = 4000 - lsf[8] */
  wf[pWf] = 16384 - lsf[pLsf];

  pWf = wfOff;
  for (let i = 10; i !== 0; i--) {
    /* (wf[i] - 450); 1843 == 450 Hz (Q15 considering 7FFF = 8000 Hz) */
    wgt_fct = wf[pWf];
    temp = (wgt_fct - 1843) << 16 >> 16;

    if (temp > 0) {
      temp = ((temp * 6242) >> 15) << 16 >> 16;
      wgt_fct = (1843 - temp) << 16 >> 16;
    } else {
      temp = ((wgt_fct * 28160) >> 15) << 16 >> 16;
      wgt_fct = (3427 - temp) << 16 >> 16;
    }

    wf[pWf++] = wgt_fct << 3; /* Int16Array store truncates as C Word16 */
  }
}
