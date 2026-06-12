/*
 * Background noise source characteristic detector, ported from
 * opencore-amr 0.1.6 dec/src/bgnscd.cpp.
 * Active implementation transcribed line by line.
 */
import { MAX_32, MAX_16, MIN_16, L_add } from '../common/basicop.js';
import { gmed_n } from '../common/mathops.js';
import { L_FRAME } from '../common/cnst.js';

const L_ENERGYHIST = 60;
const FRAMEENERGYLIMIT = 17578; /* 150 */
const LOWERNOISELIMIT = 20;     /*   5 */
const UPPERNOISELIMIT = 1953;   /*  50 */

/** bgnscd.h Bgn_scdState */
export class Bgn_scdState {
  constructor() {
    this.frameEnergyHist = new Int16Array(L_ENERGYHIST);
    this.bgHangover = 0;
  }

  /** bgnscd.cpp Bgn_scd_reset */
  reset() {
    this.frameEnergyHist.fill(0);
    this.bgHangover = 0;
    return 0;
  }
}

/**
 * bgnscd.cpp Bgn_scd: returns inbgNoise flag.
 * @param {Int16Array} voicedHangover 1-element in/out
 */
export function Bgn_scd(st, ltpGainHist, ltpGainHistOff, speech, speechOff,
  voicedHangover, pOverflow) {
  let prevVoiced, inbgNoise;
  let temp;
  let ltpLimit, frameEnergyMin;
  let currEnergy, noiseFloor, maxEnergy, maxEnergyLastPart;
  let s, L_temp;

  /* Update the inBackgroundNoise flag (valid for use in next frame if BFI);
     it works as an energy detector floating on top, not as good as a VAD. */
  s = 0;
  for (let i = L_FRAME - 1; i >= 0; i--) {
    L_temp = speech[speechOff + i] * speech[speechOff + i];
    if (L_temp !== 0x40000000) {
      L_temp = L_temp << 1;
    } else {
      L_temp = MAX_32;
    }
    s = L_add(s, L_temp, pOverflow);
  }

  /* s is a sum of squares, so don't need to check for neg overflow */
  if (s > 0x1fffffff) {
    currEnergy = MAX_16;
  } else {
    currEnergy = ((s >> 14) << 16) >> 16;
  }

  frameEnergyMin = 32767;
  for (let i = L_ENERGYHIST - 1; i >= 0; i--) {
    if (st.frameEnergyHist[i] < frameEnergyMin) {
      frameEnergyMin = st.frameEnergyHist[i];
    }
  }

  /* Frame Energy Margin of 16 */
  L_temp = frameEnergyMin << 4;
  if (L_temp !== ((L_temp << 16) >> 16)) {
    if (L_temp > 0) {
      noiseFloor = MAX_16;
    } else {
      noiseFloor = MIN_16;
    }
  } else {
    noiseFloor = (L_temp << 16) >> 16;
  }

  maxEnergy = st.frameEnergyHist[0];
  for (let i = L_ENERGYHIST - 5; i >= 1; i--) {
    if (maxEnergy < st.frameEnergyHist[i]) {
      maxEnergy = st.frameEnergyHist[i];
    }
  }

  maxEnergyLastPart = st.frameEnergyHist[(2 * L_ENERGYHIST / 3) | 0];
  for (let i = ((2 * L_ENERGYHIST / 3) | 0) + 1; i < L_ENERGYHIST; i++) {
    if (maxEnergyLastPart < st.frameEnergyHist[i]) {
      maxEnergyLastPart = st.frameEnergyHist[i];
    }
  }

  /* Mark as noise if under current noise limit
     OR if the maximum energy is below the upper limit */
  if (maxEnergy > LOWERNOISELIMIT
    && currEnergy < FRAMEENERGYLIMIT
    && currEnergy > LOWERNOISELIMIT
    && (currEnergy < noiseFloor || maxEnergyLastPart < UPPERNOISELIMIT)) {
    if (st.bgHangover + 1 > 30) {
      st.bgHangover = 30;
    } else {
      st.bgHangover += 1;
    }
  } else {
    st.bgHangover = 0;
  }

  /* make final decision about frame state, act somewhat cautiously */
  inbgNoise = st.bgHangover > 1 ? 1 : 0;

  for (let i = 0; i < L_ENERGYHIST - 1; i++) {
    st.frameEnergyHist[i] = st.frameEnergyHist[i + 1];
  }
  st.frameEnergyHist[L_ENERGYHIST - 1] = currEnergy;

  /* prepare for voicing decision; tighten threshold after some time in noise */
  if (st.bgHangover > 15) {
    ltpLimit = 16383; /* 1.00 Q14 */
  } else if (st.bgHangover > 8) {
    ltpLimit = 15565; /* 0.95 Q14 */
  } else {
    ltpLimit = 13926; /* 0.85 Q14 */
  }

  /* weak sort of voicing indication */
  prevVoiced = 0;
  if (gmed_n(ltpGainHist, ltpGainHistOff + 4, 5) > ltpLimit) {
    prevVoiced = 1;
  }

  if (st.bgHangover > 20) {
    if (gmed_n(ltpGainHist, ltpGainHistOff, 9) > ltpLimit) {
      prevVoiced = 1;
    } else {
      prevVoiced = 0;
    }
  }

  if (prevVoiced) {
    voicedHangover[0] = 0;
  } else {
    temp = voicedHangover[0] + 1;
    if (temp > 10) {
      voicedHangover[0] = 10;
    } else {
      voicedHangover[0] = temp;
    }
  }

  return inbgNoise;
}
