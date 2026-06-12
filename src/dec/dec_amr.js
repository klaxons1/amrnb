/*
 * Main AMR-NB decoder, ported from opencore-amr 0.1.6 dec/src/dec_amr.cpp
 * (Decoder_amrState, Decoder_amr_init/reset, Decoder_amr).
 * Active implementation transcribed line by line.
 *
 * C pointer st->exc = st->old_exc + PIT_MAX + L_INTERPOL becomes the constant
 * offset EXC into st.old_exc.
 */
import {
  MAX_16, MIN_16, mult, add_16, shl, pv_round,
  L_mult, L_mac, L_shl, L_shr,
} from '../common/basicop.js';
import { sqrt_l_exp } from '../common/mathops.js';
import { Lsf_lsp } from '../common/lsp_fns.js';
import { Int_lpc_1and3, Int_lpc_1to3 } from '../common/int_lpc.js';
import { Syn_filt, Pred_lt_3or6 } from '../common/filters.js';
import {
  M, MP1, L_FRAME, L_FRAME_BY2, L_SUBFR, PIT_MIN, PIT_MAX, PIT_MIN_MR122,
  L_INTERPOL, SHARPMIN, SHARPMAX,
  MR475, MR515, MR59, MR67, MR74, MR795, MR102, MR122, MRDTX,
  RX_SPEECH_BAD, RX_SPEECH_DEGRADED, RX_NO_DATA, RX_ONSET,
} from '../common/cnst.js';
import { prmno, bitno } from '../common/tables/index.js';
import { gc_predState } from '../common/gc_pred.js';
import { D_plsfState, D_plsf_3, D_plsf_5, Int_lsf } from './d_plsf.js';
import {
  d_gain_pitch, d_gain_code, Dec_gain, Dec_lag3, Dec_lag6,
} from './dec_gain.js';
import {
  decode_2i40_9bits, decode_2i40_11bits, decode_3i40_14bits,
  decode_4i40_17bits, dec_8i40_31bits, dec_10i40_35bits,
} from './d_pulse.js';
import {
  ec_gain_pitchState, ec_gain_codeState, ec_gain_pitch, ec_gain_code,
  ec_gain_pitch_update, ec_gain_code_update, lsp_avgState, lsp_avg,
} from './ec_gains.js';
import { Cb_gain_averageState, Cb_gain_average } from './c_g_aver.js';
import { agc2 } from './agc.js';
import { ph_dispState, ph_disp, ph_disp_lock, ph_disp_release } from './ph_disp.js';
import { Bgn_scdState, Bgn_scd } from './bgnscd.js';
import { Ex_ctrl } from './pstfilt.js';
import { build_CN_param } from './post_pre.js';
import {
  dtx_decState, dtx_dec, dtx_dec_activity_update, rx_dtx_handler,
  SPEECH, DTX, DTX_MUTE,
} from './dtx_dec.js';

const EXC_ENERGY_HIST_LEN = 9;
const LTP_GAIN_HISTORY_LEN = 9;
const EXC = PIT_MAX + L_INTERPOL; /* st->exc offset into old_exc */

/* debug hook used while bisecting divergences against the C decoder */
export let TRACE = null;
export function setTrace(fn) {
  TRACE = fn;
}

/** dec_amr.h Decoder_amrState */
export class Decoder_amrState {
  constructor() {
    this.old_exc = new Int16Array(L_SUBFR + PIT_MAX + L_INTERPOL);
    this.lsp_old = new Int16Array(M);
    this.mem_syn = new Int16Array(M);
    this.sharp = 0;
    this.old_T0 = 0;
    this.prev_bf = 0;
    this.prev_pdf = 0;
    this.state = 0;
    this.excEnergyHist = new Int16Array(EXC_ENERGY_HIST_LEN);
    this.T0_lagBuff = 0;
    this.inBackgroundNoise = 0;
    this.voicedHangover = new Int16Array(1); /* C Word16, passed by address */
    this.ltpGainHistory = new Int16Array(LTP_GAIN_HISTORY_LEN);
    this.background_state = new Bgn_scdState();
    this.nodataSeed = new Int16Array(1); /* C Word16, passed by address */
    this.Cb_gain_averState = new Cb_gain_averageState();
    this.lsp_avg_st = new lsp_avgState();
    this.lsfState = new D_plsfState();
    this.ec_gain_p_st = new ec_gain_pitchState();
    this.ec_gain_c_st = new ec_gain_codeState();
    this.pred_state = new gc_predState();
    this.ph_disp_st = new ph_dispState();
    this.dtxDecoderState = new dtx_decState();
    this.overflow = new Int32Array(1);
    this.init();
  }

