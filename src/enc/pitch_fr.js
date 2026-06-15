/*
 * Closed-loop pitch search, ported from opencore-amr 0.1.6 enc/src:
 *   convolve.cpp (Convolve), inter_36.cpp (Interpol_3or6),
 *   pitch_fr.cpp (mode_dep_parm, Norm_Corr, searchFrac, getRange,
 *   Pitch_frState, Pitch_fr), enc_lag3.cpp (Enc_lag3),
 *   enc_lag6.cpp (Enc_lag6)
 * Active implementations transcribed line by line.
 */
import { amrnb_fxp_mac_16_by_16bb, Mpy_32 } from '../common/basicop.js';
import { Inv_sqrt } from '../common/mathops.js';
import {
  L_SUBFR, L_INTER_SRCH, L_FRAME_BY2, PIT_MAX, PIT_MIN, PIT_MIN_MR122,
  MR475, MR515, MR59, MR67, MR122,
} from '../common/cnst.js';
import { inter_6 } from '../common/tables/index.js';

const UP_SAMP_MAX = 6;

/* pitch_fr.cpp mode_dep_parm[N_MODES] (last MRDTX row unused/absent in C) */
const mode_dep_parm = [
  /* maxfrac flag3 first last d_int_low d_int_rng d_frc_low d_frc_rng pitmin */
  /* MR475 */ [84, 1, -2, 2, 5, 10, 5, 9, PIT_MIN],
  /* MR515 */ [84, 1, -2, 2, 5, 10, 5, 9, PIT_MIN],
  /* MR59  */ [84, 1, -2, 2, 3, 6, 5, 9, PIT_MIN],
  /* MR67  */ [84, 1, -2, 2, 3, 6, 5, 9, PIT_MIN],
  /* MR74  */ [84, 1, -2, 2, 3, 6, 5, 9, PIT_MIN],
  /* MR795 */ [84, 1, -2, 2, 3, 6, 10, 19, PIT_MIN],
  /* MR102 */ [84, 1, -2, 2, 3, 6, 5, 9, PIT_MIN],
  /* MR122 */ [94, 0, -3, 3, 3, 6, 5, 9, PIT_MIN_MR122],
];

/** convolve.cpp Convolve: y = x (*) h, scaled >> 12 */
export function Convolve(x, xOff, h, hOff, y, yOff, L) {
  let s1, s2;
  let pY = yOff;
  let pH;
  let pX;

  for (let n = 1; n < L; n += 2) {
    pH = hOff + n;
    pX = xOff;
    s2 = x[pX] * h[pH--];
    s1 = x[pX++] * h[pH];
    for (let i = (n - 1) >> 1; i !== 0; i--) {
      s2 = amrnb_fxp_mac_16_by_16bb(x[pX], h[pH--], s2);
      s1 = amrnb_fxp_mac_16_by_16bb(x[pX++], h[pH], s1);
      s2 = amrnb_fxp_mac_16_by_16bb(x[pX], h[pH--], s2);
      s1 = amrnb_fxp_mac_16_by_16bb(x[pX++], h[pH], s1);
    }
    s2 = amrnb_fxp_mac_16_by_16bb(x[pX], h[pH], s2);
    y[pY++] = (((s1 | 0) >> 12) << 16) >> 16;
    y[pY++] = (((s2 | 0) >> 12) << 16) >> 16;
  }
}

