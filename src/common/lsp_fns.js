/*
 * LSP/LSF conversion functions, ported from opencore-amr 0.1.6 common/src:
 *   lsp_az.cpp (Get_lsp_pol, Lsp_Az), lsp_lsf.cpp (Lsf_lsp, Lsp_lsf),
 *   az_lsp.cpp (Chebps, Az_lsp), reorder.cpp (Reorder_lsf)
 * Active implementations transcribed line by line.
 */
import {
  MAX_16, MIN_16, abs_s, norm_s, div_s,
} from './basicop.js';
import { M } from './cnst.js';
import { grid, table as cosTable, slope } from './tables/index.js';

const NC = M / 2;
const grid_points = 60;

const f1Pol = new Int32Array(6);
const f2Pol = new Int32Array(6);

/** lsp_az.cpp Get_lsp_pol (static): f is Int32Array(6) */
function Get_lsp_pol(lsp, lspOff, f, pOverflow) {
  let hi;
  let lo;
  let t0;
  let fi = 0;
  let li = lspOff;

  /* f[0] = 1.0 */
  f[fi++] = 0x01000000;
  f[fi++] = -lsp[li++] << 10; /* f[1] = -2.0 * lsp[0] */
  li++; /* Advance lsp pointer */

  for (let i = 2; i <= 5; i++) {
    f[fi] = f[fi - 2];

    for (let j = 1; j < i; j++) {
      hi = ((f[fi - 1] >> 16) << 16) >> 16;
      lo = (((f[fi - 1] >> 1) - (hi << 15)) << 16) >> 16;

      t0 = hi * lsp[li];
      t0 += (lo * lsp[li]) >> 15;

      f[fi] = (f[fi] + f[fi - 2]) | 0;   /* *f += f[-2] */
      f[fi] = (f[fi] - (t0 << 2)) | 0;   /* *f -= t0 */
      fi--;
    }

    f[fi] = (f[fi] - (lsp[li++] << 10)) | 0;
    fi += i;
    li++;
  }
}

/** lsp_az.cpp Lsp_Az: lsp[10] -> a[11] (Q12) */
export function Lsp_Az(lsp, lspOff, a, aOff, pOverflow) {
  let t0;
  let t1;
  const f1 = f1Pol;
  const f2 = f2Pol;

  Get_lsp_pol(lsp, lspOff, f1, pOverflow);
  Get_lsp_pol(lsp, lspOff + 1, f2, pOverflow);

  let pF1 = 5;
  let pF2 = 5;
  for (let i = 5; i > 0; i--) {
    f1[pF1] = (f1[pF1] + f1[i - 1]) | 0; /* C: *(p_f1--) += f1[i-1] */
    pF1--;
    f2[pF2] = (f2[pF2] - f2[i - 1]) | 0; /* C: *(p_f2--) -= f2[i-1] */
    pF2--;
  }

  let pA = aOff;
  a[pA++] = 4096;
  let iF1 = 1;
  let iF2 = 1;
  for (let i = 1, j = 10; i <= 5; i++, j--) {
    t0 = f1[iF1] + f2[iF2];     /* f1[i] + f2[i] */
    t1 = f1[iF1++] - f2[iF2++]; /* f1[i] - f2[i] */

    t0 = t0 + (1 << 12);
    t1 = t1 + (1 << 12);

    a[pA++] = ((t0 >> 13) << 16) >> 16;
    a[aOff + j] = ((t1 >> 13) << 16) >> 16;
  }
}

/** lsp_lsf.cpp Lsf_lsp: lsf[m] -> lsp[m] */
export function Lsf_lsp(lsf, lsfOff, lsp, lspOff, m, pOverflow) {
  for (let i = 0; i < m; i++) {
    const ind = lsf[lsfOff + i] >> 8;      /* ind    = b8-b15 of lsf[i] */
    const offset = lsf[lsfOff + i] & 0x00ff; /* offset = b0-b7 of lsf[i] */

    /* lsp[i] = table[ind] + ((table[ind+1]-table[ind])*offset) / 256 */
    const L_tmp = ((cosTable[ind + 1] - cosTable[ind]) * offset) >> 8;
    lsp[lspOff + i] = (cosTable[ind] + ((L_tmp << 16) >> 16)) << 16 >> 16;
  }
}

/** lsp_lsf.cpp Lsp_lsf: lsp[m] -> lsf[m] (pOverflow intentionally unused) */
export function Lsp_lsf(lsp, lspOff, lsf, lsfOff, m, pOverflow) {
  let ind = 63; /* begin at end of table -1 */
  let pLsp = lspOff + m - 1;
  let pLsf = lsfOff + m - 1;

  for (let i = m - 1; i >= 0; i--) {
    /* find value in table that is just greater than lsp[i] */
    const temp = lsp[pLsp--];
    while (cosTable[ind] < temp) {
      ind--;
    }

    /* acos(lsp[i]) = ind*256 + ((lsp[i]-table[ind]) * slope[ind])/4096 */
    let L_tmp = Math.imul(temp - cosTable[ind], slope[ind]);
    L_tmp = ((L_tmp + 0x00000800) | 0) >> 12;
    lsf[pLsf--] = ((((L_tmp << 16) >> 16) + (ind << 8)) << 16) >> 16;
  }
}

/** reorder.cpp Reorder_lsf (pOverflow intentionally unused) */
export function Reorder_lsf(lsf, lsfOff, min_dist, n, pOverflow) {
  let lsf_min = min_dist;
  let p = lsfOff;
  for (let i = 0; i < n; i++) {
    if (lsf[p] < lsf_min) {
      lsf[p++] = lsf_min;
      lsf_min = (lsf_min + min_dist) << 16 >> 16;
    } else {
      lsf_min = (lsf[p++] + min_dist) << 16 >> 16;
    }
  }
}

