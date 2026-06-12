/*
 * Phase dispersion, ported from opencore-amr 0.1.6 dec/src/ph_disp.cpp.
 * Active implementation transcribed line by line.
 */
import {
  MAX_32, MIN_32, add_16, pv_round, L_mult, L_add, L_shl,
} from '../common/basicop.js';
import { L_SUBFR, MR122, MR102, MR74, MR795 } from '../common/cnst.js';
import {
  ph_imp_low_MR795, ph_imp_mid_MR795, ph_imp_low, ph_imp_mid,
} from '../common/tables/index.js';

const PHDGAINMEMSIZE = 5;
const PHDTHR1LTP = 9830;  /* 0.6 in Q14 */
const PHDTHR2LTP = 14746; /* 0.9 in Q14 */
const ONFACTPLUS1 = 16384; /* 2.0 in Q13 */
const ONLENGTH = 2;

/** ph_disp.h ph_dispState */
export class ph_dispState {
  constructor() {
    this.gainMem = new Int16Array(PHDGAINMEMSIZE);
    this.prevState = 0;
    this.prevCbGain = 0;
    this.lockFull = 0;
    this.onset = 0;
  }

  /** ph_disp.cpp ph_disp_reset */
  reset() {
    this.gainMem.fill(0);
    this.prevState = 0;
    this.prevCbGain = 0;
    this.lockFull = 0;
    this.onset = 0; /* assume no onset in start */
    return 0;
  }
}

/** ph_disp.cpp ph_disp_lock */
export function ph_disp_lock(state) {
  state.lockFull = 1;
}

/** ph_disp.cpp ph_disp_release */
export function ph_disp_release(state) {
  state.lockFull = 0;
}

const innoSav = new Int16Array(L_SUBFR);
const psPoss = new Int16Array(L_SUBFR);

/** ph_disp.cpp ph_disp */
export function ph_disp(state, mode, x, xOff, cbGain, ltpGain, inno, innoOff,
  pitch_fac, tmp_shift, pOverflow) {
  let i, i1;
  let tmp1;
  let L_temp;
  let L_temp2;
  let impNr; /* indicator for amount of dispersion/filter used */
  const inno_sav = innoSav;
  const ps_poss = psPoss;
  let nze, nPulse;
  let ppos;
  let ph_imp; /* phase dispersion filter table */
  let c_inno_sav;

  /* Update LTP gain memory */
  state.gainMem[4] = state.gainMem[3];
  state.gainMem[3] = state.gainMem[2];
  state.gainMem[2] = state.gainMem[1];
  state.gainMem[1] = state.gainMem[0];
  state.gainMem[0] = ltpGain;

  /* basic adaption of phase dispersion */
  if (ltpGain < PHDTHR2LTP) {
    /* if (ltpGain < 0.9) */
    if (ltpGain > PHDTHR1LTP) {
      /* if (ltpGain > 0.6) */
      impNr = 1; /* medium dispersion */
    } else {
      impNr = 0; /* maximum dispersion */
    }
  } else {
    impNr = 2; /* no dispersion */
  }

  /* onset indicator: onset = (cbGain > onFact * cbGainMem[0]) */
  L_temp = (state.prevCbGain * ONFACTPLUS1) << 1;
  /* (L_temp << 2) calculation with saturation check */
  if (L_temp > 0x1fffffff) {
    pOverflow[0] = 1;
    L_temp = MAX_32;
  } else if (L_temp < -536870912) {
    pOverflow[0] = 1;
    L_temp = MIN_32;
  } else {
    L_temp <<= 2;
  }
  tmp1 = pv_round(L_temp, pOverflow);
  if (cbGain > tmp1) {
    state.onset = ONLENGTH;
  } else if (state.onset > 0) {
    state.onset -= 1;
  }

  /* if not onset, check ltpGain buffer and use max phase dispersion if
     half or more of the ltpGain-parameters say so */
  if (state.onset === 0) {
    i1 = 0;
    for (i = 0; i < PHDGAINMEMSIZE; i++) {
      if (state.gainMem[i] < PHDTHR1LTP) {
        i1 += 1;
      }
    }
    if (i1 > 2) {
      impNr = 0;
    }
  }

  /* Restrict decrease in phase dispersion to one step if not onset */
  if (impNr > state.prevState + 1 && state.onset === 0) {
    impNr -= 1;
  }
  /* if onset, use one step less phase dispersion */
  if (impNr < 2 && state.onset > 0) {
    impNr += 1;
  }
  /* disable for very low levels */
  if (cbGain < 10) {
    impNr = 2;
  }
  if (state.lockFull === 1) {
    impNr = 0;
  }

  /* update static memory */
  state.prevState = impNr;
  state.prevCbGain = cbGain;

  /* do phase dispersion for all modes but 12.2, 10.2 and 7.4;
     don't modify the innovation if impNr >= 2 (= no phase disp) */
  if (mode !== MR122 && mode !== MR102 && mode !== MR74 && impNr < 2) {
    /* track pulse positions, save innovation, initialize new innovation */
    nze = 0;
    for (i = 0; i < L_SUBFR; i++) {
      if (inno[innoOff + i] !== 0) {
        ps_poss[nze] = i;
        nze += 1;
      }
      inno_sav[i] = inno[innoOff + i];
      inno[innoOff + i] = 0;
    }

    /* Choose filter corresponding to codec mode and dispersion criterium */
    if (mode === MR795) {
      ph_imp = impNr === 0 ? ph_imp_low_MR795 : ph_imp_mid_MR795;
    } else {
      ph_imp = impNr === 0 ? ph_imp_low : ph_imp_mid;
    }

    /* Do phase dispersion of innovation */
    for (nPulse = 0; nPulse < nze; nPulse++) {
      ppos = ps_poss[nPulse];

      /* circular convolution with impulse response */
      c_inno_sav = inno_sav[ppos];
      let pImp = 0;
      for (i = ppos; i < L_SUBFR; i++) {
        /* inno[i] += inno_sav[ppos] * ph_imp[i-ppos] */
        L_temp = (c_inno_sav * ph_imp[pImp++]) >> 15;
        tmp1 = (L_temp << 16) >> 16;
        inno[innoOff + i] = add_16(inno[innoOff + i], tmp1, pOverflow);
      }
      for (i = 0; i < ppos; i++) {
        /* inno[i] += inno_sav[ppos] * ph_imp[L_SUBFR-ppos+i] */
        L_temp = (c_inno_sav * ph_imp[pImp++]) >> 15;
        tmp1 = (L_temp << 16) >> 16;
        inno[innoOff + i] = add_16(inno[innoOff + i], tmp1, pOverflow);
      }
    }
  }

  /* compute total excitation for synthesis part of decoder
     (using modified innovation if phase dispersion is active) */
  for (i = 0; i < L_SUBFR; i++) {
    /* x[i] = gain_pit*x[i] + cbGain*code[i]; */
    L_temp = L_mult(x[xOff + i], pitch_fac, pOverflow);
    L_temp2 = (inno[innoOff + i] * cbGain) << 1;
    L_temp = L_add(L_temp, L_temp2, pOverflow);
    L_temp = L_shl(L_temp, tmp_shift, pOverflow); /* Q16 */
    x[xOff + i] = pv_round(L_temp, pOverflow);
  }
}