/** inter_36.cpp Interpol_3or6 (pOverflow intentionally unused) */
export function Interpol_3or6(pX, pXOff, frac, flag3, pOverflow) {
  let s;
  let k;

  if (flag3 !== 0) {
    frac <<= 1; /* inter_3[k] = inter_6[2*k] -> k' = 2*k */
  }

  let base = pXOff;
  if (frac < 0) {
    frac += UP_SAMP_MAX;
    base--;
  }

  let pX1 = base;
  let pX2 = base + 1;
  const pC1 = frac;
  const pC2 = UP_SAMP_MAX - frac;

  s = 0x04000;
  k = 0;
  for (let i = L_INTER_SRCH >> 1; i !== 0; i--) {
    s = amrnb_fxp_mac_16_by_16bb(pX[pX1--], inter_6[pC1 + k], s);
    s = amrnb_fxp_mac_16_by_16bb(pX[pX2++], inter_6[pC2 + k], s);
    k += UP_SAMP_MAX;
    s = amrnb_fxp_mac_16_by_16bb(pX[pX1--], inter_6[pC1 + k], s);
    s = amrnb_fxp_mac_16_by_16bb(pX[pX2++], inter_6[pC2 + k], s);
    k <<= 1;
  }
  return (((s | 0) >> 15) << 16) >> 16;
}

const ncExcf = new Int16Array(L_SUBFR);
const ncScaledExcf = new Int16Array(L_SUBFR);

/** pitch_fr.cpp Norm_Corr (static) */
function Norm_Corr(exc, excOff, xn, xnOff, h, hOff, L_subfr, t_min, t_max,
  corr_norm, corrOff, pOverflow) {
  let corr_h, corr_l, norm_h, norm_l;
  let s, s2;
  const excf = ncExcf;
  const scaled_excf = ncScaledExcf;
  let scaling, h_fac;
  let s_excf;
  let temp;
  let k = -t_min;

  /* compute the filtered excitation for the first delay t_min */
  Convolve(exc, excOff + k, h, hOff, excf, 0, L_subfr);

  /* scale "excf[]" to avoid overflow */
  s = 0;
  let pSE = 0;
  let pE = 0;
  for (let j = L_subfr >> 1; j !== 0; j--) {
    temp = excf[pE++];
    scaled_excf[pSE++] = temp >> 2;
    s = (s + temp * temp) | 0;
    temp = excf[pE++];
    scaled_excf[pSE++] = temp >> 2;
    s = (s + temp * temp) | 0;
  }

  if (s <= 67108864 >> 1) {
    s_excf = excf;
    h_fac = 12;
    scaling = 0;
  } else {
    /* "excf[]" is divided by 2 */
    s_excf = scaled_excf;
    h_fac = 14;
    scaling = 2;
  }

  /* loop for every possible period */
  for (let i = t_min; i <= t_max; i++) {
    /* Compute 1/sqrt(energy of excf[]) */
    s = 0;
    s2 = 0;
    let pX = xnOff;
    pSE = 0;
    let j = L_subfr >> 1;
    while (j--) {
      s = (s + xn[pX++] * s_excf[pSE]) | 0;
      s2 = (s2 + s_excf[pSE] * s_excf[pSE]) | 0;
      pSE++;
      s = (s + xn[pX++] * s_excf[pSE]) | 0;
      s2 = (s2 + s_excf[pSE] * s_excf[pSE]) | 0;
      pSE++;
    }

    s2 = s2 << 1;
    s2 = Inv_sqrt(s2, pOverflow);
    norm_h = ((s2 >> 16) << 16) >> 16;
    norm_l = (((s2 >> 1) - (norm_h << 15)) << 16) >> 16;

    corr_h = ((s >> 15) << 16) >> 16;
    corr_l = ((s - (corr_h << 15)) << 16) >> 16;

    /* Normalize correlation = correlation * (1/sqrt(energy)) */
    s = Mpy_32(corr_h, corr_l, norm_h, norm_l, pOverflow);

    corr_norm[corrOff + i] = (s << 16) >> 16;

    /* modify the filtered excitation excf[] for the next iteration */
    if (i !== t_max) {
      k--;
      temp = exc[excOff + k];

      let pD = L_subfr - 1; /* write index into s_excf */
      let pH = hOff + L_subfr - 1;
      let pS = L_subfr - 2; /* read index into s_excf */
      for (let j2 = (L_subfr - 1) >> 1; j2 !== 0; j2--) {
        s = (temp * h[pH--]) >> h_fac;
        s_excf[pD--] = (((s << 16) >> 16) + s_excf[pS--]) << 16 >> 16;
        s = (temp * h[pH--]) >> h_fac;
        s_excf[pD--] = (((s << 16) >> 16) + s_excf[pS--]) << 16 >> 16;
      }
      s = (temp * h[pH]) >> h_fac;
      s_excf[pD--] = (((s << 16) >> 16) + s_excf[pS]) << 16 >> 16;
      s_excf[pD] = temp >> scaling;
    }
  }
}

