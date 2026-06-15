/*
 * Main AMR-NB encoder, ported from opencore-amr 0.1.6 enc/src/cod_amr.cpp
 * (cod_amrState, cod_amr_reset, cod_amr_first, cod_amr).
 * Active implementation transcribed line by line.
 *
 * C pointer aliases into the backing arrays become fixed offset constants
 * (e.g. st.speech is st.old_speech at offset SPEECH_OFF).
 */
import { Pred_lt_3or6 } from '../common/filters.js';
import {
  M, MP1, L_TOTAL, L_FRAME, L_FRAME_BY2, L_WINDOW, L_SUBFR, L_NEXT,
  PIT_MAX, L_INTERPOL, SHARPMIN, MR475, MR515, MRDTX,
} from '../common/cnst.js';
import { lpcState, lpc } from './lpc.js';
import { lspState, lsp_fn } from './q_plsf.js';
import { clLtpState, cl_ltp } from './cl_ltp.js';
import { gainQuantState, gainQuant } from './gain_q.js';
import {
  pitchOLWghtState, tonStabState, ol_ltp, check_lsp, update_gp_clipping,
} from './pitch_ol.js';
import { Convolve } from './pitch_fr.js';
import { vadState1, vad1, vad_pitch_detection } from './vad1.js';
import { dtx_encState, dtx_enc, dtx_buffer, tx_dtx_handler } from './dtx_enc.js';
import { subframePreProc, subframePostProc } from './sproc.js';
import { pre_big } from './pre_big.js';
import { cbsearch } from './cbsearch.js';

/* cod_amr.cpp gamma weighting tables */
const gamma1 = Int16Array.from([
  30802, 28954, 27217, 25584, 24049, 22606, 21250, 19975, 18777, 17650,
]);
const gamma1_12k2 = Int16Array.from([
  29491, 26542, 23888, 21499, 19349, 17414, 15672, 14105, 12694, 11425,
]);
const gamma2 = Int16Array.from([
  19661, 11797, 7078, 4247, 2548, 1529, 917, 550, 330, 198,
]);

/* backing-array sizes and pointer offsets */
const OLD_SPEECH_LEN = L_TOTAL;
const NEW_SPEECH_OFF = L_TOTAL - L_FRAME;          /* 160 */
const SPEECH_OFF = NEW_SPEECH_OFF - L_NEXT;        /* 120 */
const PWINDOW_OFF = L_TOTAL - L_WINDOW;            /* 80 */
const PWINDOW12_OFF = PWINDOW_OFF - L_NEXT;        /* 40 */
const OLD_WSP_LEN = L_FRAME + PIT_MAX;
const WSP_OFF = PIT_MAX;
const OLD_EXC_LEN = L_FRAME + PIT_MAX + L_INTERPOL;
const EXC_OFF = PIT_MAX + L_INTERPOL;
const AI_ZERO_LEN = L_SUBFR + MP1;
const ZERO_OFF = MP1;
const HVEC_LEN = L_SUBFR * 2;
const H1_OFF = L_SUBFR;
const MEM_ERR_LEN = M + L_SUBFR;
const ERROR_OFF = M;

/** cod_amr.h cod_amrState */
export class cod_amrState {
  constructor(dtx) {
    this.old_speech = new Int16Array(OLD_SPEECH_LEN);
    this.old_wsp = new Int16Array(OLD_WSP_LEN);
    this.old_lags = new Int16Array(5);
    this.ol_gain_flg = new Int16Array(2);
    this.old_exc = new Int16Array(OLD_EXC_LEN);
    this.ai_zero = new Int16Array(AI_ZERO_LEN);
    this.hvec = new Int16Array(HVEC_LEN);

    this.lpcSt = new lpcState();
    this.lspSt = new lspState();
    this.clLtpSt = new clLtpState();
    this.gainQuantSt = new gainQuantState();
    this.pitchOLWghtSt = new pitchOLWghtState();
    this.tonStabSt = new tonStabState();
    this.vadSt = new vadState1();
    this.dtx = dtx ? 1 : 0;
    this.dtx_encSt = new dtx_encState();

    this.mem_syn = new Int16Array(M);
    this.mem_w0 = new Int16Array(M);
    this.mem_w = new Int16Array(M);
    this.mem_err = new Int16Array(MEM_ERR_LEN);

    this.sharp = 0;
    this.overflow = new Int32Array(1);
    this.reset();
  }

