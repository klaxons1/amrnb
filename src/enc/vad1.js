/*
 * Voice Activity Detection, ported from opencore-amr 0.1.6 enc/src/vad1.cpp
 * (+ common/include/cnst_vad.h).
 * Active implementations transcribed line by line. Float-derived macro
 * values were verified against the C compiler (truncation toward zero).
 */
import {
  sub, add_16, mult, mult_r, shl, shr, abs_s, norm_s, div_s, pv_round,
  L_mac, L_msu, L_add, L_sub, L_shl,
} from '../common/basicop.js';

const FRAME_LEN = 160;
const COMPLEN = 9;
const INV_COMPLEN = 3641;
const LOOKAHEAD = 40;

const UNIRSHFT = 6;
const TONE_THR = 21298;       /* (Word16)(0.65*MAX_16) */

const ALPHA_UP1 = 1638;
const ALPHA_DOWN1 = 2097;
const ALPHA_UP2 = 491;
const ALPHA_DOWN2 = 1867;
const ALPHA3 = 1638;
const ALPHA4 = 3276;
const ALPHA5 = 16383;

const VAD_THR_HIGH = 1260;
const VAD_THR_LOW = 720;
const VAD_P1 = 0;
const VAD_SLOPE = -2808;      /* (Word16)(MAX_16*(720-1260)/6300.f) */

const STAT_COUNT = 20;
const CAD_MIN_STAT_COUNT = 5;
const STAT_THR_LEVEL = 184;
const STAT_THR = 1000;

const NOISE_MIN = 40;
const NOISE_MAX = 16000;
const NOISE_INIT = 150;

const HANG_NOISE_THR = 100;
const BURST_LEN_HIGH_NOISE = 4;
const HANG_LEN_HIGH_NOISE = 7;
const BURST_LEN_LOW_NOISE = 5;
const HANG_LEN_LOW_NOISE = 4;

const VAD_POW_LOW = 15000;
const POW_PITCH_THR = 343040;
const POW_COMPLEX_THR = 15000;

const COEFF3 = 13363;
const COEFF5_1 = 21955;
const COEFF5_2 = 6390;

const CVAD_THRESH_ADAPT_HIGH = 19660; /* 0.6  */
const CVAD_THRESH_ADAPT_LOW = 16383;  /* 0.5  */
const CVAD_THRESH_IN_NOISE = 21298;   /* 0.65 */
const CVAD_THRESH_HANG = 22936;       /* 0.70 */
const CVAD_HANG_LIMIT = 100;
const CVAD_HANG_LENGTH = 250;
const CVAD_LOWPOW_RESET = 13106;      /* 0.40 */
const CVAD_MIN_CORR = 13106;          /* 0.40 */
const CVAD_BURST = 20;
const CVAD_ADAPT_SLOW = 655;          /* 1-0.98 */
const CVAD_ADAPT_FAST = 2621;         /* 1-0.92 */
const CVAD_ADAPT_REALLY_FAST = 6553;  /* 1-0.80 */

const LTHRESH = 4;
const NTHRESH = 4;

/** vad1.h vadState1 */
export class vadState1 {
  constructor() {
    this.bckr_est = new Int16Array(COMPLEN);
    this.ave_level = new Int16Array(COMPLEN);
    this.old_level = new Int16Array(COMPLEN);
    this.sub_level = new Int16Array(COMPLEN);
    this.a_data5 = [new Int16Array(2), new Int16Array(2), new Int16Array(2)];
    this.a_data3 = new Int16Array(5);
    this.burst_count = 0;
    this.hang_count = 0;
    this.stat_count = 0;
    this.vadreg = 0;
    this.pitch = 0;
    this.tone = 0;
    this.complex_high = 0;
    this.complex_low = 0;
    this.oldlag_count = 0;
    this.oldlag = 0;
    this.complex_hang_count = 0;
    this.complex_hang_timer = 0;
    this.best_corr_hp = 0;
    this.speech_vad_decision = 0;
    this.complex_warning = 0;
    this.sp_burst_count = 0;
    this.corr_hp_fast = 0;
    this.reset();
  }