/** pitch_fr.cpp searchFrac (static): lag/frac are 1-element Int16Array */
function searchFrac(lag, frac, last_frac, corr, corrOff, flag3, pOverflow) {
  let max;
  let corr_int;

  /* Test the fractions around T0 and choose the one which maximizes
     the interpolated normalized correlation. */
  max = Interpol_3or6(corr, corrOff + lag[0], frac[0], flag3, pOverflow);

  for (let i = frac[0] + 1; i <= last_frac; i++) {
    corr_int = Interpol_3or6(corr, corrOff + lag[0], i, flag3, pOverflow);
    if (corr_int > max) {
      max = corr_int;
      frac[0] = i;
    }
  }

  if (flag3 === 0) {
    /* Limit the fraction value in the interval [-2,-1,0,1,2,3] */
    if (frac[0] === -3) {
      frac[0] = 3;
      lag[0]--;
    }
  } else {
    /* limit the fraction value between -1 and 1 */
    if (frac[0] === -2) {
      frac[0] = 1;
      lag[0]--;
    }
    if (frac[0] === 2) {
      frac[0] = -1;
      lag[0]++;
    }
  }
}

/** pitch_fr.cpp getRange (static): t0_min/t0_max 1-element Int16Array */
function getRange(T0, delta_low, delta_range, pitmin, pitmax, t0_min, t0_max, pOverflow) {
  let temp = (T0 - delta_low) << 16 >> 16;
  if (temp < pitmin) {
    temp = pitmin;
  }
  t0_min[0] = temp;

  temp = (temp + delta_range) << 16 >> 16;
  if (temp > pitmax) {
    temp = pitmax;
    t0_min[0] = pitmax - delta_range;
  }
  t0_max[0] = temp;
}

/** pitch_fr.h Pitch_frState */
export class Pitch_frState {
  constructor() {
    this.T0_prev_subframe = 0;
    this.reset();
  }

  /** pitch_fr.cpp Pitch_fr_reset */
  reset() {
    this.T0_prev_subframe = 0;
    return 0;
  }
}

/** enc_lag3.cpp Enc_lag3 */
export function Enc_lag3(T0, T0_frac, T0_prev, T0_min, T0_max, delta_flag,
  flag4, pOverflow) {
  let index, i, tmp_ind, uplag;
  let tmp_lag;
  let temp1, temp2;

  if (delta_flag === 0) {
    /* if 1st or 3rd subframe: encode pitch delay (with fraction) */
    temp1 = (T0 - 85) << 16 >> 16;
    if (temp1 <= 0) {
      /* index = T0*3 - 58 + T0_frac */
      index = ((T0 << 1) + T0 - 58 + T0_frac) << 16 >> 16;
    } else {
      index = (T0 + 112) << 16 >> 16;
    }
  } else if (flag4 === 0) {
    /* 'normal' encoding: either with 5 or 6 bit resolution */
    /* index = 3*(T0 - T0_min) + 2 + T0_frac */
    i = (T0 - T0_min) << 16 >> 16;
    index = (i + (i << 1) + 2 + T0_frac) << 16 >> 16;
  } else {
    /* encoding with 4 bit resolution */
    tmp_lag = T0_prev;
    temp1 = (tmp_lag - T0_min) << 16 >> 16;
    temp2 = (temp1 - 5) << 16 >> 16;
    if (temp2 > 0) {
      tmp_lag = (T0_min + 5) << 16 >> 16;
    }
    temp1 = (T0_max - tmp_lag) << 16 >> 16;
    temp2 = (temp1 - 4) << 16 >> 16;
    if (temp2 > 0) {
      tmp_lag = (T0_max - 4) << 16 >> 16;
    }

    uplag = (T0 + (T0 << 1) + T0_frac) << 16 >> 16;

    i = (tmp_lag - 2) << 16 >> 16;
    tmp_ind = (i + (i << 1)) << 16 >> 16;

    temp1 = (tmp_ind - uplag) << 16 >> 16;
    if (temp1 >= 0) {
      index = (T0 - tmp_lag + 5) << 16 >> 16;
    } else {
      i = (tmp_lag + 1) << 16 >> 16;
      i = (i + (i << 1)) << 16 >> 16;

      if (i > uplag) {
        index = (uplag - tmp_ind + 3) << 16 >> 16;
      } else {
        index = (T0 - tmp_lag + 11) << 16 >> 16;
      }
    }
  }

  return index;
}