  /** cod_amr.cpp cod_amr_reset */
  reset() {
    this.overflow[0] = 0;
    this.old_speech.fill(0);
    this.old_exc.fill(0, 0, PIT_MAX + L_INTERPOL);
    this.old_wsp.fill(0, 0, PIT_MAX);
    this.mem_syn.fill(0);
    this.mem_w.fill(0);
    this.mem_w0.fill(0);
    this.mem_err.fill(0, 0, M);
    this.ai_zero.fill(0, ZERO_OFF, ZERO_OFF + L_SUBFR);
    this.hvec.fill(0, 0, L_SUBFR);
    for (let i = 0; i < 5; i++) this.old_lags[i] = 40;

    this.lpcSt.reset();
    this.lspSt.reset();
    this.clLtpSt.reset();
    this.gainQuantSt.reset();
    this.pitchOLWghtSt.reset();
    this.tonStabSt.reset();
    this.vadSt.reset();
    this.dtx_encSt.reset();
    this.sharp = SHARPMIN;
    return 0;
  }
}

/** cod_amr.cpp cod_amr_first */
export function cod_amr_first(st, new_speech, new_speechOff) {
  /* copy L_NEXT samples into new_speech[-L_NEXT] == speech start lookahead */
  for (let i = 0; i < L_NEXT; i++) {
    st.old_speech[NEW_SPEECH_OFF - L_NEXT + i] = new_speech[new_speechOff + i];
  }
  return 0;
}

/* scratch buffers mirroring C stack arrays in cod_amr */
const A_t = new Int16Array(MP1 * 4);
const Aq_t = new Int16Array(MP1 * 4);
const caLspNew = new Int16Array(M);
const caXn = new Int16Array(L_SUBFR);
const caXn2 = new Int16Array(L_SUBFR);
const caCode = new Int16Array(L_SUBFR);
const caY1 = new Int16Array(L_SUBFR);
const caY2 = new Int16Array(L_SUBFR);
const caGCoeff = new Int16Array(6);
const caRes = new Int16Array(L_SUBFR);
const caRes2 = new Int16Array(L_SUBFR);
const caXnSf0 = new Int16Array(L_SUBFR);
const caY2Sf0 = new Int16Array(L_SUBFR);
const caCodeSf0 = new Int16Array(L_SUBFR);
const caH1Sf0 = new Int16Array(L_SUBFR);
const caMemSynSave = new Int16Array(M);
const caMemW0Save = new Int16Array(M);
const caMemErrSave = new Int16Array(M);
const caTop = new Int16Array(L_FRAME / L_FRAME_BY2);
const caUsedMode = new Int16Array(1);
const caT0 = new Int16Array(1);
const caT0frac = new Int16Array(1);
const caGainPit = new Int16Array(1);
const caGainCode = new Int16Array(1);
const caGainPitSf0 = new Int16Array(1);
const caGainCodeSf0 = new Int16Array(1);
const caGpLimit = new Int16Array(1);
const caSharp = new Int16Array(1);
const caSharpSave = new Int16Array(1);

/**
 * cod_amr.cpp cod_amr.
 * ana is the analysis-parameters array; anaOff its base. Returns usedMode.
 */
