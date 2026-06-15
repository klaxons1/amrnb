/*
 * LPC analysis chain, ported from opencore-amr 0.1.6 enc/src:
 *   pre_proc.cpp (Pre_ProcessState, Pre_Process),
 *   autocorr.cpp (Autocorr), lag_wind.cpp (Lag_window),
 *   levinson.cpp (LevinsonState, Levinson), lpc.cpp (lpcState, lpc)
 * Active implementations transcribed line by line.
 */
import {
  norm_l, abs_s, pv_round, L_shl, Mpy_32, amrnb_fxp_mac_16_by_16bb,
} from '../common/basicop.js';
import { L_abs, L_negate, Div_32 } from '../common/oper32b.js';
import { M, MP1, L_WINDOW, MR122 } from '../common/cnst.js';
import {
  lag_h, lag_l, window_160_80, window_232_8, window_200_40,
} from '../common/tables/index.js';

/** pre_proc.h Pre_ProcessState */
export class Pre_ProcessState {
  constructor() {
    this.y2_hi = 0;
    this.y2_lo = 0;
    this.y1_hi = 0;
    this.y1_lo = 0;
    this.x0 = 0;
    this.x1 = 0;
  }

  /** pre_proc.cpp Pre_Process_reset */
  reset() {
    this.y2_hi = 0;
    this.y2_lo = 0;
    this.y1_hi = 0;
    this.y1_lo = 0;
    this.x0 = 0;
    this.x1 = 0;
    return 0;
  }
}

/** pre_proc.cpp Pre_Process: 80 Hz HP filter + /2 scaling */
export function Pre_Process(st, signal, signalOff, lg) {
  let x_n_2;
  let x_n_1;
  let L_tmp;

  let p = signalOff;
  x_n_2 = st.x1;
  x_n_1 = st.x0;

  for (let i = lg; i !== 0; i--) {
    /* y[i] = b[0]*x[i]/2 + b[1]*x[i-1]/2 + b[2]*x[i-2]/2
              + a[1]*y[i-1] + a[2]*y[i-2]; */
    L_tmp = st.y1_hi * 7807;
    L_tmp += (st.y1_lo * 7807) >> 15;

    L_tmp += st.y2_hi * -3733;
    st.y2_hi = st.y1_hi;
    L_tmp += (st.y2_lo * -3733) >> 15;
    st.y2_lo = st.y1_lo;

    L_tmp += x_n_2 * 1899;
    x_n_2 = x_n_1;
    L_tmp += x_n_1 * -3798;
    x_n_1 = signal[p];
    L_tmp += x_n_1 * 1899;

    L_tmp = L_tmp | 0; /* normalize wrapped Word32 sum */
    signal[p++] = (((L_tmp + 0x0000800) | 0) >> 12) << 16 >> 16;

    st.y1_hi = ((L_tmp >> 12) << 16) >> 16;
    st.y1_lo = (((L_tmp << 3) - (st.y1_hi << 15)) << 16) >> 16;
  }

  st.x1 = x_n_2;
  st.x0 = x_n_1;
}

const acY = new Int16Array(L_WINDOW);