  /** vad1.cpp vad1_reset */
  reset() {
    this.oldlag_count = 0;
    this.oldlag = 0;
    this.pitch = 0;
    this.tone = 0;
    this.complex_high = 0;
    this.complex_low = 0;
    this.complex_hang_timer = 0;
    this.vadreg = 0;
    this.stat_count = 0;
    this.burst_count = 0;
    this.hang_count = 0;
    this.complex_hang_count = 0;
    this.a_data5[0].fill(0);
    this.a_data5[1].fill(0);
    this.a_data5[2].fill(0);
    this.a_data3.fill(0);
    this.bckr_est.fill(NOISE_INIT);
    this.old_level.fill(NOISE_INIT);
    this.ave_level.fill(NOISE_INIT);
    this.sub_level.fill(0);
    this.best_corr_hp = CVAD_LOWPOW_RESET;
    this.speech_vad_decision = 0;
    this.complex_warning = 0;
    this.sp_burst_count = 0;
    this.corr_hp_fast = CVAD_LOWPOW_RESET;
    return 0;
  }
}

/** vad1.cpp first_filter_stage (static) */
function first_filter_stage(input, inOff, out, data, pOverflow) {
  let temp0, temp1, temp2, temp3;
  let data0 = data[0];
  let data1 = data[1];

  for (let i = 0; i < FRAME_LEN / 4; i++) {
    temp0 = ((COEFF5_1 * data0) >> 15) << 16 >> 16;
    temp1 = input[inOff + 4 * i] >> 2;
    temp0 = sub(temp1, temp0, pOverflow);

    temp1 = ((COEFF5_1 * temp0) >> 15) << 16 >> 16;
    temp1 = add_16(data0, temp1, pOverflow);

    temp3 = ((COEFF5_2 * data1) >> 15) << 16 >> 16;
    temp2 = input[inOff + 4 * i + 1] >> 2;
    temp3 = sub(temp2, temp3, pOverflow);

    temp2 = ((COEFF5_2 * temp3) >> 15) << 16 >> 16;
    temp2 = add_16(data1, temp2, pOverflow);

    out[4 * i] = add_16(temp1, temp2, pOverflow);
    out[4 * i + 1] = sub(temp1, temp2, pOverflow);

    temp1 = ((COEFF5_1 * temp0) >> 15) << 16 >> 16;
    temp2 = input[inOff + 4 * i + 2] >> 2;
    data0 = sub(temp2, temp1, pOverflow);

    temp1 = ((COEFF5_1 * data0) >> 15) << 16 >> 16;
    temp1 = add_16(temp0, temp1, pOverflow);

    data1 = ((COEFF5_2 * temp3) >> 15) << 16 >> 16;
    temp2 = input[inOff + 4 * i + 3] >> 2;
    data1 = sub(temp2, data1, pOverflow);

    temp2 = ((COEFF5_2 * data1) >> 15) << 16 >> 16;
    temp2 = add_16(temp3, temp2, pOverflow);

    out[4 * i + 2] = add_16(temp1, temp2, pOverflow);
    out[4 * i + 3] = sub(temp1, temp2, pOverflow);
  }

  data[0] = data0;
  data[1] = data1;
}

/** vad1.cpp filter5 (static): in0/in1 are (array, index) cells */
function filter5(buf, i0, i1, data, pOverflow) {
  let temp0, temp1, temp2;

  temp0 = mult(COEFF5_1, data[0], pOverflow);
  temp0 = sub(buf[i0], temp0, pOverflow);
  temp1 = mult(COEFF5_1, temp0, pOverflow);
  temp1 = add_16(data[0], temp1, pOverflow);
  data[0] = temp0;

  temp0 = mult(COEFF5_2, data[1], pOverflow);
  temp0 = sub(buf[i1], temp0, pOverflow);
  temp2 = mult(COEFF5_2, temp0, pOverflow);
  temp2 = add_16(data[1], temp2, pOverflow);
  data[1] = temp0;

  temp0 = add_16(temp1, temp2, pOverflow);
  buf[i0] = shr(temp0, 1, pOverflow);
  temp0 = sub(temp1, temp2, pOverflow);
  buf[i1] = shr(temp0, 1, pOverflow);
}