  /** dec_amr.cpp Decoder_amr_init */
  init() {
    this.T0_lagBuff = 40;
    this.inBackgroundNoise = 0;
    this.voicedHangover[0] = 0;
    this.overflow[0] = 0;
    this.ltpGainHistory.fill(0);

    this.lsfState.reset();
    this.ec_gain_p_st.reset();
    this.ec_gain_c_st.reset();
    this.Cb_gain_averState.reset();
    this.lsp_avg_st.reset();
    this.background_state.reset();
    this.ph_disp_st.reset();
    this.dtxDecoderState.reset();
    this.pred_state.reset();

    Decoder_amr_reset(this, MR475);
    return 0;
  }
}

/** dec_amr.cpp Decoder_amr_reset */
export function Decoder_amr_reset(state, mode) {
  /* Static vectors to zero (only old_exc head, like C memset of
     PIT_MAX + L_INTERPOL entries) */
  state.old_exc.fill(0, 0, PIT_MAX + L_INTERPOL);

  if (mode !== MRDTX) {
    state.mem_syn.fill(0);
  }

  /* initialize pitch sharpening */
  state.sharp = SHARPMIN;
  state.old_T0 = 40;

  /* Initialize overflow Flag */
  state.overflow[0] = 0;

  if (mode !== MRDTX) {
    state.lsp_old.set([30000, 26000, 21000, 15000, 8000, 0,
      -8000, -15000, -21000, -26000]);
  }

  /* Initialize memories of bad frame handling */
  state.prev_bf = 0;
  state.prev_pdf = 0;
  state.state = 0;

  state.T0_lagBuff = 40;
  state.inBackgroundNoise = 0;
  state.voicedHangover[0] = 0;
  if (mode !== MRDTX) {
    state.excEnergyHist.fill(0);
  }
  state.ltpGainHistory.fill(0);
  state.Cb_gain_averState.reset();
  if (mode !== MRDTX) {
    state.lsp_avg_st.reset();
  }

  state.lsfState.reset();
  state.ec_gain_p_st.reset();
  state.ec_gain_c_st.reset();
  if (mode !== MRDTX) {
    state.pred_state.reset();
  }
  state.background_state.reset();
  state.nodataSeed[0] = 21845;
  state.ph_disp_st.reset();
  if (mode !== MRDTX) {
    state.dtxDecoderState.reset();
  }
  return 0;
}

/* scratch buffers (single-threaded decoder, mirrors C stack arrays) */
const daLspNew = new Int16Array(M);
const daLspMid = new Int16Array(M);
const daPrevLsf = new Int16Array(M);
const daLsfI = new Int16Array(M);
const daCode = new Int16Array(L_SUBFR);
const daExcp = new Int16Array(L_SUBFR);
const daExcEnhanced = new Int16Array(L_SUBFR);
const daT0 = new Int16Array(1);
const daT0frac = new Int16Array(1);
const daGainPit = new Int16Array(1);
const daGainCode = new Int16Array(1);
const daSqrtExp = new Int16Array(1);

