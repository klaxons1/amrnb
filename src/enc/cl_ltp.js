/*
 * Closed-loop pitch (adaptive codebook) analysis, ported from
 * opencore-amr 0.1.6 enc/src/cl_ltp.cpp (clLtpState, cl_ltp).
 * Active implementation transcribed line by line.
 */
import { MAX_16 } from '../common/basicop.js';
import { Pred_lt_3or6 } from '../common/filters.js';
import { L_SUBFR, GP_CLIP, MR122, MR475, MR515 } from '../common/cnst.js';
import { Pitch_frState, Pitch_fr, Convolve } from './pitch_fr.js';
import { check_gp_clipping } from './pitch_ol.js';
import { G_pitch, q_gain_pitch } from './gains.js';

/** cl_ltp.h clLtpState */
export class clLtpState {
  constructor() {
    this.pitchSt = new Pitch_frState();
  }

  /** cl_ltp.cpp cl_ltp_reset */
  reset() {
    this.pitchSt.reset();
    return 0;
  }
}

const clT0 = new Int16Array(1);
const clT0frac = new Int16Array(1);
const clResu3 = new Int16Array(1);
const clIndex = new Int16Array(1);
const clGainPit = new Int16Array(1);

/**
 * cl_ltp.cpp cl_ltp.
 * exc is the excitation buffer with excOff at the current subframe start.
 * anap is a cursor object { arr, off } into the analysis-params array.
 * T0/T0_frac/gain_pit/gp_limit are 1-element Int16Array outs.
 */
export function cl_ltp(clSt, tonSt, mode, frameOffset, T_op, T_opOff, h1, h1Off,
  exc, excOff, res2, res2Off, xn, xnOff, lsp_flag, xn2, xn2Off, yl, ylOff,
  T0, T0_frac, gain_pit, g_coeff, g_coeffOff, anap, gp_limit, pOverflow) {
  let L_temp;
  let resu3;   /* flag for upsample resolution */
  let gpc_flag;
  let temp;

  /* Closed-loop fractional pitch search */
  T0[0] = Pitch_fr(clSt.pitchSt, mode, T_op, T_opOff, exc, excOff, xn, xnOff,
    h1, h1Off, L_SUBFR, frameOffset, clT0frac, clResu3, clIndex, pOverflow);
  T0_frac[0] = clT0frac[0];
  resu3 = clResu3[0];

  anap.arr[anap.off++] = clIndex[0];

  /* find unity gain pitch excitation (adaptive codebook entry) with
     fractional interpolation; filtered pitch exc yl = exc (*) h1;
     compute pitch gain limited between 0 and 1.2; update target. */
  Pred_lt_3or6(exc, excOff, T0[0], T0_frac[0], L_SUBFR, resu3, pOverflow);

  Convolve(exc, excOff, h1, h1Off, yl, ylOff, L_SUBFR);

  /* gain_pit is Q14 for all modes */
  gain_pit[0] = G_pitch(mode, xn, xnOff, yl, ylOff, g_coeff, g_coeffOff,
    L_SUBFR, pOverflow);

  /* check if the pitch gain should be limited due to resonance in LPC */
  gpc_flag = 0;
  gp_limit[0] = MAX_16;
  if (lsp_flag !== 0 && gain_pit[0] > GP_CLIP) {
    gpc_flag = check_gp_clipping(tonSt, gain_pit[0], pOverflow);
  }

  /* special for MR475/MR515: limit gain to 0.85 for better bit-error
     behaviour in the decoder */
  if (mode === MR475 || mode === MR515) {
    gain_pit[0] = gain_pit[0] > 13926 ? 13926 : gain_pit[0];
    if (gpc_flag !== 0) {
      gp_limit[0] = GP_CLIP;
    }
  } else {
    if (gpc_flag !== 0) {
      gp_limit[0] = GP_CLIP;
      gain_pit[0] = GP_CLIP;
    }
    /* For MR122, gain_pit is quantized here and not in gainQuant */
    if (mode === MR122) {
      clGainPit[0] = gain_pit[0];
      anap.arr[anap.off++] = q_gain_pitch(MR122, gp_limit[0], clGainPit,
        null, null, pOverflow);
      gain_pit[0] = clGainPit[0];
    }
  }

  temp = gain_pit[0];

  /* update target vector and evaluate LTP residual */
  for (let i = 0; i < L_SUBFR; i++) {
    L_temp = (yl[ylOff + i] * temp) >> 14;
    xn2[xn2Off + i] = (xn[xnOff + i] - ((L_temp << 16) >> 16)) << 16 >> 16;
    L_temp = (exc[excOff + i] * temp) >> 14;
    res2[res2Off + i] = (res2[res2Off + i] - ((L_temp << 16) >> 16)) << 16 >> 16;
  }
}