/** vad1.cpp filter3 (static): data is (array, index) cell */
function filter3(buf, i0, i1, dataArr, dataIdx, pOverflow) {
  let temp1, temp2;

  temp1 = mult(COEFF3, dataArr[dataIdx], pOverflow);
  temp1 = sub(buf[i1], temp1, pOverflow);
  temp2 = mult(COEFF3, temp1, pOverflow);
  temp2 = add_16(dataArr[dataIdx], temp2, pOverflow);
  dataArr[dataIdx] = temp1;

  temp1 = sub(buf[i0], temp2, pOverflow);
  buf[i1] = shr(temp1, 1, pOverflow);
  temp1 = add_16(buf[i0], temp2, pOverflow);
  buf[i0] = shr(temp1, 1, pOverflow);
}

/** vad1.cpp level_calculation (static): sub_level is (array, index) cell */
function level_calculation(data, sub_level, subIdx, count1, count2,
  ind_m, ind_a, scale, pOverflow) {
  let l_temp1 = 0;

  for (let i = count1; i < count2; i++) {
    l_temp1 = L_mac(l_temp1, 1, abs_s(data[ind_m * i + ind_a]), pOverflow);
  }

  let l_temp2 = L_add(l_temp1,
    L_shl(sub_level[subIdx], sub(16, scale, pOverflow), pOverflow), pOverflow);
  sub_level[subIdx] = ((L_shl(l_temp1, scale, pOverflow) >> 16) << 16) >> 16;

  for (let i = 0; i < count1; i++) {
    l_temp2 = L_mac(l_temp2, 1, abs_s(data[ind_m * i + ind_a]), pOverflow);
  }
  return ((L_shl(l_temp2, scale, pOverflow) >> 16) << 16) >> 16;
}

const fbTmpBuf = new Int16Array(FRAME_LEN);

/** vad1.cpp filter_bank (static) */
function filter_bank(st, input, inOff, level, pOverflow) {
  const tmp_buf = fbTmpBuf;

  /* calculate the filter bank */
  first_filter_stage(input, inOff, tmp_buf, st.a_data5[0], pOverflow);

  for (let i = 0; i < FRAME_LEN / 4; i++) {
    filter5(tmp_buf, 4 * i, 4 * i + 2, st.a_data5[1], pOverflow);
    filter5(tmp_buf, 4 * i + 1, 4 * i + 3, st.a_data5[2], pOverflow);
  }
  for (let i = 0; i < FRAME_LEN / 8; i++) {
    filter3(tmp_buf, 8 * i, 8 * i + 4, st.a_data3, 0, pOverflow);
    filter3(tmp_buf, 8 * i + 2, 8 * i + 6, st.a_data3, 1, pOverflow);
    filter3(tmp_buf, 8 * i + 3, 8 * i + 7, st.a_data3, 4, pOverflow);
  }
  for (let i = 0; i < FRAME_LEN / 16; i++) {
    filter3(tmp_buf, 16 * i, 16 * i + 8, st.a_data3, 2, pOverflow);
    filter3(tmp_buf, 16 * i + 4, 16 * i + 12, st.a_data3, 3, pOverflow);
  }

  /* calculate levels in each frequency band */
  /* 3000 - 4000 Hz */
  level[8] = level_calculation(tmp_buf, st.sub_level, 8, FRAME_LEN / 4 - 8,
    FRAME_LEN / 4, 4, 1, 15, pOverflow);
  /* 2500 - 3000 Hz */
  level[7] = level_calculation(tmp_buf, st.sub_level, 7, FRAME_LEN / 8 - 4,
    FRAME_LEN / 8, 8, 7, 16, pOverflow);
  /* 2000 - 2500 Hz */
  level[6] = level_calculation(tmp_buf, st.sub_level, 6, FRAME_LEN / 8 - 4,
    FRAME_LEN / 8, 8, 3, 16, pOverflow);
  /* 1500 - 2000 Hz */
  level[5] = level_calculation(tmp_buf, st.sub_level, 5, FRAME_LEN / 8 - 4,
    FRAME_LEN / 8, 8, 2, 16, pOverflow);
  /* 1000 - 1500 Hz */
  level[4] = level_calculation(tmp_buf, st.sub_level, 4, FRAME_LEN / 8 - 4,
    FRAME_LEN / 8, 8, 6, 16, pOverflow);
  /* 750 - 1000 Hz */
  level[3] = level_calculation(tmp_buf, st.sub_level, 3, FRAME_LEN / 16 - 2,
    FRAME_LEN / 16, 16, 4, 16, pOverflow);
  /* 500 - 750 Hz */
  level[2] = level_calculation(tmp_buf, st.sub_level, 2, FRAME_LEN / 16 - 2,
    FRAME_LEN / 16, 16, 12, 16, pOverflow);
  /* 250 - 500 Hz */
  level[1] = level_calculation(tmp_buf, st.sub_level, 1, FRAME_LEN / 16 - 2,
    FRAME_LEN / 16, 16, 8, 16, pOverflow);
  /* 0 - 250 Hz */
  level[0] = level_calculation(tmp_buf, st.sub_level, 0, FRAME_LEN / 16 - 2,
    FRAME_LEN / 16, 16, 0, 16, pOverflow);
}

