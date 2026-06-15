/*
 * Codebook-search correlations and sign setup, ported from opencore-amr 0.1.6
 * enc/src: cor_h.cpp (cor_h), cor_h_x.cpp (cor_h_x),
 *   cor_h_x2.cpp (cor_h_x2), set_sign.cpp (set_sign, set_sign12k2)
 * Active implementations transcribed line by line.
 *
 * The C matrix rr[L_CODE][L_CODE] is a flat Int16Array indexed rr[i*L_CODE+j].
 */
import {
  MIN_32, negate, norm_l, pv_round, L_mac, L_shl,
  amrnb_fxp_mac_16_by_16bb,
} from '../common/basicop.js';
import { L_abs } from '../common/oper32b.js';
import { Inv_sqrt } from '../common/mathops.js';
import { L_CODE, NB_TRACK, STEP } from '../common/cnst.js';

const LOG2_OF_32 = 5;

const corH2 = new Int16Array(L_CODE);

/**
 * cor_h.cpp cor_h: build autocorrelation matrix rr (flat L_CODE*L_CODE).
 */
export function cor_h(h, hOff, sign, rr, pOverflow) {
  let dec;
  const h2 = corH2;
  let s, s2;
  let tmp1, tmp2, tmp11, tmp22;

  /* Scaling for maximum precision; accumulator starts at 1 */
  s = 1;
  let pH = hOff;
  for (let i = L_CODE >> 1; i !== 0; i--) {
    tmp1 = h[pH++];
    s = amrnb_fxp_mac_16_by_16bb(tmp1, tmp1, s);
    tmp1 = h[pH++];
    s = amrnb_fxp_mac_16_by_16bb(tmp1, tmp1, s);
  }
  s = s << 1;

  if (s & MIN_32) {
    let pH2 = 0;
    pH = hOff;
    for (let i = L_CODE >> 1; i !== 0; i--) {
      h2[pH2++] = h[pH++] >> 1;
      h2[pH2++] = h[pH++] >> 1;
    }
  } else {
    s = s >> 1;
    s = Inv_sqrt(s, pOverflow);
    if (s < 0x00ffffff) {
      /* k = 0.99*k */
      dec = (((s >> 9) * 32440) >> 15) << 16 >> 16;
    } else {
      dec = 32440; /* 0.99 */
    }
    pH = hOff;
    let pH2 = 0;
    for (let i = L_CODE >> 1; i !== 0; i--) {
      h2[pH2++] = (amrnb_fxp_mac_16_by_16bb(h[pH++], dec, 0x020) >> 6) << 16 >> 16;
      h2[pH2++] = (amrnb_fxp_mac_16_by_16bb(h[pH++], dec, 0x020) >> 6) << 16 >> 16;
    }
  }

  /* build matrix rr[] */
  s = 0;
  let pH2 = 0;
  let rr1 = (L_CODE - 1) * L_CODE + (L_CODE - 1); /* &rr[L_CODE-1][L_CODE-1] */
  for (let i = L_CODE >> 1; i !== 0; i--) {
    tmp1 = h2[pH2++];
    s = amrnb_fxp_mac_16_by_16bb(tmp1, tmp1, s);
    rr[rr1] = (((s + 0x00004000) | 0) >> 15) << 16 >> 16;
    rr1 -= L_CODE + 1;
    tmp1 = h2[pH2++];
    s = amrnb_fxp_mac_16_by_16bb(tmp1, tmp1, s);
    rr[rr1] = (((s + 0x00004000) | 0) >> 15) << 16 >> 16;
    rr1 -= L_CODE + 1;
  }

  const pRrRef1 = (L_CODE - 1) * L_CODE; /* rr[L_CODE-1] */
  for (dec = 1; dec < L_CODE; dec += 2) {
    rr1 = pRrRef1 + (L_CODE - 1 - dec);
    let rr2 = (L_CODE - 1 - dec) * L_CODE + (L_CODE - 1);
    let rr3 = (L_CODE - 1 - (dec + 1)) * L_CODE + (L_CODE - 1);
    s = 0;
    s2 = 0;
    let pSign1 = L_CODE - 1;
    let pSign2 = L_CODE - 1 - dec;
    pH2 = 0;
    pH = dec; /* &h2[dec] */

    for (let i = L_CODE - dec - 1; i !== 0; i--) {
      s = amrnb_fxp_mac_16_by_16bb(h2[pH2], h2[pH++], s);
      s2 = amrnb_fxp_mac_16_by_16bb(h2[pH2++], h2[pH], s2);
      tmp1 = (((s + 0x00004000) | 0) >> 15) << 16 >> 16;
      tmp11 = (((s2 + 0x00004000) | 0) >> 15) << 16 >> 16;
      tmp2 = (sign[pSign1] * sign[pSign2--]) >> 15;
      tmp22 = (sign[pSign1--] * sign[pSign2]) >> 15;
      rr[rr2] = ((tmp1 * tmp2) >> 15) << 16 >> 16;
      rr[rr1--] = rr[rr2];
      rr[rr1] = ((tmp11 * tmp22) >> 15) << 16 >> 16;
      rr[rr3] = rr[rr1];
      rr1 -= L_CODE;
      rr2 -= L_CODE + 1;
      rr3 -= L_CODE + 1;
    }
    s = amrnb_fxp_mac_16_by_16bb(h2[pH2], h2[pH], s);
    tmp1 = (((s + 0x00004000) | 0) >> 15) << 16 >> 16;
    tmp2 = (sign[pSign1] * sign[pSign2]) >> 15;
    rr[rr1] = ((tmp1 * tmp2) >> 15) << 16 >> 16;
    rr[rr2] = rr[rr1];
    rr1 -= L_CODE + 1;
    rr2 -= L_CODE + 1;
  }
}