/** enc_lag6.cpp Enc_lag6 */
export function Enc_lag6(T0, T0_frac, T0_min, delta_flag, pOverflow) {
  let index;
  let i;
  let temp;

  if (delta_flag === 0) {
    /* if 1st or 3rd subframe: encode pitch delay (with fraction) */
    if (T0 <= 94) {
      /* index = T0*6 - 105 + T0_frac */
      i = ((T0 << 3) - (T0 << 1) - 105) << 16 >> 16;
      index = (i + T0_frac) << 16 >> 16;
    } else {
      index = (T0 + 368) << 16 >> 16;
    }
  } else {
    /* if second or fourth subframe: index = 6*(T0-T0_min) + 3 + T0_frac */
    temp = (T0 - T0_min) << 16 >> 16;
    i = ((temp << 3) - (temp << 1)) << 16 >> 16;
    i = (i + 3) << 16 >> 16;
    index = (i + T0_frac) << 16 >> 16;
  }

  return index;
}

const pfCorrV = new Int16Array(40); /* t0_max-t0_min+1+2*L_INTER_SRCH */
const pfT0min = new Int16Array(1);
const pfT0max = new Int16Array(1);
const pfLag = new Int16Array(1);
const pfFrac = new Int16Array(1);

/**
 * pitch_fr.cpp Pitch_fr: closed-loop pitch search; returns integer lag.
 * pit_frac/resu3/ana_index are 1-element Int16Array outs.
 */