/** vad1.cpp update_cntrl (static) */
function update_cntrl(st, level, pOverflow) {
  let temp;
  let stat_rat;
  let exp;
  let num;
  let denom;
  let alpha;

  /* if there has been highband correlation for some time,
     make sure that the VAD update speed is low for a while */
  if (st.complex_warning !== 0) {
    if (st.stat_count < CAD_MIN_STAT_COUNT) {
      st.stat_count = CAD_MIN_STAT_COUNT;
    }
  }

  /* if fullband pitch or tone have been detected for a while,
     initialize stat_count */
  if (((st.pitch & 0x6000) << 16 >> 16) === 0x6000
    || ((st.tone & 0x7c00) << 16 >> 16) === 0x7c00) {
    st.stat_count = STAT_COUNT;
  } else if ((st.vadreg & 0x7f80) === 0) {
    /* if 8 last vad-decisions have been "0", reinitialize stat_count */
    st.stat_count = STAT_COUNT;
  } else {
    stat_rat = 0;
    for (let i = 0; i < COMPLEN; i++) {
      if (level[i] > st.ave_level[i]) {
        num = level[i];
        denom = st.ave_level[i];
      } else {
        num = st.ave_level[i];
        denom = level[i];
      }
      /* Limit minimum value of num and denom to STAT_THR_LEVEL */
      if (num < STAT_THR_LEVEL) {
        num = STAT_THR_LEVEL;
      }
      if (denom < STAT_THR_LEVEL) {
        denom = STAT_THR_LEVEL;
      }
      exp = norm_s(denom);
      denom = shl(denom, exp, pOverflow);

      /* stat_rat = num/denom * 64 */
      temp = shr(num, 1, pOverflow);
      temp = div_s(temp, denom);
      stat_rat = add_16(stat_rat,
        shr(temp, sub(8, exp, pOverflow), pOverflow), pOverflow);
    }

    /* compare stat_rat with a threshold and update stat_count */
    if (stat_rat > STAT_THR) {
      st.stat_count = STAT_COUNT;
    } else if ((st.vadreg & 0x4000) !== 0) {
      if (st.stat_count !== 0) {
        st.stat_count = sub(st.stat_count, 1, pOverflow);
      }
    }
  }

  /* Update average amplitude estimate for stationarity estimation */
  alpha = ALPHA4;
  if (st.stat_count === STAT_COUNT) {
    alpha = 32767;
  } else if ((st.vadreg & 0x4000) === 0) {
    alpha = ALPHA5;
  }

  for (let i = 0; i < COMPLEN; i++) {
    temp = sub(level[i], st.ave_level[i], pOverflow);
    temp = mult_r(alpha, temp, pOverflow);
    st.ave_level[i] = add_16(st.ave_level[i], temp, pOverflow);
  }
}