/** autocorr.cpp Autocorr: returns norm (pOverflow intentionally unused) */
export function Autocorr(x, xOff, m, r_h, r_hOff, r_l, r_lOff, wind, pOverflow) {
  let norm;
  const y = acY;
  let sum;
  let overfl_shft;
  let temp;
  let i;
  let j;

  /* Windowing of the signal */
  let pY = 0;
  let pX = xOff;
  let pW = 0;
  sum = 0;
  j = 0;
  for (i = L_WINDOW; i !== 0; i--) {
    temp = ((amrnb_fxp_mac_16_by_16bb(x[pX++], wind[pW++], 0x04000) >> 15) << 16) >> 16;
    y[pY++] = temp;
    sum = (sum + ((temp * temp) << 1)) | 0; /* C Word32 wrap drives the test */
    if (sum < 0) {
      /* if overflow exists, then stop accumulation */
      j = 1;
      break;
    }
  }

  /* if overflow existed, complete windowing without computing energy */
  if (j) {
    pY = L_WINDOW - i;
    pX = xOff + L_WINDOW - i;
    pW = L_WINDOW - i;
    for (; i !== 0; i--) {
      temp = ((amrnb_fxp_mac_16_by_16bb(x[pX++], wind[pW++], 0x04000) >> 15) << 16) >> 16;
      y[pY++] = temp;
    }
  }

  /* Compute r[0] and test for overflow; scale down by 1/4 only when needed */
  overfl_shft = 0;

  while (j === 1) {
    /* If overflow divide y[] by 4 */
    overfl_shft += 4;
    pY = 0;
    sum = 0;
    for (i = L_WINDOW >> 1; i !== 0; i--) {
      temp = y[pY] >> 2;
      y[pY++] = temp;
      sum = (sum + ((temp * temp) << 1)) | 0;
      temp = y[pY] >> 2;
      y[pY++] = temp;
      sum = (sum + ((temp * temp) << 1)) | 0;
    }

    if (sum > 0) {
      j = 0;
    }
  }

  sum = (sum + 1) | 0; /* Avoid the case of all zeros */

  /* Normalization of r[0] */
  norm = norm_l(sum);
  sum = sum << norm;

  /* Put in DPF format (see oper_32b) */
  r_h[r_hOff] = ((sum >> 16) << 16) >> 16;
  r_l[r_lOff] = (((sum >> 1) - (r_h[r_hOff] << 15)) << 16) >> 16;

  /* r[1] to r[m] */
  const pYref = L_WINDOW - 1;
  let pRh = r_hOff + m;
  let pRl = r_lOff + m;
  for (i = m; i > 0; i--) {
    sum = 0;
    pY = L_WINDOW - i - 1;
    let pY1 = pYref;

    for (j = (L_WINDOW - i - 1) >> 1; j !== 0; j--) {
      sum = amrnb_fxp_mac_16_by_16bb(y[pY--], y[pY1--], sum);
      sum = amrnb_fxp_mac_16_by_16bb(y[pY--], y[pY1--], sum);
    }
    sum = amrnb_fxp_mac_16_by_16bb(y[pY--], y[pY1--], sum);
    if ((L_WINDOW - i - 1) & 1) {
      sum = amrnb_fxp_mac_16_by_16bb(y[pY--], y[pY1--], sum);
    }

    sum = sum << (norm + 1);

    r_h[pRh] = ((sum >> 16) << 16) >> 16;
    r_l[pRl--] = (((sum >> 1) - (r_h[pRh--] << 15)) << 16) >> 16;
  }

  norm = (norm - overfl_shft) << 16 >> 16;
  return norm;
}

/** lag_wind.cpp Lag_window */
export function Lag_window(m, r_h, r_hOff, r_l, r_lOff, pOverflow) {
  let x;
  let pLag = 0;
  let pRh = r_hOff + 1;
  let pRl = r_lOff + 1;

  for (let i = m; i !== 0; i--) {
    x = Mpy_32(r_h[pRh], r_l[pRl], lag_h[pLag], lag_l[pLag], pOverflow);
    pLag++;
    r_h[pRh] = ((x >> 16) << 16) >> 16;
    r_l[pRl++] = ((x >> 1) - (r_h[pRh++] << 15)) << 16 >> 16;
  }
}

/** levinson.h LevinsonState */
export class LevinsonState {
  constructor() {
    this.old_A = new Int16Array(M + 1);
    this.reset();
  }

  /** levinson.cpp Levinson_reset */
  reset() {
    this.old_A[0] = 4096;
    this.old_A.fill(0, 1);
    return 0;
  }
}

const lvAh = new Int16Array(M + 1);
const lvAl = new Int16Array(M + 1);
const lvAnh = new Int16Array(M + 1);
const lvAnl = new Int16Array(M + 1);