export function cod_amr(st, mode, new_speech, new_speechOff, ana, anaOff, synth, synthOff) {
  let A, Aq; /* offsets into A_t / Aq_t */
  const lsp_new = caLspNew;
  const xn = caXn;
  const xn2 = caXn2;
  const code = caCode;
  const y1 = caY1;
  const y2 = caY2;
  const gCoeff = caGCoeff;
  const res = caRes;
  const res2 = caRes2;
  const T_op = caTop;
  let evenSubfr;
  let T0_sf0 = 0;
  let T0_frac_sf0 = 0;
  let i_subfr_sf0 = 0;
  let i_subfr, subfrNr;
  let lsp_flag = 0;
  let vad_flag;
  let compute_sid_flag;
  const pOverflow = st.overflow;
  const anap = { arr: ana, off: anaOff };

  for (let i = 0; i < L_FRAME; i++) {
    st.old_speech[NEW_SPEECH_OFF + i] = new_speech[new_speechOff + i];
  }

  caUsedMode[0] = mode;

  if (st.dtx) {
    vad_flag = vad1(st.vadSt, st.old_speech, NEW_SPEECH_OFF, pOverflow);
    compute_sid_flag = tx_dtx_handler(st.dtx_encSt, vad_flag, caUsedMode, pOverflow);
  } else {
    compute_sid_flag = 0;
  }
  let usedMode = caUsedMode[0];

  /* LP analysis */
  lpc(st.lpcSt, mode, st.old_speech, PWINDOW_OFF, st.old_speech, PWINDOW12_OFF,
    A_t, 0, pOverflow);

  /* From A(z) to lsp; LSP quantization and interpolation */
  anap.off = anaOff;
  lsp_fn(st.lspSt, mode, usedMode, A_t, 0, Aq_t, 0, lsp_new, 0, anap, pOverflow);

  /* Buffer lsp's and energy */
  dtx_buffer(st.dtx_encSt, lsp_new, 0, st.old_speech, NEW_SPEECH_OFF, pOverflow);

  if (usedMode === MRDTX) {
    dtx_enc(st.dtx_encSt, compute_sid_flag, st.lspSt.qSt, st.gainQuantSt.gc_predSt,
      anap, pOverflow);
    st.old_exc.fill(0, 0, PIT_MAX + L_INTERPOL);
    st.mem_w0.fill(0);
    st.mem_err.fill(0, 0, M);
    st.ai_zero.fill(0, ZERO_OFF, ZERO_OFF + L_SUBFR);
    st.hvec.fill(0, 0, L_SUBFR);
    st.lspSt.reset();
    st.lspSt.lsp_old.set(lsp_new);
    st.lspSt.lsp_old_q.set(lsp_new);
    st.clLtpSt.reset();
    st.sharp = SHARPMIN;
  } else {
    lsp_flag = check_lsp(st.tonStabSt, st.lspSt.lsp_old, 0, pOverflow);
  }

  /* open-loop pitch */
  for (subfrNr = 0, i_subfr = 0; subfrNr < L_FRAME / L_FRAME_BY2;
    subfrNr++, i_subfr += L_FRAME_BY2) {
    pre_big(mode, gamma1, gamma1_12k2, gamma2, A_t, 0, i_subfr,
      st.old_speech, SPEECH_OFF, st.mem_w, 0, st.old_wsp, WSP_OFF, pOverflow);

    if (mode !== MR475 && mode !== MR515) {
      caT0[0] = T_op[subfrNr];
      ol_ltp(st.pitchOLWghtSt, st.vadSt, mode, st.old_wsp, WSP_OFF + i_subfr,
        caT0, st.old_lags, st.ol_gain_flg, subfrNr, st.dtx, pOverflow);
      T_op[subfrNr] = caT0[0];
    }
  }

  if (mode === MR475 || mode === MR515) {
    caT0[0] = T_op[0];
    ol_ltp(st.pitchOLWghtSt, st.vadSt, mode, st.old_wsp, WSP_OFF, caT0,
      st.old_lags, st.ol_gain_flg, 1, st.dtx, pOverflow);
    T_op[0] = caT0[0];
    T_op[1] = T_op[0];
  }

  if (st.dtx) {
    vad_pitch_detection(st.vadSt, T_op, 0, pOverflow);
  }

  if (usedMode === MRDTX) {
    /* the_end: shift buffers and return */
    st.old_wsp.copyWithin(0, L_FRAME, L_FRAME + PIT_MAX);
    st.old_speech.copyWithin(0, L_FRAME, L_TOTAL);
    return usedMode;
  }

  /* Subframe loop */
  A = 0;
  Aq = 0;
  evenSubfr = 0;
  subfrNr = -1;
  for (i_subfr = 0; i_subfr < L_FRAME; i_subfr += L_SUBFR) {
    subfrNr++;
    evenSubfr = 1 - evenSubfr;

    if (evenSubfr !== 0 && usedMode === MR475) {
      caMemSynSave.set(st.mem_syn);
      caMemW0Save.set(st.mem_w0);
      caMemErrSave.set(st.mem_err.subarray(0, M));
      caSharpSave[0] = st.sharp;
    }

    /* subframe pre-processing */
    if (usedMode !== MR475) {
      subframePreProc(usedMode, gamma1, gamma1_12k2, gamma2, A_t, A, Aq_t, Aq,
        st.old_speech, SPEECH_OFF + i_subfr, st.mem_err, 0, st.mem_w0, 0,
        st.ai_zero, ZERO_OFF, st.ai_zero, 0, st.old_exc, EXC_OFF + i_subfr,
        st.hvec, H1_OFF, xn, 0, res, 0, st.mem_err, ERROR_OFF);
    } else {
      /* MR475 uses mem_w0_save for the weighting filter memory */
      subframePreProc(usedMode, gamma1, gamma1_12k2, gamma2, A_t, A, Aq_t, Aq,
        st.old_speech, SPEECH_OFF + i_subfr, st.mem_err, 0, caMemW0Save, 0,
        st.ai_zero, ZERO_OFF, st.ai_zero, 0, st.old_exc, EXC_OFF + i_subfr,
        st.hvec, H1_OFF, xn, 0, res, 0, st.mem_err, ERROR_OFF);
      if (evenSubfr !== 0) {
        caH1Sf0.set(st.hvec.subarray(H1_OFF, H1_OFF + L_SUBFR));
      }
    }

    res2.set(res);

    /* closed-loop pitch search */
    caGainPit[0] = 0;
    cl_ltp(st.clLtpSt, st.tonStabSt, usedMode, i_subfr, T_op, 0, st.hvec, H1_OFF,
      st.old_exc, EXC_OFF + i_subfr, res2, 0, xn, 0, lsp_flag, xn2, 0, y1, 0,
      caT0, caT0frac, caGainPit, gCoeff, 0, anap, caGpLimit, pOverflow);
    const T0 = caT0[0];
    const T0_frac = caT0frac[0];
    let gain_pit = caGainPit[0];

    if (subfrNr === 0 && st.ol_gain_flg[0] > 0) {
      st.old_lags[1] = T0;
    }
    if (subfrNr === 3 && st.ol_gain_flg[1] > 0) {
      st.old_lags[0] = T0;
    }

    /* algebraic codebook search */
    cbsearch(xn2, 0, st.hvec, H1_OFF, T0, st.sharp, gain_pit, res2, 0,
      code, 0, y2, 0, anap, usedMode, subfrNr, pOverflow);

    /* gain quantization */
    gainQuant(st.gainQuantSt, usedMode, res, 0, st.old_exc, EXC_OFF + i_subfr,
      code, 0, xn, 0, xn2, 0, y1, 0, y2, 0, gCoeff, 0, evenSubfr, caGpLimit[0],
      caGainPitSf0, caGainCodeSf0, caGainPit, caGainCode, anap, pOverflow);
    gain_pit = caGainPit[0];
    const gain_code = caGainCode[0];

    update_gp_clipping(st.tonStabSt, gain_pit, pOverflow);

    if (usedMode !== MR475) {
      subframePostProc(st.old_speech, SPEECH_OFF, usedMode, i_subfr, gain_pit,
        gain_code, Aq_t, Aq, synth, synthOff, xn, 0, code, 0, y1, 0, y2, 0,
        st.mem_syn, 0, st.mem_err, 0, st.mem_w0, 0, st.old_exc, EXC_OFF,
        caSharp, pOverflow);
      st.sharp = caSharp[0];
    } else if (evenSubfr !== 0) {
      i_subfr_sf0 = i_subfr;
      caXnSf0.set(xn);
      caY2Sf0.set(y2);
      caCodeSf0.set(code);
      T0_sf0 = T0;
      T0_frac_sf0 = T0_frac;
      subframePostProc(st.old_speech, SPEECH_OFF, usedMode, i_subfr, gain_pit,
        gain_code, Aq_t, Aq, synth, synthOff, xn, 0, code, 0, y1, 0, y2, 0,
        caMemSynSave, 0, st.mem_err, 0, caMemW0Save, 0, st.old_exc, EXC_OFF,
        caSharp, pOverflow);
      st.sharp = caSharpSave[0];
    } else {
      st.mem_err.set(caMemErrSave.subarray(0, M));
      Pred_lt_3or6(st.old_exc, EXC_OFF + i_subfr_sf0, T0_sf0, T0_frac_sf0,
        L_SUBFR, 1, pOverflow);
      Convolve(st.old_exc, EXC_OFF + i_subfr_sf0, caH1Sf0, 0, y1, 0, L_SUBFR);
      Aq -= MP1;
      subframePostProc(st.old_speech, SPEECH_OFF, usedMode, i_subfr_sf0,
        caGainPitSf0[0], caGainCodeSf0[0], Aq_t, Aq, synth, synthOff,
        caXnSf0, 0, caCodeSf0, 0, y1, 0, caY2Sf0, 0,
        st.mem_syn, 0, st.mem_err, 0, st.mem_w0, 0, st.old_exc, EXC_OFF,
        caSharpSave, pOverflow);
      Aq += MP1;
      subframePreProc(usedMode, gamma1, gamma1_12k2, gamma2, A_t, A, Aq_t, Aq,
        st.old_speech, SPEECH_OFF + i_subfr, st.mem_err, 0, st.mem_w0, 0,
        st.ai_zero, ZERO_OFF, st.ai_zero, 0, st.old_exc, EXC_OFF + i_subfr,
        st.hvec, H1_OFF, xn, 0, res, 0, st.mem_err, ERROR_OFF);
      Pred_lt_3or6(st.old_exc, EXC_OFF + i_subfr, T0, T0_frac, L_SUBFR, 1, pOverflow);
      Convolve(st.old_exc, EXC_OFF + i_subfr, st.hvec, H1_OFF, y1, 0, L_SUBFR);
      subframePostProc(st.old_speech, SPEECH_OFF, usedMode, i_subfr, gain_pit,
        gain_code, Aq_t, Aq, synth, synthOff, xn, 0, code, 0, y1, 0, y2, 0,
        st.mem_syn, 0, st.mem_err, 0, st.mem_w0, 0, st.old_exc, EXC_OFF,
        caSharp, pOverflow);
      st.sharp = caSharp[0];
    }

    A += MP1;
    Aq += MP1;
  }

  st.old_exc.copyWithin(0, L_FRAME, L_FRAME + PIT_MAX + L_INTERPOL);
  st.old_wsp.copyWithin(0, L_FRAME, L_FRAME + PIT_MAX);
  st.old_speech.copyWithin(0, L_FRAME, L_TOTAL);

  return usedMode;
}