/** vad1.cpp hangover_addition (static) */
function hangover_addition(st, noise_level, low_power, pOverflow) {
  let hang_len;
  let burst_len;

  if (noise_level > HANG_NOISE_THR) {
    burst_len = BURST_LEN_HIGH_NOISE;
    hang_len = HANG_LEN_HIGH_NOISE;
  } else {
    burst_len = BURST_LEN_LOW_NOISE;
    hang_len = HANG_LEN_LOW_NOISE;
  }

  /* if the input power is lower than a threshold, clear counters and
     set VAD_flag to "0" — "fast exit" */
  if (low_power !== 0) {
    st.burst_count = 0;
    st.hang_count = 0;
    st.complex_hang_count = 0;
    st.complex_hang_timer = 0;
    return 0;
  }

  if (st.complex_hang_timer > CVAD_HANG_LIMIT) {
    if (st.complex_hang_count < CVAD_HANG_LENGTH) {
      st.complex_hang_count = CVAD_HANG_LENGTH;
    }
  }

  /* long time very complex signal override VAD output function */
  if (st.complex_hang_count !== 0) {
    st.burst_count = BURST_LEN_HIGH_NOISE;
    st.complex_hang_count = sub(st.complex_hang_count, 1, pOverflow);
    return 1;
  }

  /* let hp_corr work in from a noise_period indicated by the VAD */
  if ((st.vadreg & 0x3ff0) === 0 && st.corr_hp_fast > CVAD_THRESH_IN_NOISE) {
    return 1;
  }

  /* update the counters (hang_count, burst_count) */
  if ((st.vadreg & 0x4000) !== 0) {
    st.burst_count = add_16(st.burst_count, 1, pOverflow);
    if (st.burst_count >= burst_len) {
      st.hang_count = hang_len;
    }
    return 1;
  }

  st.burst_count = 0;
  if (st.hang_count > 0) {
    st.hang_count = sub(st.hang_count, 1, pOverflow);
    return 1;
  }

  return 0;
}

/** vad1.cpp noise_estimate_update (static) */
function noise_estimate_update(st, level, pOverflow) {
  let alpha_up;
  let alpha_down;
  let bckr_add;

  /* Control update of bckr_est[] */
  update_cntrl(st, level, pOverflow);

  /* Choose update speed */
  bckr_add = 2;
  if ((0x7800 & st.vadreg) === 0 && (st.pitch & 0x7800) === 0
    && st.complex_hang_count === 0) {
    alpha_up = ALPHA_UP1;
    alpha_down = ALPHA_DOWN1;
  } else if (st.stat_count === 0 && st.complex_hang_count === 0) {
    alpha_up = ALPHA_UP2;
    alpha_down = ALPHA_DOWN2;
  } else {
    alpha_up = 0;
    alpha_down = ALPHA3;
    bckr_add = 0;
  }

  /* Update noise estimate (bckr_est) */
  for (let i = 0; i < COMPLEN; i++) {
    let temp = sub(st.old_level[i], st.bckr_est[i], pOverflow);

    if (temp < 0) {
      /* update downwards */
      temp = mult_r(alpha_down, temp, pOverflow);
      temp = add_16(st.bckr_est[i], temp, pOverflow);
      st.bckr_est[i] = add_16(-2, temp, pOverflow);
      /* limit minimum value of the noise estimate to NOISE_MIN */
      if (st.bckr_est[i] < NOISE_MIN) {
        st.bckr_est[i] = NOISE_MIN;
      }
    } else {
      /* update upwards */
      temp = mult_r(alpha_up, temp, pOverflow);
      temp = add_16(st.bckr_est[i], temp, pOverflow);
      st.bckr_est[i] = add_16(bckr_add, temp, pOverflow);
      /* limit maximum value of the noise estimate to NOISE_MAX */
      if (st.bckr_est[i] > NOISE_MAX) {
        st.bckr_est[i] = NOISE_MAX;
      }
    }
  }

  /* Update signal levels of the previous frame (old_level) */
  for (let i = 0; i < COMPLEN; i++) {
    st.old_level[i] = level[i];
  }
}