const corHxY32 = new Int32Array(L_CODE);

/** cor_h_x.cpp cor_h_x: NB_TRACK=5, STEP=5 fixed variant */
export function cor_h_x(h, hOff, x, xOff, dn, dnOff, sf, pOverflow) {
  let s;
  const y32 = corHxY32;
  let max;
  let tot;

  tot = 5;
  for (let k = 0; k < NB_TRACK; k++) {
    max = 0;
    for (let i = k; i < L_CODE; i += STEP) {
      s = 0;
      let pX = xOff + i;
      let pPtr = hOff;
      for (let j = (L_CODE - i - 1) >> 1; j !== 0; j--) {
        s = (s + ((x[pX++] * h[pPtr++]) << 1)) | 0;
        s = (s + ((x[pX++] * h[pPtr++]) << 1)) | 0;
      }
      s = (s + ((x[pX++] * h[pPtr++]) << 1)) | 0;
      if (!((L_CODE - i) & 1)) {
        s = (s + ((x[pX++] * h[pPtr++]) << 1)) | 0;
      }
      y32[i] = s;
      if (s < 0) {
        s = -s;
      }
      if (s > max) {
        max = s;
      }
    }
    tot = (tot + (max >> 1)) | 0;
  }

  const j = (norm_l(tot) - sf) << 16 >> 16;
  let pPtr = dnOff;
  let pY32 = 0;
  for (let i = L_CODE >> 1; i !== 0; i--) {
    s = L_shl(y32[pY32++], j, pOverflow);
    dn[pPtr++] = ((s + 0x00008000) | 0) >> 16;
    s = L_shl(y32[pY32++], j, pOverflow);
    dn[pPtr++] = ((s + 0x00008000) | 0) >> 16;
  }
}

const corHx2Y32 = new Int32Array(L_CODE);

/** cor_h_x2.cpp cor_h_x2: parameterized nb_track/step variant */
export function cor_h_x2(h, hOff, x, xOff, dn, dnOff, sf, nb_track, step, pOverflow) {
  let s;
  const y32 = corHx2Y32;
  let max;
  let tot;

  tot = LOG2_OF_32;
  for (let k = 0; k < nb_track; k++) {
    max = 0;
    for (let i = k; i < L_CODE; i += step) {
      s = 0;
      for (let j = i; j < L_CODE; j++) {
        s = amrnb_fxp_mac_16_by_16bb(x[xOff + j], h[hOff + j - i], s);
      }
      s = s << 1;
      y32[i] = s;
      s = L_abs(s);
      if (s > max) {
        max = s;
      }
    }
    tot = (tot + (max >> 1)) | 0;
  }

  const j = (norm_l(tot) - sf) << 16 >> 16;
  for (let i = 0; i < L_CODE; i++) {
    dn[dnOff + i] = pv_round(L_shl(y32[i], j, pOverflow), pOverflow);
  }
}