/** dec_amr.cpp Decoder_amr */
export function Decoder_amr(st, mode, parm, parmOff, frame_type,
  synth, synthOff, A_t, A_tOff) {
  const lsp_new = daLspNew;
  const lsp_mid = daLspMid;
  const prev_lsf = daPrevLsf;
  const lsf_i = daLsfI;
  const code = daCode;
  const excp = daExcp;
  const exc_enhanced = daExcEnhanced;

  let i;
  let T0 = 0;
  let T0_frac;
  let index;
  let index_mr475 = 0;
  let gain_pit;
  let gain_code;
  let gain_code_mix;
  let pit_sharp;
  let pit_flag;
  let pitch_fac;
  let t0_min;
  let t0_max;
  let delta_frc_low;
  let delta_frc_range;
  let tmp_shift;
  let temp;
  let L_temp;
  let flag4;
  let carefulFlag;
  let excEnergy;
  let subfrNr;
  let evenSubfr = 0;
  let bfi = 0;  /* bad frame indication flag */
  let pdfi = 0; /* potential degraded bad frame flag */
  const pOverflow = st.overflow;
  let pParm = parmOff;

  /* find the new DTX state: SPEECH OR DTX */
  const newDTXState = rx_dtx_handler(st.dtxDecoderState, frame_type, pOverflow);

  /* DTX actions */
  if (newDTXState !== SPEECH) {
    Decoder_amr_reset(st, MRDTX);

    dtx_dec(st.dtxDecoderState, st.mem_syn, 0, st.lsfState, st.pred_state,
      st.Cb_gain_averState, newDTXState, mode, parm, pParm,
      synth, synthOff, A_t, A_tOff, pOverflow);

    /* update average lsp */
    Lsf_lsp(st.lsfState.past_lsf_q, 0, st.lsp_old, 0, M, pOverflow);
    lsp_avg(st.lsp_avg_st, st.lsfState.past_lsf_q, 0, pOverflow);

    st.dtxDecoderState.dtxGlobalState = newDTXState;
    return;
  }

  /* SPEECH action state machine */
  if (frame_type === RX_SPEECH_BAD || frame_type === RX_NO_DATA
    || frame_type === RX_ONSET) {
    bfi = 1;
    if (frame_type === RX_NO_DATA || frame_type === RX_ONSET) {
      build_CN_param(st.nodataSeed, prmno[mode], bitno[mode],
        parm, pParm, pOverflow);
    }
  } else if (frame_type === RX_SPEECH_DEGRADED) {
    pdfi = 1;
  }

  if (bfi !== 0) {
    st.state += 1;
  } else if (st.state === 6) {
    st.state = 5;
  } else {
    st.state = 0;
  }

  if (st.state > 6) {
    st.state = 6;
  }

  /* If this frame is the first speech frame after CNI period, set the BFH
     state machine to an appropriate state depending on whether there was
     DTX muting before start of speech or not. */
  if (st.dtxDecoderState.dtxGlobalState === DTX) {
    st.state = 5;
    st.prev_bf = 0;
  } else if (st.dtxDecoderState.dtxGlobalState === DTX_MUTE) {
    st.state = 5;
    st.prev_bf = 1;
  }

  /* save old LSFs for CB gain smoothing */
  prev_lsf.set(st.lsfState.past_lsf_q);

  /* decode LSF parameters and generate interpolated lpc coefficients
     for the 4 subframes */
  if (mode !== MR122) {
    D_plsf_3(st.lsfState, mode, bfi, parm, pParm, lsp_new, 0, pOverflow);
    pParm += 3;
    Int_lpc_1to3(st.lsp_old, 0, lsp_new, 0, A_t, A_tOff, pOverflow);
  } else {
    D_plsf_5(st.lsfState, bfi, parm, pParm, lsp_mid, 0, lsp_new, 0, pOverflow);
    pParm += 5;
    Int_lpc_1and3(st.lsp_old, 0, lsp_mid, 0, lsp_new, 0, A_t, A_tOff, pOverflow);
  }

  /* update the LSPs for the next frame */
  for (i = 0; i < M; i++) {
    st.lsp_old[i] = lsp_new[i];
  }

  /*--------------------------------------------------------------------*
   * Loop for every subframe in the analysis frame                      *
   *--------------------------------------------------------------------*/
  let Az = A_tOff; /* pointer to interpolated LPC parameters */

  evenSubfr = 0;
  subfrNr = -1;
  for (let i_subfr = 0; i_subfr < L_FRAME; i_subfr += L_SUBFR) {
    subfrNr += 1;
    evenSubfr = 1 - evenSubfr;

    /* flag for first and 3th subframe */
    pit_flag = i_subfr;
    if (i_subfr === L_FRAME_BY2) {
      if (mode !== MR475 && mode !== MR515) {
        pit_flag = 0;
      }
    }

    /* pitch index */
    index = parm[pParm++];

    /* decode pitch lag and find adaptive codebook vector */
    if (mode !== MR122) {
      /* flag4 indicates encoding with 4 bit resolution
         (MR475, MR515, MR59, MR67) */
      flag4 = 0;
      if (mode === MR475 || mode === MR515 || mode === MR59 || mode === MR67) {
        flag4 = 1;
      }

      /* get ranges for t0_min and t0_max (only needed in delta decoding) */
      delta_frc_low = 5;
      delta_frc_range = 9;
      if (mode === MR795) {
        delta_frc_low = 10;
        delta_frc_range = 19;
      }

      t0_min = (st.old_T0 - delta_frc_low) << 16 >> 16;
      if (t0_min < PIT_MIN) {
        t0_min = PIT_MIN;
      }
      t0_max = (t0_min + delta_frc_range) << 16 >> 16;
      if (t0_max > PIT_MAX) {
        t0_max = PIT_MAX;
        t0_min = (t0_max - delta_frc_range) << 16 >> 16;
      }

      Dec_lag3(index, t0_min, t0_max, pit_flag, st.old_T0,
        daT0, daT0frac, flag4, pOverflow);
      T0 = daT0[0];
      T0_frac = daT0frac[0];

      st.T0_lagBuff = T0;

      if (bfi !== 0) {
        if (st.old_T0 < PIT_MAX) {
          /* Graceful pitch degradation */
          st.old_T0 += 1;
        }
        T0 = st.old_T0;
        T0_frac = 0;

        if (st.inBackgroundNoise !== 0 && st.voicedHangover[0] > 4
          && (mode === MR475 || mode === MR515 || mode === MR59)) {
          T0 = st.T0_lagBuff;
        }
      }

      Pred_lt_3or6(st.old_exc, EXC, T0, T0_frac, L_SUBFR, 1, pOverflow);
    } else {
      Dec_lag6(index, PIT_MIN_MR122, PIT_MAX, pit_flag, daT0, daT0frac, pOverflow);
      T0 = daT0[0];
      T0_frac = daT0frac[0];

      if (!(bfi === 0 && (pit_flag === 0 || index < 61))) {
        st.T0_lagBuff = T0;
        T0 = st.old_T0;
        T0_frac = 0;
      }

      Pred_lt_3or6(st.old_exc, EXC, T0, T0_frac, L_SUBFR, 0, pOverflow);
    }
    daT0[0] = T0; /* keep scratch in sync for Dec_lag6 2nd/4th subframe input */

    /* (MR122 only: decode pitch gain), decode innovative codebook,
       set pitch sharpening factor */
    gain_pit = 0;
    if (mode === MR475 || mode === MR515) {
      index = parm[pParm++]; /* index of position */
      i = parm[pParm++];     /* signs */

      decode_2i40_9bits(subfrNr, i, index, code, 0, pOverflow);

      L_temp = st.sharp << 1;
      if (L_temp !== ((L_temp << 16) >> 16)) {
        pit_sharp = st.sharp > 0 ? MAX_16 : MIN_16;
      } else {
        pit_sharp = (L_temp << 16) >> 16;
      }
    } else if (mode === MR59) {
      index = parm[pParm++];
      i = parm[pParm++];

      decode_2i40_11bits(i, index, code, 0);

      L_temp = st.sharp << 1;
      if (L_temp !== ((L_temp << 16) >> 16)) {
        pit_sharp = st.sharp > 0 ? MAX_16 : MIN_16;
      } else {
        pit_sharp = (L_temp << 16) >> 16;
      }
    } else if (mode === MR67) {
      index = parm[pParm++];
      i = parm[pParm++];

      decode_3i40_14bits(i, index, code, 0);

      L_temp = st.sharp << 1;
      if (L_temp !== ((L_temp << 16) >> 16)) {
        pit_sharp = st.sharp > 0 ? MAX_16 : MIN_16;
      } else {
        pit_sharp = (L_temp << 16) >> 16;
      }
    } else if (mode <= MR795) {
      /* MR74, MR795 */
      index = parm[pParm++];
      i = parm[pParm++];

      decode_4i40_17bits(i, index, code, 0);

      L_temp = st.sharp << 1;
      if (L_temp !== ((L_temp << 16) >> 16)) {
        pit_sharp = st.sharp > 0 ? MAX_16 : MIN_16;
      } else {
        pit_sharp = (L_temp << 16) >> 16;
      }
    } else if (mode === MR102) {
      dec_8i40_31bits(parm, pParm, code, 0, pOverflow);
      pParm += 7;

      L_temp = st.sharp << 1;
      if (L_temp !== ((L_temp << 16) >> 16)) {
        pit_sharp = st.sharp > 0 ? MAX_16 : MIN_16;
      } else {
        pit_sharp = (L_temp << 16) >> 16;
      }
    } else {
      /* MR122 */
      index = parm[pParm++];
      if (bfi !== 0) {
        ec_gain_pitch(st.ec_gain_p_st, st.state, daGainPit, pOverflow);
      } else {
        daGainPit[0] = d_gain_pitch(mode, index);
      }
      ec_gain_pitch_update(st.ec_gain_p_st, bfi, st.prev_bf, daGainPit, pOverflow);
      gain_pit = daGainPit[0];

      dec_10i40_35bits(parm, pParm, code, 0);
      pParm += 10;

      /* pit_sharp = gain_pit; if (pit_sharp > 1.0) pit_sharp = 1.0 */
      L_temp = gain_pit << 1;
      if (L_temp !== ((L_temp << 16) >> 16)) {
        pit_sharp = gain_pit > 0 ? MAX_16 : MIN_16;
      } else {
        pit_sharp = (L_temp << 16) >> 16;
      }
    }

    /* Add the pitch contribution to code[] */
    for (i = T0; i < L_SUBFR; i++) {
      temp = mult(code[i - T0], pit_sharp, pOverflow);
      code[i] = add_16(code[i], temp, pOverflow);
    }

    /* Decode codebook gain (MR122) or both pitch gain and codebook gain
       (all others); update pitch sharpening "sharp" with quantized gain_pit */
    if (mode === MR475) {
      /* read and decode pitch and code gain */
      if (evenSubfr !== 0) {
        index_mr475 = parm[pParm++]; /* index of gain(s) */
      }

      if (bfi === 0) {
        Dec_gain(st.pred_state, mode, index_mr475, code, 0, evenSubfr,
          daGainPit, daGainCode, pOverflow);
      } else {
        ec_gain_pitch(st.ec_gain_p_st, st.state, daGainPit, pOverflow);
        ec_gain_code(st.ec_gain_c_st, st.pred_state, st.state, daGainCode, pOverflow);
      }
      ec_gain_pitch_update(st.ec_gain_p_st, bfi, st.prev_bf, daGainPit, pOverflow);
      ec_gain_code_update(st.ec_gain_c_st, bfi, st.prev_bf, daGainCode, pOverflow);
      gain_pit = daGainPit[0];
      gain_code = daGainCode[0];

      pit_sharp = gain_pit;
      if (pit_sharp > SHARPMAX) {
        pit_sharp = SHARPMAX;
      }
    } else if (mode <= MR74 || mode === MR102) {
      /* read and decode pitch and code gain */
      index = parm[pParm++]; /* index of gain(s) */

      if (bfi === 0) {
        Dec_gain(st.pred_state, mode, index, code, 0, evenSubfr,
          daGainPit, daGainCode, pOverflow);
      } else {
        ec_gain_pitch(st.ec_gain_p_st, st.state, daGainPit, pOverflow);
        ec_gain_code(st.ec_gain_c_st, st.pred_state, st.state, daGainCode, pOverflow);
      }
      ec_gain_pitch_update(st.ec_gain_p_st, bfi, st.prev_bf, daGainPit, pOverflow);
      ec_gain_code_update(st.ec_gain_c_st, bfi, st.prev_bf, daGainCode, pOverflow);
      gain_pit = daGainPit[0];
      gain_code = daGainCode[0];

      pit_sharp = gain_pit;
      if (pit_sharp > SHARPMAX) {
        pit_sharp = SHARPMAX;
      }

      if (mode === MR102) {
        if (st.old_T0 > L_SUBFR + 5) {
          if (pit_sharp < 0) {
            pit_sharp = ~(~pit_sharp >> 2);
          } else {
            pit_sharp = pit_sharp >> 2;
          }
        }
      }
    } else {
      /* read and decode pitch gain */
      index = parm[pParm++]; /* index of gain(s) */

      if (mode === MR795) {
        /* decode pitch gain */
        if (bfi !== 0) {
          ec_gain_pitch(st.ec_gain_p_st, st.state, daGainPit, pOverflow);
        } else {
          daGainPit[0] = d_gain_pitch(mode, index);
        }
        ec_gain_pitch_update(st.ec_gain_p_st, bfi, st.prev_bf, daGainPit, pOverflow);
        gain_pit = daGainPit[0];

        /* read and decode code gain */
        index = parm[pParm++];
        if (bfi === 0) {
          d_gain_code(st.pred_state, mode, index, code, 0, daGainCode, pOverflow);
        } else {
          ec_gain_code(st.ec_gain_c_st, st.pred_state, st.state, daGainCode, pOverflow);
        }
        ec_gain_code_update(st.ec_gain_c_st, bfi, st.prev_bf, daGainCode, pOverflow);
        gain_code = daGainCode[0];

        pit_sharp = gain_pit;
        if (pit_sharp > SHARPMAX) {
          pit_sharp = SHARPMAX;
        }
      } else {
        /* MR122 */
        if (bfi === 0) {
          d_gain_code(st.pred_state, mode, index, code, 0, daGainCode, pOverflow);
        } else {
          ec_gain_code(st.ec_gain_c_st, st.pred_state, st.state, daGainCode, pOverflow);
        }
        ec_gain_code_update(st.ec_gain_c_st, bfi, st.prev_bf, daGainCode, pOverflow);
        gain_code = daGainCode[0];

        pit_sharp = gain_pit;
      }
    }

    /* store pitch sharpening for next subframe (do not update sharpening
       in even subframes for MR475) */
    if (mode !== MR475 || evenSubfr === 0) {
      st.sharp = gain_pit;
      if (st.sharp > SHARPMAX) {
        st.sharp = SHARPMAX;
      }
    }

    pit_sharp = shl(pit_sharp, 1, pOverflow);
    if (pit_sharp > 16384) {
      for (i = 0; i < L_SUBFR; i++) {
        temp = mult(st.old_exc[EXC + i], pit_sharp, pOverflow);
        L_temp = L_mult(temp, gain_pit, pOverflow);
        if (mode === MR122) {
          if (L_temp < 0) {
            L_temp = ~(~L_temp >> 1);
          } else {
            L_temp = L_temp >> 1;
          }
        }
        excp[i] = pv_round(L_temp, pOverflow);
      }
    }

    /* Store list of LTP gains needed in the SCD */
    if (bfi === 0) {
      for (i = 0; i < 8; i++) {
        st.ltpGainHistory[i] = st.ltpGainHistory[i + 1];
      }
      st.ltpGainHistory[8] = gain_pit;
    }

    /* Limit gain_pit if in background noise and BFI for MR475, MR515, MR59 */
    if ((st.prev_bf !== 0 || bfi !== 0) && st.inBackgroundNoise !== 0
      && (mode === MR475 || mode === MR515 || mode === MR59)) {
      if (gain_pit > 12288) {
        /* if (gain_pit > 0.75) in Q14 */
        gain_pit = ((((gain_pit - 12288) >> 1) + 12288) << 16) >> 16;
        /* gain_pit = (gain_pit-0.75)/2.0 + 0.75; */
      }
      if (gain_pit > 14745) {
        /* if (gain_pit > 0.90) in Q14 */
        gain_pit = 14745;
      }
    }

    /* Calculate CB mixed gain */
    Int_lsf(prev_lsf, 0, st.lsfState.past_lsf_q, 0, i_subfr, lsf_i, 0, pOverflow);
    gain_code_mix = Cb_gain_average(st.Cb_gain_averState, mode, gain_code,
      lsf_i, 0, st.lsp_avg_st.lsp_meanSave, 0, bfi, st.prev_bf, pdfi,
      st.prev_pdf, st.inBackgroundNoise, st.voicedHangover[0], pOverflow);

    /* make sure that MR74, MR795, MR122 have original code_gain */
    if (mode > MR67 && mode !== MR102) {
      /* MR74, MR795, MR122 */
      gain_code_mix = gain_code;
    }

    /* Find the total excitation; find synthesis speech for st->exc[] */
    if (mode <= MR102) {
      /* MR475, MR515, MR59, MR67, MR74, MR795, MR102 */
      pitch_fac = gain_pit;
      tmp_shift = 1;
    } else {
      /* MR122 */
      if (gain_pit < 0) {
        pitch_fac = ~(~gain_pit >> 1);
      } else {
        pitch_fac = gain_pit >> 1;
      }
      tmp_shift = 2;
    }

    /* copy unscaled LTP excitation to exc_enhanced (used in phase
       dispersion below) and compute total excitation for LTP feedback */
    for (i = 0; i < L_SUBFR; i++) {
      exc_enhanced[i] = st.old_exc[EXC + i];
      /* st->exc[i] = gain_pit*st->exc[i] + gain_code*code[i]; */
      L_temp = L_mult(st.old_exc[EXC + i], pitch_fac, pOverflow);
      L_temp = L_mac(L_temp, code[i], gain_code, pOverflow);
      L_temp = L_shl(L_temp, tmp_shift, pOverflow); /* Q16 */
      st.old_exc[EXC + i] = pv_round(L_temp, pOverflow);
    }

    /* Adaptive phase dispersion */
    ph_disp_release(st.ph_disp_st); /* free phase dispersion adaption */

    if ((mode === MR475 || mode === MR515 || mode === MR59)
      && st.voicedHangover[0] > 3 && st.inBackgroundNoise !== 0 && bfi !== 0) {
      ph_disp_lock(st.ph_disp_st); /* always use full phase disp. */
    }

    /* apply phase dispersion to innovation (if enabled) and
       compute total excitation for synthesis part */
    ph_disp(st.ph_disp_st, mode, exc_enhanced, 0, gain_code_mix, gain_pit,
      code, 0, pitch_fac, tmp_shift, pOverflow);

    /* The excitation control module is active during BFI;
       conceal drops in signal energy if in bg noise. */
    L_temp = 0;
    for (i = 0; i < L_SUBFR; i++) {
      L_temp = L_mac(L_temp, exc_enhanced[i], exc_enhanced[i], pOverflow);
    }

    /* excEnergy = sqrt(L_temp) in Q0 */
    if (L_temp < 0) {
      L_temp = ~(~L_temp >> 1);
    } else {
      L_temp = L_temp >> 1;
    }
    L_temp = sqrt_l_exp(L_temp, daSqrtExp, pOverflow);
    temp = daSqrtExp[0];
    /* To cope with 16-bit and scaling in ex_ctrl() */
    L_temp = L_shr(L_temp, ((temp >> 1) + 15) << 16 >> 16, pOverflow);
    if (L_temp < 0) {
      excEnergy = (~(~L_temp >> 2) << 16) >> 16;
    } else {
      excEnergy = ((L_temp >> 2) << 16) >> 16;
    }

    if ((mode === MR475 || mode === MR515 || mode === MR59)
      && st.voicedHangover[0] > 5 && st.inBackgroundNoise !== 0 && st.state < 4
      && ((pdfi !== 0 && st.prev_pdf !== 0) || bfi !== 0 || st.prev_bf !== 0)) {
      carefulFlag = 0;
      if (pdfi !== 0 && bfi === 0) {
        carefulFlag = 1;
      }

      Ex_ctrl(exc_enhanced, 0, excEnergy, st.excEnergyHist, 0,
        st.voicedHangover[0], st.prev_bf, carefulFlag, pOverflow);
    }

    if (!(st.inBackgroundNoise !== 0 && (bfi !== 0 || st.prev_bf !== 0)
      && st.state < 4)) {
      /* Update energy history for all modes */
      for (i = 0; i < 8; i++) {
        st.excEnergyHist[i] = st.excEnergyHist[i + 1];
      }
      st.excEnergyHist[8] = excEnergy;
    }
    /* Excitation control module end */

    if (pit_sharp > 16384) {
      for (i = 0; i < L_SUBFR; i++) {
        excp[i] = add_16(excp[i], exc_enhanced[i], pOverflow);
      }
      agc2(exc_enhanced, 0, excp, 0, L_SUBFR, pOverflow);
      pOverflow[0] = 0;
      Syn_filt(A_t, Az, excp, 0, synth, synthOff + i_subfr, L_SUBFR,
        st.mem_syn, 0, 0);
    } else {
      pOverflow[0] = 0;
      Syn_filt(A_t, Az, exc_enhanced, 0, synth, synthOff + i_subfr, L_SUBFR,
        st.mem_syn, 0, 0);
    }

    if (pOverflow[0] !== 0) {
      /* Test for overflow */
      for (i = PIT_MAX + L_INTERPOL + L_SUBFR - 1; i >= 0; i--) {
        if (st.old_exc[i] < 0) {
          st.old_exc[i] = ~(~st.old_exc[i] >> 2);
        } else {
          st.old_exc[i] = st.old_exc[i] >> 2;
        }
      }

      for (i = L_SUBFR - 1; i >= 0; i--) {
        if (exc_enhanced[i] < 0) {
          exc_enhanced[i] = ~(~exc_enhanced[i] >> 2);
        } else {
          exc_enhanced[i] = exc_enhanced[i] >> 2;
        }
      }

      Syn_filt(A_t, Az, exc_enhanced, 0, synth, synthOff + i_subfr, L_SUBFR,
        st.mem_syn, 0, 1);
    } else {
      for (i = 0; i < M; i++) {
        st.mem_syn[i] = synth[synthOff + i_subfr + L_SUBFR - M + i];
      }
    }

    /* Update signal for next frame: shift st->old_exc[] left by L_SUBFR */
    st.old_exc.copyWithin(0, L_SUBFR, L_SUBFR + PIT_MAX + L_INTERPOL);

    if (TRACE) {
      TRACE(`S${i_subfr / 40} T0=${T0} frac=${T0_frac} gp=${gain_pit} gc=${gain_code} gcm=${gain_code_mix} ps=${pit_sharp} exc0=${exc_enhanced[0]} exc1=${exc_enhanced[1]} syn0=${synth[synthOff + i_subfr]} syn1=${synth[synthOff + i_subfr + 1]}`);
    }

    /* interpolated LPC parameters for next subframe */
    Az += MP1;

    /* store T0 for next subframe */
    st.old_T0 = T0;
  }

  /* Call the Source Characteristic Detector which updates
     st->inBackgroundNoise and st->voicedHangover */
  st.inBackgroundNoise = Bgn_scd(st.background_state, st.ltpGainHistory, 0,
    synth, synthOff, st.voicedHangover, pOverflow);

  dtx_dec_activity_update(st.dtxDecoderState, st.lsfState.past_lsf_q, 0,
    synth, synthOff, pOverflow);

  /* store bfi for next subframe */
  st.prev_bf = bfi;
  st.prev_pdf = pdfi;

  /* Calculate the LSF averages on the eight previous frames */
  lsp_avg(st.lsp_avg_st, st.lsfState.past_lsf_q, 0, pOverflow);

  st.dtxDecoderState.dtxGlobalState = newDTXState;
}