/** az_lsp.cpp Chebps (static; pOverflow intentionally unused) */
function Chebps(x, f, n, pOverflow) {
  let cheb;
  let b1_h;
  let b1_l;
  let t0;
  let L_temp;
  let pF = 1;

  /* L_temp = 1.0 */
  L_temp = 0x01000000;

  t0 = ((x << 10) + (f[pF++] << 14)) | 0;

  /* b1 = t0 = 2*x + f[1] */
  b1_h = ((t0 >> 16) << 16) >> 16;
  b1_l = (((t0 >> 1) - (b1_h << 15)) << 16) >> 16;

  for (let i = 2; i < n; i++) {
    /* t0 = 2.0*x*b1 */
    t0 = b1_h * x;
    t0 += (b1_l * x) >> 15;
    t0 = (t0 << 2) | 0;

    /* t0 = 2.0*x*b1 - b2 */
    t0 = (t0 - L_temp) | 0;

    /* t0 = 2.0*x*b1 - b2 + f[i] */
    t0 = (t0 + (f[pF++] << 14)) | 0;

    L_temp = ((b1_h << 16) + (b1_l << 1)) | 0;

    /* b0 = 2.0*x*b1 - b2 + f[i] */
    b1_h = ((t0 >> 16) << 16) >> 16;
    b1_l = (((t0 >> 1) - (b1_h << 15)) << 16) >> 16;
  }

  /* t0 = x*b1 */
  t0 = b1_h * x;
  t0 += (b1_l * x) >> 15;
  t0 = (t0 << 1) | 0;

  /* t0 = x*b1 - b2 */
  t0 = (t0 - L_temp) | 0;

  /* t0 = x*b1 - b2 + f[i]/2 */
  t0 = (t0 + (f[pF] << 13)) | 0;

  if ((t0 + 33554432) >>> 0 < 67108863) {
    cheb = ((t0 >> 10) << 16) >> 16;
  } else if (t0 > 0x01ffffff) {
    cheb = MAX_16;
  } else {
    cheb = MIN_16;
  }

  return cheb;
}

const azF1 = new Int16Array(NC + 1);
const azF2 = new Int16Array(NC + 1);

/** az_lsp.cpp Az_lsp: a[MP1] -> lsp[M] (falls back to old_lsp if <10 roots) */
export function Az_lsp(a, aOff, lsp, lspOff, old_lsp, old_lspOff, pOverflow) {
  let xlow, ylow, xhigh, yhigh, xmid, ymid, xint;
  let x, y, sign, exp;
  const f1 = azF1;
  const f2 = azF2;

  f1[0] = 1024; /* f1[0] = 1.0 */
  f2[0] = 1024; /* f2[0] = 1.0 */

  for (let i = 0; i < NC; i++) {
    const L_temp1 = a[aOff + i + 1];
    const L_temp2 = a[aOff + M - i];
    /* x = (a[i+1] + a[M-i]) >> 2 */
    x = (((L_temp1 + L_temp2) >> 2) << 16) >> 16;
    /* y = (a[i+1] - a[M-i]) >> 2 */
    y = (((L_temp1 - L_temp2) >> 2) << 16) >> 16;
    /* f1[i+1] = a[i+1] + a[M-i] - f1[i] */
    f1[i + 1] = x - f1[i]; /* Int16Array store truncates as the C Word16 does */
    /* f2[i+1] = a[i+1] - a[M-i] + f2[i] */
    f2[i + 1] = y + f2[i];
  }

  let nf = 0; /* number of found frequencies */
  let ip = 0; /* indicator for f1 or f2 */
  let coef = f1;

  xlow = grid[0];
  ylow = Chebps(xlow, coef, NC, pOverflow);

  let j = 0;
  while (nf < M && j < grid_points) {
    j++;
    xhigh = xlow;
    yhigh = ylow;
    xlow = grid[j];
    ylow = Chebps(xlow, coef, NC, pOverflow);

    if (ylow * yhigh <= 0) {
      /* divide 4 times the interval */
      for (let i = 4; i !== 0; i--) {
        /* xmid = (xlow + xhigh)/2 */
        x = xlow >> 1;
        y = xhigh >> 1;
        xmid = (x + y) << 16 >> 16;

        ymid = Chebps(xmid, coef, NC, pOverflow);

        if (ylow * ymid <= 0) {
          yhigh = ymid;
          xhigh = xmid;
        } else {
          ylow = ymid;
          xlow = xmid;
        }
      }

      /* Linear interpolation: xint = xlow - ylow*(xhigh-xlow)/(yhigh-ylow) */
      x = (xhigh - xlow) << 16 >> 16;
      y = (yhigh - ylow) << 16 >> 16;

      if (y === 0) {
        xint = xlow;
      } else {
        sign = y;
        y = abs_s(y);
        exp = norm_s(y);
        y = (y << exp) << 16 >> 16;
        y = div_s(16383, y);
        y = ((x * y) >> (19 - exp)) << 16 >> 16;

        if (sign < 0) {
          y = (-y) << 16 >> 16;
        }

        /* xint = xlow - ylow*y */
        xint = (xlow - ((ylow * y) >> 10)) << 16 >> 16;
      }

      lsp[lspOff + nf] = xint;
      xlow = xint;
      nf++;

      if (ip === 0) {
        ip = 1;
        coef = f2;
      } else {
        ip = 0;
        coef = f1;
      }
      ylow = Chebps(xlow, coef, NC, pOverflow);
    }
  }

  /* Check if M roots found */
  if (nf < M) {
    for (let i = 0; i < M; i++) {
      lsp[lspOff + i] = old_lsp[old_lspOff + i];
    }
  }
}