/** set_sign.cpp set_sign */
export function set_sign(dn, dnOff, sign, signOff, dn2, dn2Off, n) {
  let val, min;
  let pos = 0;

  /* set sign according to dn[] */
  for (let i = L_CODE - 1; i >= 0; i--) {
    val = dn[dnOff + i];
    if (val >= 0) {
      sign[signOff + i] = 32767;
    } else {
      sign[signOff + i] = -32767;
      val = negate(val);
      dn[dnOff + i] = val; /* modify dn[] according to the fixed sign */
    }
    dn2[dn2Off + i] = val;
  }

  /* keep 8-n maximum positions/8 of each track and store it in dn2[] */
  for (let i = 0; i < NB_TRACK; i++) {
    for (let k = 0; k < 8 - n; k++) {
      min = 0x7fff;
      for (let j = i; j < L_CODE; j += STEP) {
        if (dn2[dn2Off + j] >= 0) {
          if (dn2[dn2Off + j] < min) {
            min = dn2[dn2Off + j];
            pos = j;
          }
        }
      }
      dn2[dn2Off + pos] = -1;
    }
  }
}

const ssEn = new Int16Array(L_CODE);

/** set_sign.cpp set_sign12k2 */
export function set_sign12k2(dn, dnOff, cn, cnOff, sign, signOff,
  pos_max, pos_maxOff, nb_track, ipos, iposOff, step, pOverflow) {
  let val;
  let cor;
  let k_cn, k_dn;
  let max, max_of_all;
  let pos = 0;
  const en = ssEn;
  let s, t, L_temp;

  /* calculate energy for normalization of cn[] and dn[] */
  s = 256;
  t = 256;
  let pCn = cnOff;
  let pDn = dnOff;
  for (let i = L_CODE; i !== 0; i--) {
    val = cn[pCn++];
    s = L_mac(s, val, val, pOverflow);
    val = dn[pDn++];
    t = (t + ((val * val) << 1)) | 0;
  }
  s = Inv_sqrt(s, pOverflow);
  k_cn = ((L_shl(s, 5, pOverflow) >> 16) << 16) >> 16;
  t = Inv_sqrt(t, pOverflow);
  k_dn = ((t >> 11) << 16) >> 16;

  pCn = cnOff + L_CODE - 1;
  let pSign = signOff + L_CODE - 1;
  let pEn = L_CODE - 1;
  for (let i = L_CODE - 1; i >= 0; i--) {
    L_temp = (k_cn * cn[pCn--]) << 1;
    val = dn[dnOff + i];
    s = L_mac(L_temp, k_dn, val, pOverflow);
    L_temp = L_shl(s, 10, pOverflow);
    cor = pv_round(L_temp, pOverflow);

    if (cor >= 0) {
      sign[pSign--] = 32767; /* sign = +1 */
    } else {
      sign[pSign--] = -32767; /* sign = -1 */
      cor = negate(cor);
      dn[dnOff + i] = negate(val); /* modify dn[] according to fixed sign */
    }
    en[pEn--] = cor;
  }

  max_of_all = -1;
  for (let i = 0; i < nb_track; i++) {
    max = -1;
    for (let j = i; j < L_CODE; j += step) {
      cor = en[j];
      if (cor > max) {
        max = cor;
        pos = j;
      }
    }
    /* store maximum correlation position */
    pos_max[pos_maxOff + i] = pos;
    if (max > max_of_all) {
      max_of_all = max;
      /* starting position for i0 */
      ipos[iposOff + 0] = i;
    }
  }

  /* Set starting position of each pulse */
  pos = ipos[iposOff + 0];
  ipos[iposOff + nb_track] = pos;
  for (let i = 1; i < nb_track; i++) {
    pos++;
    if (pos >= nb_track) {
      pos = 0;
    }
    ipos[iposOff + i] = pos;
    ipos[iposOff + i + nb_track] = pos;
  }
}