/** levinson.cpp Levinson: Rh/Rl[m+1] -> A[M+1] (Q12) + rc[4] (Q15) */
export function Levinson(st, Rh, RhOff, Rl, RlOff, A, AOff, rc, rcOff, pOverflow) {
  let hi;
  let lo;
  let Kh; /* reflection coefficient; hi and lo */
  let Kl;
  let alp_h; /* Prediction gain; hi lo and exponent */
  let alp_l;
  let alp_exp;
  const Ah = lvAh;
  const Al = lvAl;
  const Anh = lvAnh;
  const Anl = lvAnl;
  let t0;
  let t1;
  let t2;
  let i;
  let j;

  /* K = A[1] = -R[1] / R[0] */
  t1 = Rh[RhOff + 1] << 16;
  t1 = (t1 + (Rl[RlOff + 1] << 1)) | 0;
  t2 = L_abs(t1); /* abs R[1] - required by Div_32 */
  t0 = Div_32(t2, Rh[RhOff], Rl[RlOff], pOverflow); /* R[1]/R[0] */
  if (t1 > 0) {
    t0 = L_negate(t0); /* -R[1]/R[0] */
  }

  /* K in DPF */
  Kh = ((t0 >> 16) << 16) >> 16;
  Kl = (((t0 >> 1) - (Kh << 15)) << 16) >> 16;
  rc[rcOff] = pv_round(t0, pOverflow);

  t0 = t0 >> 4;

  /* A[1] in DPF */
  Ah[1] = ((t0 >> 16) << 16) >> 16;
  Al[1] = (((t0 >> 1) - (Ah[1] << 15)) << 16) >> 16;

  /* Alpha = R[0] * (1-K**2) */
  t0 = Mpy_32(Kh, Kl, Kh, Kl, pOverflow); /* K*K */
  t0 = L_abs(t0); /* Some case <0 !! */
  t0 = (0x7fffffff - t0) | 0; /* 1 - K*K */

  /* DPF format */
  hi = ((t0 >> 16) << 16) >> 16;
  lo = (((t0 >> 1) - (hi << 15)) << 16) >> 16;

  t0 = Mpy_32(Rh[RhOff], Rl[RlOff], hi, lo, pOverflow); /* Alpha */

  /* Normalize Alpha */
  alp_exp = norm_l(t0);
  t0 = t0 << alp_exp;

  /* DPF format */
  alp_h = ((t0 >> 16) << 16) >> 16;
  alp_l = (((t0 >> 1) - (alp_h << 15)) << 16) >> 16;

  /* ITERATIONS I=2 to M */
  for (i = 2; i <= M; i++) {
    /* t0 = SUM(R[j]*A[i-j], j=1,i-1) + R[i] */
    t0 = 0;
    let pRh = RhOff + 1;
    let pRl = RlOff + 1;
    let pAh = i - 1;
    let pAl = i - 1;
    for (j = 1; j < i; j++) {
      t0 += (Rh[pRh] * Al[pAl--]) >> 15;
      t0 += (Rl[pRl++] * Ah[pAh]) >> 15;
      t0 += Rh[pRh++] * Ah[pAh--];
    }

    t0 = (t0 | 0) << 5;

    t1 = ((Rh[RhOff + i] << 16) + (Rl[RlOff + i] << 1)) | 0;
    t0 = (t0 + t1) | 0;

    /* K = -t0 / Alpha */
    t1 = L_abs(t0);
    t2 = Div_32(t1, alp_h, alp_l, pOverflow); /* abs(t0)/Alpha */
    if (t0 > 0) {
      t2 = L_negate(t2); /* K = -t0/Alpha */
    }
    t2 = L_shl(t2, alp_exp, pOverflow); /* denormalize; compare to Alpha */

    Kh = ((t2 >> 16) << 16) >> 16;
    Kl = (((t2 >> 1) - (Kh << 15)) << 16) >> 16;

    if (i < 5) {
      rc[rcOff + i - 1] = ((((t2 + 0x00008000) | 0) >> 16) << 16) >> 16;
    }

    /* Test for unstable filter. If unstable keep old A(z) */
    if (abs_s(Kh) > 32750) {
      for (j = 0; j <= M; j++) {
        A[AOff + j] = st.old_A[j];
      }
      rc[rcOff] = 0;
      rc[rcOff + 1] = 0;
      rc[rcOff + 2] = 0;
      rc[rcOff + 3] = 0;
      return 0;
    }

    /* Compute new LPC coeff. -> An[i]
       An[j]= A[j] + K*A[i-j], j=1 to i-1; An[i]= K */
    let pAh2 = i - 1;
    let pAl2 = i - 1;
    let pAnh = 1;
    let pAnl = 1;
    for (j = 1; j < i; j++) {
      t0 = (Kh * Al[pAl2--]) >> 15;
      t0 += (Kl * Ah[pAh2]) >> 15;
      t0 += Kh * Ah[pAh2--];
      t0 += (Ah[j] << 15) + Al[j];
      t0 = t0 | 0;

      Anh[pAnh] = ((t0 >> 15) << 16) >> 16;
      Anl[pAnl++] = ((t0 - (Anh[pAnh++] << 15)) << 16) >> 16;
    }
    Anh[pAnh] = ((t2 >> 20) << 16) >> 16;
    Anl[pAnl] = (((t2 >> 5) - (Anh[i] << 15)) << 16) >> 16;

    /* Alpha = Alpha * (1-K**2) */
    t0 = Mpy_32(Kh, Kl, Kh, Kl, pOverflow); /* K*K */
    t0 = L_abs(t0); /* Some case <0 !! */
    t0 = (0x7fffffff - t0) | 0; /* 1 - K*K */

    hi = ((t0 >> 16) << 16) >> 16;
    lo = (((t0 >> 1) - (hi << 15)) << 16) >> 16;

    t0 = (alp_h * lo) >> 15;
    t0 += (alp_l * hi) >> 15;
    t0 += alp_h * hi;
    t0 = (t0 | 0) << 1;

    /* Normalize Alpha */
    j = norm_l(t0);
    t0 = t0 << j;
    alp_h = ((t0 >> 16) << 16) >> 16;
    alp_l = (((t0 >> 1) - (alp_h << 15)) << 16) >> 16;
    alp_exp = (alp_exp + j) << 16 >> 16; /* Add normalization to alp_exp */

    /* A[j] = An[j] */
    for (j = 1; j <= i; j++) {
      Ah[j] = Anh[j];
      Al[j] = Anl[j];
    }
  }

  A[AOff] = 4096;
  for (i = 1; i <= M; i++) {
    t0 = ((Ah[i] << 15) + Al[i]) | 0;
    const v = ((((t0 + 0x00002000) | 0) >> 14) << 16) >> 16;
    st.old_A[i] = v;
    A[AOff + i] = v;
  }
  return 0;
}