/** vad1.cpp complex_estimate_adapt (static) */
function complex_estimate_adapt(st, low_power, pOverflow) {
  let alpha; /* Q15 */

  /* adapt speed on own state */
  if (st.best_corr_hp < st.corr_hp_fast) {
    /* decrease */
    if (st.corr_hp_fast < CVAD_THRESH_ADAPT_HIGH) {
      alpha = CVAD_ADAPT_FAST; /* low state */
    } else {
      alpha = CVAD_ADAPT_REALLY_FAST; /* high state */
    }
  } else {
    /* increase */
    if (st.corr_hp_fast < CVAD_THRESH_ADAPT_HIGH) {
      alpha = CVAD_ADAPT_FAST;
    } else {
      alpha = CVAD_ADAPT_SLOW;
    }
  }

  let L_tmp = st.corr_hp_fast << 16;
  L_tmp = L_msu(L_tmp, alpha, st.corr_hp_fast, pOverflow);
  L_tmp = L_mac(L_tmp, alpha, st.best_corr_hp, pOverflow);
  st.corr_hp_fast = pv_round(L_tmp, pOverflow); /* Q15 */

  if (st.corr_hp_fast < CVAD_MIN_CORR) {
    st.corr_hp_fast = CVAD_MIN_CORR;
  }

  if (low_power !== 0) {
    st.corr_hp_fast = CVAD_MIN_CORR;
  }
}

/** vad1.cpp complex_vad (static) */
function complex_vad(st, low_power, pOverflow) {
  st.complex_high = shr(st.complex_high, 1, pOverflow);
  st.complex_low = shr(st.complex_low, 1, pOverflow);

  if (low_power === 0) {
    if (st.corr_hp_fast > CVAD_THRESH_ADAPT_HIGH) {
      st.complex_high |= 0x4000;
    }
    if (st.corr_hp_fast > CVAD_THRESH_ADAPT_LOW) {
      st.complex_low |= 0x4000;
    }
  }

  if (st.corr_hp_fast > CVAD_THRESH_HANG) {
    st.complex_hang_timer = add_16(st.complex_hang_timer, 1, pOverflow);
  } else {
    st.complex_hang_timer = 0;
  }

  return (((st.complex_high & 0x7f80) << 16 >> 16) === 0x7f80
    || ((st.complex_low & 0x7fff) << 16 >> 16) === 0x7fff) ? 1 : 0;
}

/** vad1.cpp vad_decision (static) */
function vad_decision(st, level, pow_sum, pOverflow) {
  let snr_sum;
  let L_temp;
  let vad_thr;
  let temp;
  let noise_level;
  let low_power_flag;
  let temp1;

  /* Calculate squared sum of the input levels divided by
     the background noise components */
  L_temp = 0;
  for (let i = 0; i < COMPLEN; i++) {
    const exp = norm_s(st.bckr_est[i]);
    temp = shl(st.bckr_est[i], exp, pOverflow);
    temp = div_s(shr(level[i], 1, pOverflow), temp);
    temp = shl(temp, sub(exp, UNIRSHFT - 1, pOverflow), pOverflow);
    L_temp = L_mac(L_temp, temp, temp, pOverflow);
  }

  snr_sum = ((L_shl(L_temp, 6, pOverflow) >> 16) << 16) >> 16;
  snr_sum = mult(snr_sum, INV_COMPLEN, pOverflow);

  /* Calculate average level of estimated background noise */
  L_temp = 0;
  for (let i = 0; i < COMPLEN; i++) {
    L_temp = L_add(L_temp, st.bckr_est[i], pOverflow);
  }
  noise_level = ((L_shl(L_temp, 13, pOverflow) >> 16) << 16) >> 16;

  /* Calculate VAD threshold */
  temp1 = sub(noise_level, VAD_P1, pOverflow);
  temp1 = mult(VAD_SLOPE, temp1, pOverflow);
  vad_thr = add_16(temp1, VAD_THR_HIGH, pOverflow);
  if (vad_thr < VAD_THR_LOW) {
    vad_thr = VAD_THR_LOW;
  }

  /* Shift VAD decision register */
  st.vadreg = shr(st.vadreg, 1, pOverflow);

  /* Make intermediate VAD decision */
  if (snr_sum > vad_thr) {
    st.vadreg = (st.vadreg | 0x4000) << 16 >> 16;
  }

  /* check if the input power (pow_sum) is lower than a threshold */
  if (L_sub(pow_sum, VAD_POW_LOW, pOverflow) < 0) {
    low_power_flag = 1;
  } else {
    low_power_flag = 0;
  }

  /* update complex signal estimate st->corr_hp_fast and hangover
     reset timer */
  complex_estimate_adapt(st, low_power_flag, pOverflow);

  /* check multiple thresholds of the st->corr_hp_fast value */
  st.complex_warning = complex_vad(st, low_power_flag, pOverflow);

  /* Update speech subband vad background noise estimates */
  noise_estimate_update(st, level, pOverflow);

  /* Add speech and complex hangover and return speech VAD_flag */
  st.speech_vad_decision = hangover_addition(st, noise_level, low_power_flag, pOverflow);
  return st.speech_vad_decision;
}

