/*
 * Depth-first pulse search engine shared by MR102 (8 pulses) and MR122
 * (10 pulses), ported from opencore-amr 0.1.6 enc/src/s10_8pf.cpp
 * (search_10and8i40). Active implementation transcribed line by line.
 *
 * The C matrix rr[L_CODE][L_CODE] is a flat Int16Array indexed rr[i*L_CODE+j].
 */
import { L_CODE, NB_TRACK, NB_TRACK_MR102 } from '../common/cnst.js';

const s108Temp1 = new Int16Array(2 * L_CODE);
const s108Index = new Int16Array(10);

/** s10_8pf.cpp search_10and8i40 (pOverflow intentionally unused) */
export function search_10and8i40(nbPulse, step, nbTracks, dn, rr,
  ipos, pos_max, codvec, pOverflow) {
  let i0, i1, i2, i3, i4, i5, i6, i7, i9;
  let pos, ia, ib;
  let psk;
  let sq, sq2;
  let alpk, alp, alp_16;
  let s, alp0, alp1, alp2;
  let gsmefrFlag;
  const temp1 = s108Temp1;
  let p_temp1;
  let p_temp2; /* row base index into rr */
  let ps2, ps1, ps, ps0;
  const index = s108Index;

  gsmefrFlag = nbPulse === 10 ? 1 : 0;

  i0 = pos_max[ipos[0]];
  index[0] = i0;
  psk = -1;
  alpk = 1;
  for (let i = 0; i < nbPulse; i++) {
    codvec[i] = i;
  }

  for (let i = 1; i < nbTracks; i++) {
    i1 = pos_max[ipos[1]];
    index[1] = i1;
    ps0 = (dn[i0] + dn[i1]) << 16 >> 16;
    alp0 = rr[i0 * L_CODE + i0] << 12;
    alp0 = (alp0 + (rr[i1 * L_CODE + i1] << 12)) | 0;
    alp0 = (alp0 + (rr[i0 * L_CODE + i1] << 13)) | 0;
    alp0 = (alp0 + 0x00008000) | 0;

    /* precompute temp1[] for the i2/i3 pair */
    p_temp1 = 0;
    for (i3 = ipos[3]; i3 < L_CODE; i3 += step) {
      p_temp2 = i3 * L_CODE;
      s = rr[p_temp2 + i3] >> 1;
      s = (s + rr[p_temp2 + i0]) | 0;
      s = (s + rr[p_temp2 + i1]) | 0;
      temp1[p_temp1++] = (ps0 + dn[i3]) << 16 >> 16;
      temp1[p_temp1++] = (((s + 2) | 0) >> 2) << 16 >> 16;
    }

    sq = -1;
    alp = 1;
    ps = 0;
    ia = ipos[2];
    ib = ipos[3];
    s = alp0 >> 12;
    for (let j = ipos[2]; j < L_CODE; j += step) {
      p_temp2 = j * L_CODE;
      alp1 = (s + rr[p_temp2 + j]) >> 1;
      alp1 = (alp1 + rr[p_temp2 + i0]) | 0;
      alp1 = (alp1 + rr[p_temp2 + i1]) | 0;
      p_temp1 = 0;
      ps1 = dn[j];
      for (i3 = ipos[3]; i3 < L_CODE; i3 += step) {
        ps2 = (ps1 + temp1[p_temp1++]) << 16 >> 16;
        sq2 = ((ps2 * ps2) >> 15) << 16 >> 16;
        alp2 = (alp1 + rr[p_temp2 + i3]) >> 2;
        alp2 = (alp2 + temp1[p_temp1++]) >> 1; /* alp2 is always > 0 */
        if (sq2 * alp > sq * alp2) {
          sq = sq2;
          ps = ps2;
          alp = (alp2 << 16) >> 16;
          ia = j;
          ib = i3;
        }
      }
    }
    i2 = ia;
    i3 = ib;
    index[2] = ia;
    index[3] = ib;

    /* precompute temp1[] for the i4/i5 pair */
    alp0 = ((alp << 15) + 0x00008000) | 0;
    p_temp1 = 0;
    for (i5 = ipos[5]; i5 < L_CODE; i5 += step) {
      p_temp2 = i5 * L_CODE;
      s = rr[p_temp2 + i5] >> 1;
      s = (s + rr[p_temp2 + i0]) | 0;
      s = (s + rr[p_temp2 + i1]) | 0;
      s = (s + rr[p_temp2 + i2]) | 0;
      s = (s + rr[p_temp2 + i3]) | 0;
      temp1[p_temp1++] = (ps + dn[i5]) << 16 >> 16;
      temp1[p_temp1++] = (((s + 2) | 0) >> 2) << 16 >> 16;
    }

    sq = -1;
    alp = 1;
    ps = 0;
    ia = ipos[4];
    ib = ipos[5];
    for (let j = ipos[4]; j < L_CODE; j += step) {
      p_temp2 = j * L_CODE;
      alp1 = (alp0 + (rr[p_temp2 + j] << 11)) | 0;
      alp1 = (alp1 + (rr[p_temp2 + i0] << 12)) | 0;
      alp1 = (alp1 + (rr[p_temp2 + i1] << 12)) | 0;
      alp1 = (alp1 + (rr[p_temp2 + i2] << 12)) | 0;
      alp1 = (alp1 + (rr[p_temp2 + i3] << 12)) | 0;
      p_temp1 = 0;
      ps1 = dn[j];
      for (i5 = ipos[5]; i5 < L_CODE; i5 += step) {
        ps2 = (ps1 + temp1[p_temp1++]) << 16 >> 16;
        alp2 = (alp1 + (rr[p_temp2 + i5] << 12)) | 0;
        alp_16 = (((alp2 + (temp1[p_temp1++] << 14)) | 0) >> 16) << 16 >> 16;
        sq2 = ((ps2 * ps2) >> 15) << 16 >> 16;
        if (sq2 * alp > sq * alp_16) {
          sq = sq2;
          ps = ps2;
          alp = alp_16;
          ia = j;
          ib = i5;
        }
      }
    }
    i4 = ia;
    i5 = ib;
    index[4] = ia;
    index[5] = ib;

    /* precompute temp1[] for the i6/i7 pair */
    alp0 = ((alp << 15) + 0x00008000) | 0;
    p_temp1 = 0;
    for (i7 = ipos[7]; i7 < L_CODE; i7 += step) {
      s = rr[i7 * L_CODE + i7] >> 1;
      s = (s + rr[i0 * L_CODE + i7]) | 0;
      s = (s + rr[i1 * L_CODE + i7]) | 0;
      s = (s + rr[i2 * L_CODE + i7]) | 0;
      s = (s + rr[i3 * L_CODE + i7]) | 0;
      s = (s + rr[i4 * L_CODE + i7]) | 0;
      s = (s + rr[i5 * L_CODE + i7]) | 0;
      temp1[p_temp1++] = (ps + dn[i7]) << 16 >> 16;
      temp1[p_temp1++] = (((s + 4) | 0) >> 3) << 16 >> 16;
    }

    sq = -1;
    alp = 1;
    ps = 0;
    ia = ipos[6];
    ib = ipos[7];
    for (let j = ipos[6]; j < L_CODE; j += step) {
      p_temp2 = j * L_CODE;
      alp1 = (alp0 + (rr[p_temp2 + j] << 10)) | 0;
      alp1 = (alp1 + (rr[p_temp2 + i0] << 11)) | 0;
      alp1 = (alp1 + (rr[p_temp2 + i1] << 11)) | 0;
      alp1 = (alp1 + (rr[p_temp2 + i2] << 11)) | 0;
      alp1 = (alp1 + (rr[p_temp2 + i3] << 11)) | 0;
      alp1 = (alp1 + (rr[p_temp2 + i4] << 11)) | 0;
      alp1 = (alp1 + (rr[p_temp2 + i5] << 11)) | 0;
      p_temp1 = 0;
      ps1 = dn[j];
      for (i7 = ipos[7]; i7 < L_CODE; i7 += step) {
        ps2 = (ps1 + temp1[p_temp1++]) << 16 >> 16;
        alp2 = (alp1 + (rr[p_temp2 + i7] << 11)) | 0;
        alp_16 = (((alp2 + (temp1[p_temp1++] << 14)) | 0) >> 16) << 16 >> 16;
        sq2 = ((ps2 * ps2) >> 15) << 16 >> 16;
        if (sq2 * alp > sq * alp_16) {
          sq = sq2;
          ps = ps2;
          alp = alp_16;
          ia = j;
          ib = i7;
        }
      }
    }
    i6 = ia;
    i7 = ib;
    index[6] = ia;
    index[7] = ib;

    if (gsmefrFlag !== 0) {
      /* precompute temp1[] for the i8/i9 pair (MR122) */
      alp0 = ((alp << 15) + 0x00008000) | 0;
      p_temp1 = 0;
      for (i9 = ipos[9]; i9 < L_CODE; i9 += step) {
        s = rr[i9 * L_CODE + i9] >> 1;
        s = (s + rr[i0 * L_CODE + i9]) | 0;
        s = (s + rr[i1 * L_CODE + i9]) | 0;
        s = (s + rr[i2 * L_CODE + i9]) | 0;
        s = (s + rr[i3 * L_CODE + i9]) | 0;
        s = (s + rr[i4 * L_CODE + i9]) | 0;
        s = (s + rr[i5 * L_CODE + i9]) | 0;
        s = (s + rr[i6 * L_CODE + i9]) | 0;
        s = (s + rr[i7 * L_CODE + i9]) | 0;
        temp1[p_temp1++] = (ps + dn[i9]) << 16 >> 16;
        temp1[p_temp1++] = (((s + 4) | 0) >> 3) << 16 >> 16;
      }

      sq = -1;
      alp = 1;
      ps = 0;
      ia = ipos[8];
      ib = ipos[9];
      for (let j = ipos[8]; j < L_CODE; j += step) {
        p_temp2 = j * L_CODE;
        alp1 = (alp0 + (rr[p_temp2 + j] << 9)) | 0;
        alp1 = (alp1 + (rr[i0 * L_CODE + j] << 10)) | 0;
        alp1 = (alp1 + (rr[i1 * L_CODE + j] << 10)) | 0;
        alp1 = (alp1 + (rr[i2 * L_CODE + j] << 10)) | 0;
        alp1 = (alp1 + (rr[i3 * L_CODE + j] << 10)) | 0;
        alp1 = (alp1 + (rr[i4 * L_CODE + j] << 10)) | 0;
        alp1 = (alp1 + (rr[i5 * L_CODE + j] << 10)) | 0;
        alp1 = (alp1 + (rr[i6 * L_CODE + j] << 10)) | 0;
        alp1 = (alp1 + (rr[i7 * L_CODE + j] << 10)) | 0;
        p_temp1 = 0;
        ps1 = dn[j];
        for (i9 = ipos[9]; i9 < L_CODE; i9 += step) {
          ps2 = (ps1 + temp1[p_temp1++]) << 16 >> 16;
          sq2 = ((ps2 * ps2) >> 15) << 16 >> 16;
          alp2 = (alp1 + (rr[p_temp2 + i9] << 10)) | 0;
          alp_16 = (((alp2 + (temp1[p_temp1++] << 13)) | 0) >> 16) << 16 >> 16;
          if (sq2 * alp > sq * alp_16) {
            sq = sq2;
            ps = ps2;
            alp = alp_16;
            ia = j;
            ib = i9;
          }
        }
      }
      index[8] = ia;
      index[9] = ib;
    }

    if (alpk * sq > psk * alp) {
      psk = sq;
      alpk = alp;
      if (gsmefrFlag !== 0) {
        for (let m = 0; m < 2 * NB_TRACK; m++) codvec[m] = index[m];
      } else {
        for (let m = 0; m < 2 * NB_TRACK_MR102; m++) codvec[m] = index[m];
      }
    }

    /* rotate ipos[1..nbPulse-1] */
    pos = ipos[1];
    for (let j = 1, k = 2; k < nbPulse; j++, k++) {
      ipos[j] = ipos[k];
    }
    ipos[nbPulse - 1] = pos;
  }
}