/** lpc.h lpcState */
export class lpcState {
  constructor() {
    this.levinsonSt = new LevinsonState();
  }

  /** lpc.cpp lpc_reset */
  reset() {
    this.levinsonSt.reset();
    return 0;
  }
}

const lpcRc = new Int16Array(4);
const lpcRLow = new Int16Array(MP1);
const lpcRHigh = new Int16Array(MP1);

/** lpc.cpp lpc: LP analysis (a[] holds 4 subframe coefficient sets) */
export function lpc(st, mode, x, xOff, x_12k2, x_12k2Off, a, aOff, pOverflow) {
  const rc = lpcRc;
  const rLow = lpcRLow;
  const rHigh = lpcRHigh;

  if (mode === MR122) {
    /* Autocorrelations */
    Autocorr(x_12k2, x_12k2Off, M, rHigh, 0, rLow, 0, window_160_80, pOverflow);
    /* Lag windowing */
    Lag_window(M, rHigh, 0, rLow, 0, pOverflow);
    /* Levinson Durbin */
    Levinson(st.levinsonSt, rHigh, 0, rLow, 0, a, aOff + MP1, rc, 0, pOverflow);

    /* Autocorrelations */
    Autocorr(x_12k2, x_12k2Off, M, rHigh, 0, rLow, 0, window_232_8, pOverflow);
    /* Lag windowing */
    Lag_window(M, rHigh, 0, rLow, 0, pOverflow);
    /* Levinson Durbin */
    Levinson(st.levinsonSt, rHigh, 0, rLow, 0, a, aOff + MP1 * 3, rc, 0, pOverflow);
  } else {
    /* Autocorrelations */
    Autocorr(x, xOff, M, rHigh, 0, rLow, 0, window_200_40, pOverflow);
    /* Lag windowing */
    Lag_window(M, rHigh, 0, rLow, 0, pOverflow);
    /* Levinson Durbin */
    Levinson(st.levinsonSt, rHigh, 0, rLow, 0, a, aOff + MP1 * 3, rc, 0, pOverflow);
  }
}