/** vad1.cpp vad_complex_detection_update */
export function vad_complex_detection_update(st, best_corr_hp) {
  st.best_corr_hp = best_corr_hp;
}

/** vad1.cpp vad_tone_detection: set tone flag if pitch gain is high */
export function vad_tone_detection(st, t0, t1, pOverflow) {
  /* if (t0 > TONE_THR * t1) set tone flag */
  const temp = pv_round(t1, pOverflow);
  if (temp > 0 && L_msu(t0, temp, TONE_THR, pOverflow) > 0) {
    st.tone = (st.tone | 0x4000) << 16 >> 16;
  }
}

/** vad1.cpp vad_tone_detection_update */
export function vad_tone_detection_update(st, one_lag_per_frame, pOverflow) {
  /* Shift tone flags right by one bit */
  st.tone = shr(st.tone, 1, pOverflow);

  /* If open-loop lag is calculated only once in each frame, do extra update
     and assume that the other tone flag of the frame is one. */
  if (one_lag_per_frame !== 0) {
    st.tone = shr(st.tone, 1, pOverflow);
    st.tone = (st.tone | 0x2000) << 16 >> 16;
  }
}

/** vad1.cpp vad_pitch_detection */
export function vad_pitch_detection(st, T_op, T_opOff, pOverflow) {
  let lagcount = 0;
  let temp;

  for (let i = 0; i < 2; i++) {
    temp = sub(st.oldlag, T_op[T_opOff + i], pOverflow);
    temp = abs_s(temp);
    if (temp < LTHRESH) {
      lagcount += 1;
    }
    /* Save the current LTP lag */
    st.oldlag = T_op[T_opOff + i];
  }

  /* Make pitch decision */
  st.pitch = shr(st.pitch, 1, pOverflow);
  temp = add_16(st.oldlag_count, lagcount, pOverflow);
  if (temp >= NTHRESH) {
    st.pitch = (st.pitch | 0x4000) << 16 >> 16;
  }

  /* Update oldlagcount */
  st.oldlag_count = lagcount;
}

const vadLevel = new Int16Array(COMPLEN);

/** vad1.cpp vad1: main VAD; in_buf points at frame start (lookahead before) */
export function vad1(st, in_buf, in_bufOff, pOverflow) {
  const level = vadLevel;
  let pow_sum;

  /* Calculate power of the input frame. */
  pow_sum = 0;
  for (let i = 0; i < FRAME_LEN; i++) {
    pow_sum = L_mac(pow_sum, in_buf[in_bufOff + i - LOOKAHEAD],
      in_buf[in_bufOff + i - LOOKAHEAD], pOverflow);
  }

  /* If input power is very low, clear pitch flag of the current frame */
  if (L_sub(pow_sum, POW_PITCH_THR, pOverflow) < 0) {
    st.pitch = st.pitch & 0x3fff;
  }

  /* If input power is very low, clear complex flag of the "current" frame */
  if (L_sub(pow_sum, POW_COMPLEX_THR, pOverflow) < 0) {
    st.complex_low = st.complex_low & 0x3fff;
  }

  /* Run the filter bank which calculates signal levels at each band */
  filter_bank(st, in_buf, in_bufOff, level, pOverflow);

  return vad_decision(st, level, pow_sum, pOverflow);
}

export { CVAD_BURST };