export function Pitch_fr(st, mode, T_op, T_opOff, exc, excOff, xn, xnOff,
  h, hOff, L_subfr, i_subfr, pit_frac, resu3, ana_index, pOverflow) {
  let max;
  let tmp_lag;
  const corr_v = pfCorrV;
  let frame_offset;
  let delta_search;

  /* set mode specific variables */
  const mp = mode_dep_parm[mode];
  const max_frac_lag = mp[0];
  const flag3 = mp[1];
  let frac = mp[2];
  let last_frac = mp[3];
  const delta_int_low = mp[4];
  const delta_int_range = mp[5];
  const delta_frc_low = mp[6];
  const delta_frc_range = mp[7];
  const pit_min = mp[8];

  /* decide upon full or differential search */
  delta_search = 1;

  if (i_subfr === 0 || i_subfr === L_FRAME_BY2) {
    /* Subframe 1 and 3 */
    if ((mode !== MR475 && mode !== MR515) || i_subfr !== L_FRAME_BY2) {
      /* set t0_min, t0_max for full search
         (not done for MR475/MR515 in subframe 3) */
      delta_search = 0; /* no differential search */

      frame_offset = 1;
      if (i_subfr === 0) {
        frame_offset = 0;
      }

      getRange(T_op[T_opOff + frame_offset], delta_int_low, delta_int_range,
        pit_min, PIT_MAX, pfT0min, pfT0max, pOverflow);
    } else {
      /* mode MR475, MR515 and 3rd subframe: delta search as well */
      getRange(st.T0_prev_subframe, delta_frc_low, delta_frc_range,
        pit_min, PIT_MAX, pfT0min, pfT0max, pOverflow);
    }
  } else {
    /* for Subframe 2 and 4: range around T0 of previous subframe */
    getRange(st.T0_prev_subframe, delta_frc_low, delta_frc_range,
      pit_min, PIT_MAX, pfT0min, pfT0max, pOverflow);
  }
  const t0_min = pfT0min[0];
  const t0_max = pfT0max[0];

  /* Find interval to compute normalized correlation */
  const t_min = (t0_min - L_INTER_SRCH) << 16 >> 16;
  const t_max = (t0_max + L_INTER_SRCH) << 16 >> 16;
  const corrOff = -t_min; /* corr = &corr_v[-t_min] */

  /* Compute normalized correlation between target and filtered excitation */
  Norm_Corr(exc, excOff, xn, xnOff, h, hOff, L_subfr, t_min, t_max,
    corr_v, corrOff, pOverflow);

  /* Find integer pitch */
  max = corr_v[corrOff + t0_min];
  let lag = t0_min;
  for (let i = t0_min + 1; i <= t0_max; i++) {
    if (corr_v[corrOff + i] >= max) {
      max = corr_v[corrOff + i];
      lag = i;
    }
  }

  /* Find fractional pitch */
  pfLag[0] = lag;
  pfFrac[0] = frac;
  if (delta_search === 0 && lag > max_frac_lag) {
    /* full search and integer pitch greater than max_frac_lag:
       fractional search is not needed, set fractional to zero */
    pfFrac[0] = 0;
  } else if (delta_search !== 0
    && (mode === MR475 || mode === MR515 || mode === MR59 || mode === MR67)) {
    /* differential search with 4 bits resolution: modify frac or last_frac
       according to position of last integer pitch */
    tmp_lag = st.T0_prev_subframe;
    if ((tmp_lag - t0_min) << 16 >> 16 > 5) {
      tmp_lag = (t0_min + 5) << 16 >> 16;
    }
    if ((t0_max - tmp_lag) << 16 >> 16 > 4) {
      tmp_lag = (t0_max - 4) << 16 >> 16;
    }

    if (lag === tmp_lag || lag === tmp_lag - 1) {
      /* normal search in fractions around T0 */
      searchFrac(pfLag, pfFrac, last_frac, corr_v, corrOff, flag3, pOverflow);
    } else if (lag === tmp_lag - 2) {
      /* limit search around T0 to the right side */
      pfFrac[0] = 0;
      searchFrac(pfLag, pfFrac, last_frac, corr_v, corrOff, flag3, pOverflow);
    } else if (lag === tmp_lag + 1) {
      /* limit search around T0 to the left side */
      last_frac = 0;
      searchFrac(pfLag, pfFrac, last_frac, corr_v, corrOff, flag3, pOverflow);
    } else {
      /* no fractional search */
      pfFrac[0] = 0;
    }
  } else {
    /* test the fractions around T0 */
    searchFrac(pfLag, pfFrac, last_frac, corr_v, corrOff, flag3, pOverflow);
  }
  lag = pfLag[0];
  frac = pfFrac[0];

  /* encode pitch */
  if (flag3 !== 0) {
    /* flag4 indicates encoding with 4 bit resolution
       (MR475, MR515, MR59, MR67) */
    let flag4 = 0;
    if (mode === MR475 || mode === MR515 || mode === MR59 || mode === MR67) {
      flag4 = 1;
    }

    /* encode with 1/3 subsample resolution */
    ana_index[0] = Enc_lag3(lag, frac, st.T0_prev_subframe,
      t0_min, t0_max, delta_search, flag4, pOverflow);
  } else {
    /* encode with 1/6 subsample resolution */
    ana_index[0] = Enc_lag6(lag, frac, t0_min, delta_search, pOverflow);
  }

  /* update state variables */
  st.T0_prev_subframe = lag;

  /* update output variables */
  resu3[0] = flag3;
  pit_frac[0] = frac;

  return lag;
}
