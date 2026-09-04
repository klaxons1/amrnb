/*
	This file is part of the amrnb project (https://github.com/klaxons1/amrnb):
	a pure Java port of the AMR-NB (narrowband) speech codec.

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.

	This file is a derivative work of the opencore-amr 0.1.6 reference codec
	(https://sourceforge.net/projects/opencore-amr/), original code
	(C) 1998-2010 PacketVideo; portions derived from 3GPP TS 26.073
	(C) 2004 3GPP Organizational Partners.
*/

package javax.microedition.media.decoders;

/* Ported 1:1 from opencore-amr 0.1.6 (dec_amr.h, dec_amr.cpp) via the JS reference port. The class and member names
 * are kept from the C sources so each block can be diffed
 * against the original files. */

/**
 * Main AMR-NB decoder, ported from opencore-amr 0.1.6 dec/src/dec_amr.cpp
 * (Decoder_amrState, Decoder_amr_init/reset, Decoder_amr)
 * (via src/dec/dec_amr.js of the JS reference port).
 *
 * C pointer st->exc = st->old_exc + PIT_MAX + L_INTERPOL becomes the constant
 * offset EXC into st.old_exc.
 */

final class DecAmr
{
	private DecAmr() {}
	public static final int EXC_ENERGY_HIST_LEN = 9;
	public static final int LTP_GAIN_HISTORY_LEN = 9;
	public static final int EXC = Cnst.PIT_MAX + Cnst.L_INTERPOL; /* st->exc offset into old_exc */
	/* bitno[mode][i] — bit counts per parameter, mirrors JS tables/index bitno */
	public static final short[][] BITNO =
	{
		Tables.bitno_MR475, Tables.bitno_MR515, Tables.bitno_MR59, Tables.bitno_MR67,
		Tables.bitno_MR74, Tables.bitno_MR795, Tables.bitno_MR102, Tables.bitno_MR122,
		Tables.bitno_MRDTX,
	};
	/** dec_amr.h Decoder_amrState */
	public static final class State
	{
		public short[] old_exc;
		public short[] lsp_old;
		public short[] mem_syn;
		public int sharp;
		public int old_T0;
		public int prev_bf;
		public int prev_pdf;
		public int state;
		public short[] excEnergyHist;
		public int T0_lagBuff;
		public int inBackgroundNoise;
		public short[] voicedHangover; /* C Word16, passed by address */
		public short[] ltpGainHistory;
		public Bgnscd.State background_state;
		public short[] nodataSeed; /* C Word16, passed by address */
		public CGaver.State Cb_gain_averState;
		public EcGains.LspAvgState lsp_avg_st;
		public DPlsf.State lsfState;
		public EcGains.GainPitchState ec_gain_p_st;
		public EcGains.GainCodeState ec_gain_c_st;
		public GcPred.State pred_state;
		public PhDisp.State ph_disp_st;
		public DtxDec.State dtxDecoderState;
		public int[] overflow;
		public State()
		{
			this.old_exc = new short[Cnst.L_SUBFR + Cnst.PIT_MAX + Cnst.L_INTERPOL];
			this.lsp_old = new short[Cnst.M];
			this.mem_syn = new short[Cnst.M];
			this.sharp = 0;
			this.old_T0 = 0;
			this.prev_bf = 0;
			this.prev_pdf = 0;
			this.state = 0;
			this.excEnergyHist = new short[EXC_ENERGY_HIST_LEN];
			this.T0_lagBuff = 0;
			this.inBackgroundNoise = 0;
			this.voicedHangover = new short[1];
			this.ltpGainHistory = new short[LTP_GAIN_HISTORY_LEN];
			this.background_state = new Bgnscd.State();
			this.nodataSeed = new short[1];
			this.Cb_gain_averState = new CGaver.State();
			this.lsp_avg_st = new EcGains.LspAvgState();
			this.lsfState = new DPlsf.State();
			this.ec_gain_p_st = new EcGains.GainPitchState();
			this.ec_gain_c_st = new EcGains.GainCodeState();
			this.pred_state = new GcPred.State();
			this.ph_disp_st = new PhDisp.State();
			this.dtxDecoderState = new DtxDec.State();
			this.overflow = new int[1];
			init();
		}
		/** dec_amr.cpp Decoder_amr_init */
		public int init()
		{
			this.T0_lagBuff = 40;
			this.inBackgroundNoise = 0;
			this.voicedHangover[0] = 0;
			this.overflow[0] = 0;
			for(int i = 0; i < LTP_GAIN_HISTORY_LEN; i++)
			{
				this.ltpGainHistory[i] = 0;
			}
			this.lsfState.reset();
			this.ec_gain_p_st.reset();
			this.ec_gain_c_st.reset();
			this.Cb_gain_averState.reset();
			this.lsp_avg_st.reset();
			this.background_state.reset();
			this.ph_disp_st.reset();
			this.dtxDecoderState.reset();
			this.pred_state.reset();
			Decoder_amr_reset(this, Cnst.MR475);
			return 0;
		}
	}
	/** dec_amr.cpp Decoder_amr_reset */
	public static int Decoder_amr_reset(State state, int mode)
	{
		/* Static vectors to zero (only old_exc head, like C memset of
		   PIT_MAX + L_INTERPOL entries) */
		for(int i = 0; i < Cnst.PIT_MAX + Cnst.L_INTERPOL; i++)
		{
			state.old_exc[i] = 0;
		}
		if(mode != Cnst.MRDTX)
		{
			for(int i = 0; i < Cnst.M; i++)
			{
				state.mem_syn[i] = 0;
			}
		}
		/* initialize pitch sharpening */
		state.sharp = Cnst.SHARPMIN;
		state.old_T0 = 40;
		/* Initialize overflow Flag */
		state.overflow[0] = 0;
		if(mode != Cnst.MRDTX)
		{
			final short[] init = { 30000, 26000, 21000, 15000, 8000, 0, -8000, -15000, -21000, -26000 };
			System.arraycopy(init, 0, state.lsp_old, 0, Cnst.M);
		}
		/* Initialize memories of bad frame handling */
		state.prev_bf = 0;
		state.prev_pdf = 0;
		state.state = 0;
		state.T0_lagBuff = 40;
		state.inBackgroundNoise = 0;
		state.voicedHangover[0] = 0;
		if(mode != Cnst.MRDTX)
		{
			for(int i = 0; i < EXC_ENERGY_HIST_LEN; i++)
			{
				state.excEnergyHist[i] = 0;
			}
		}
		for(int i = 0; i < LTP_GAIN_HISTORY_LEN; i++)
		{
			state.ltpGainHistory[i] = 0;
		}
		state.Cb_gain_averState.reset();
		if(mode != Cnst.MRDTX)
		{
			state.lsp_avg_st.reset();
		}
		state.lsfState.reset();
		state.ec_gain_p_st.reset();
		state.ec_gain_c_st.reset();
		if(mode != Cnst.MRDTX)
		{
			state.pred_state.reset();
		}
		state.background_state.reset();
		state.nodataSeed[0] = 21845;
		state.ph_disp_st.reset();
		if(mode != Cnst.MRDTX)
		{
			state.dtxDecoderState.reset();
		}
		return 0;
	}
	/* scratch buffers (single-threaded decoder, mirrors C stack arrays) */
	private static final short[] daLspNew = new short[Cnst.M];
	private static final short[] daLspMid = new short[Cnst.M];
	private static final short[] daPrevLsf = new short[Cnst.M];
	private static final short[] daLsfI = new short[Cnst.M];
	private static final short[] daCode = new short[Cnst.L_SUBFR];
	private static final short[] daExcp = new short[Cnst.L_SUBFR];
	private static final short[] daExcEnhanced = new short[Cnst.L_SUBFR];
	private static final short[] daT0 = new short[1];
	private static final short[] daT0frac = new short[1];
	private static final short[] daGainPit = new short[1];
	private static final short[] daGainCode = new short[1];
	private static final short[] daSqrtExp = new short[1];
	/** dec_amr.cpp Decoder_amr */
	public static void Decoder_amr(State st, int mode, short[] parm, int parmOff, int frame_type,
								   short[] synth, int synthOff, short[] A_t, int A_tOff)
								{
		final short[] lsp_new = daLspNew;
		final short[] lsp_mid = daLspMid;
		final short[] prev_lsf = daPrevLsf;
		final short[] lsf_i = daLsfI;
		final short[] code = daCode;
		final short[] excp = daExcp;
		final short[] exc_enhanced = daExcEnhanced;
		int i;
		int T0 = 0;
		int T0_frac;
		int index;
		int index_mr475 = 0;
		int gain_pit;
		int gain_code;
		int gain_code_mix;
		int pit_sharp;
		int pit_flag;
		int pitch_fac;
		int t0_min;
		int t0_max;
		int delta_frc_low;
		int delta_frc_range;
		int tmp_shift;
		int temp;
		int L_temp;
		int flag4;
		int carefulFlag;
		int excEnergy;
		int subfrNr;
		int evenSubfr = 0;
		int bfi = 0;  /* bad frame indication flag */
		int pdfi = 0; /* potential degraded bad frame flag */
		final int[] pOverflow = st.overflow;
		int pParm = parmOff;
		/* find the new DTX state: SPEECH OR DTX */
		final int newDTXState = DtxDec.rx_dtx_handler(st.dtxDecoderState, frame_type, pOverflow);
		/* DTX actions */
		if(newDTXState != DtxDec.SPEECH)
		{
			Decoder_amr_reset(st, Cnst.MRDTX);
			DtxDec.dtx_dec(st.dtxDecoderState, st.mem_syn, 0, st.lsfState, st.pred_state,
				st.Cb_gain_averState, newDTXState, mode, parm, pParm,
				synth, synthOff, A_t, A_tOff, pOverflow);
			/* update average lsp */
			LspFns.Lsf_lsp(st.lsfState.past_lsf_q, 0, st.lsp_old, 0, Cnst.M, pOverflow);
			EcGains.lsp_avg(st.lsp_avg_st, st.lsfState.past_lsf_q, 0, pOverflow);
			st.dtxDecoderState.dtxGlobalState = newDTXState;
			return;
		}
		/* SPEECH action state machine */
		if(frame_type == Cnst.RX_SPEECH_BAD || frame_type == Cnst.RX_NO_DATA
			|| frame_type == Cnst.RX_ONSET)
			{
			bfi = 1;
			if(frame_type == Cnst.RX_NO_DATA || frame_type == Cnst.RX_ONSET)
			{
				PostPre.build_CN_param(st.nodataSeed, Tables.prmno[mode], BITNO[mode],
					parm, pParm, pOverflow);
			}
		}
		else if(frame_type == Cnst.RX_SPEECH_DEGRADED)
		{
			pdfi = 1;
		}
		if(bfi != 0)
		{
			st.state += 1;
		}
		else if(st.state == 6)
		{
			st.state = 5;
		}
		else
		{
			st.state = 0;
		}
		if(st.state > 6)
		{
			st.state = 6;
		}
		/* If this frame is the first speech frame after CNI period, set the BFH
		   state machine to an appropriate state depending on whether there was
		   DTX muting before start of speech or not. */
		if(st.dtxDecoderState.dtxGlobalState == DtxDec.DTX)
		{
			st.state = 5;
			st.prev_bf = 0;
		}
		else if(st.dtxDecoderState.dtxGlobalState == DtxDec.DTX_MUTE)
		{
			st.state = 5;
			st.prev_bf = 1;
		}
		/* save old LSFs for CB gain smoothing */
		System.arraycopy(st.lsfState.past_lsf_q, 0, prev_lsf, 0, Cnst.M);
		/* decode LSF parameters and generate interpolated lpc coefficients
		   for the 4 subframes */
		if(mode != Cnst.MR122)
		{
			DPlsf.D_plsf_3(st.lsfState, mode, bfi, parm, pParm, lsp_new, 0, pOverflow);
			pParm += 3;
			IntLpc.Int_lpc_1to3(st.lsp_old, 0, lsp_new, 0, A_t, A_tOff, pOverflow);
		}
		else
		{
			DPlsf.D_plsf_5(st.lsfState, bfi, parm, pParm, lsp_mid, 0, lsp_new, 0, pOverflow);
			pParm += 5;
			IntLpc.Int_lpc_1and3(st.lsp_old, 0, lsp_mid, 0, lsp_new, 0, A_t, A_tOff, pOverflow);
		}
		/* update the LSPs for the next frame */
		for(i = 0; i < Cnst.M; i++)
		{
			st.lsp_old[i] = lsp_new[i];
		}
		/*--------------------------------------------------------------------*
		 * Loop for every subframe in the analysis frame                      *
		 *--------------------------------------------------------------------*/
		int Az = A_tOff; /* pointer to interpolated LPC parameters */
		evenSubfr = 0;
		subfrNr = -1;
		for(int i_subfr = 0; i_subfr < Cnst.L_FRAME; i_subfr += Cnst.L_SUBFR)
		{
			subfrNr += 1;
			evenSubfr = 1 - evenSubfr;
			/* flag for first and 3th subframe */
			pit_flag = i_subfr;
			if(i_subfr == Cnst.L_FRAME_BY2)
			{
				if(mode != Cnst.MR475 && mode != Cnst.MR515)
				{
					pit_flag = 0;
				}
			}
			/* pitch index */
			index = parm[pParm++];
			/* decode pitch lag and find adaptive codebook vector */
			if(mode != Cnst.MR122)
			{
				/* flag4 indicates encoding with 4 bit resolution
				   (MR475, MR515, MR59, MR67) */
				flag4 = 0;
				if(mode == Cnst.MR475 || mode == Cnst.MR515 || mode == Cnst.MR59 || mode == Cnst.MR67)
				{
					flag4 = 1;
				}
				/* get ranges for t0_min and t0_max (only needed in delta decoding) */
				delta_frc_low = 5;
				delta_frc_range = 9;
				if(mode == Cnst.MR795)
				{
					delta_frc_low = 10;
					delta_frc_range = 19;
				}
				t0_min = (st.old_T0 - delta_frc_low) << 16 >> 16;
				if(t0_min < Cnst.PIT_MIN)
				{
					t0_min = Cnst.PIT_MIN;
				}
				t0_max = (t0_min + delta_frc_range) << 16 >> 16;
				if(t0_max > Cnst.PIT_MAX)
				{
					t0_max = Cnst.PIT_MAX;
					t0_min = (t0_max - delta_frc_range) << 16 >> 16;
				}
				DecGain.Dec_lag3(index, t0_min, t0_max, pit_flag, st.old_T0,
					daT0, daT0frac, flag4, pOverflow);
				T0 = daT0[0];
				T0_frac = daT0frac[0];
				st.T0_lagBuff = T0;
				if(bfi != 0)
				{
					if(st.old_T0 < Cnst.PIT_MAX)
					{
						/* Graceful pitch degradation */
						st.old_T0 += 1;
					}
					T0 = st.old_T0;
					T0_frac = 0;
					if(st.inBackgroundNoise != 0 && st.voicedHangover[0] > 4
						&& (mode == Cnst.MR475 || mode == Cnst.MR515 || mode == Cnst.MR59))
						{
						T0 = st.T0_lagBuff;
					}
				}
				Filters.Pred_lt_3or6(st.old_exc, EXC, T0, T0_frac, Cnst.L_SUBFR, 1, pOverflow);
			}
			else
			{
				DecGain.Dec_lag6(index, Cnst.PIT_MIN_MR122, Cnst.PIT_MAX, pit_flag, daT0, daT0frac, pOverflow);
				T0 = daT0[0];
				T0_frac = daT0frac[0];
				if(!(bfi == 0 && (pit_flag == 0 || index < 61)))
				{
					st.T0_lagBuff = T0;
					T0 = st.old_T0;
					T0_frac = 0;
				}
				Filters.Pred_lt_3or6(st.old_exc, EXC, T0, T0_frac, Cnst.L_SUBFR, 0, pOverflow);
			}
			daT0[0] = (short) T0; /* keep scratch in sync for Dec_lag6 2nd/4th subframe input */
			/* (MR122 only: decode pitch gain), decode innovative codebook,
			   set pitch sharpening factor */
			gain_pit = 0;
			if(mode == Cnst.MR475 || mode == Cnst.MR515)
			{
				index = parm[pParm++]; /* index of position */
				i = parm[pParm++];     /* signs */
				DPulse.decode_2i40_9bits(subfrNr, i, index, code, 0, pOverflow);
				L_temp = st.sharp << 1;
				if(L_temp != ((L_temp << 16) >> 16))
				{
					pit_sharp = st.sharp > 0 ? Basicop.MAX_16 : Basicop.MIN_16;
				}
				else
				{
					pit_sharp = (L_temp << 16) >> 16;
				}
			}
			else if(mode == Cnst.MR59)
			{
				index = parm[pParm++];
				i = parm[pParm++];
				DPulse.decode_2i40_11bits(i, index, code, 0);
				L_temp = st.sharp << 1;
				if(L_temp != ((L_temp << 16) >> 16))
				{
					pit_sharp = st.sharp > 0 ? Basicop.MAX_16 : Basicop.MIN_16;
				}
				else
				{
					pit_sharp = (L_temp << 16) >> 16;
				}
			}
			else if(mode == Cnst.MR67)
			{
				index = parm[pParm++];
				i = parm[pParm++];
				DPulse.decode_3i40_14bits(i, index, code, 0);
				L_temp = st.sharp << 1;
				if(L_temp != ((L_temp << 16) >> 16))
				{
					pit_sharp = st.sharp > 0 ? Basicop.MAX_16 : Basicop.MIN_16;
				}
				else
				{
					pit_sharp = (L_temp << 16) >> 16;
				}
			}
			else if(mode <= Cnst.MR795)
			{
				/* MR74, MR795 */
				index = parm[pParm++];
				i = parm[pParm++];
				DPulse.decode_4i40_17bits(i, index, code, 0);
				L_temp = st.sharp << 1;
				if(L_temp != ((L_temp << 16) >> 16))
				{
					pit_sharp = st.sharp > 0 ? Basicop.MAX_16 : Basicop.MIN_16;
				}
				else
				{
					pit_sharp = (L_temp << 16) >> 16;
				}
			}
			else if(mode == Cnst.MR102)
			{
				DPulse.dec_8i40_31bits(parm, pParm, code, 0, pOverflow);
				pParm += 7;
				L_temp = st.sharp << 1;
				if(L_temp != ((L_temp << 16) >> 16))
				{
					pit_sharp = st.sharp > 0 ? Basicop.MAX_16 : Basicop.MIN_16;
				}
				else
				{
					pit_sharp = (L_temp << 16) >> 16;
				}
			}
			else
			{
				/* MR122 */
				index = parm[pParm++];
				if(bfi != 0)
				{
					EcGains.ec_gain_pitch(st.ec_gain_p_st, st.state, daGainPit, pOverflow);
				}
				else
				{
					daGainPit[0] = (short) DecGain.d_gain_pitch(mode, index);
				}
				EcGains.ec_gain_pitch_update(st.ec_gain_p_st, bfi, st.prev_bf, daGainPit, pOverflow);
				gain_pit = daGainPit[0];
				DPulse.dec_10i40_35bits(parm, pParm, code, 0);
				pParm += 10;
				/* pit_sharp = gain_pit; if (pit_sharp > 1.0) pit_sharp = 1.0 */
				L_temp = gain_pit << 1;
				if(L_temp != ((L_temp << 16) >> 16))
				{
					pit_sharp = gain_pit > 0 ? Basicop.MAX_16 : Basicop.MIN_16;
				}
				else
				{
					pit_sharp = (L_temp << 16) >> 16;
				}
			}
			/* Add the pitch contribution to code[] */
			for(i = T0; i < Cnst.L_SUBFR; i++)
			{
				temp = Basicop.mult(code[i - T0], pit_sharp, pOverflow);
				code[i] = (short) Basicop.add_16(code[i], temp, pOverflow);
			}
			/* Decode codebook gain (MR122) or both pitch gain and codebook gain
			   (all others); update pitch sharpening "sharp" with quantized gain_pit */
			if(mode == Cnst.MR475)
			{
				/* read and decode pitch and code gain */
				if(evenSubfr != 0)
				{
					index_mr475 = parm[pParm++]; /* index of gain(s) */
				}
				if(bfi == 0)
				{
					DecGain.Dec_gain(st.pred_state, mode, index_mr475, code, 0, evenSubfr,
						daGainPit, daGainCode, pOverflow);
				}
				else
				{
					EcGains.ec_gain_pitch(st.ec_gain_p_st, st.state, daGainPit, pOverflow);
					EcGains.ec_gain_code(st.ec_gain_c_st, st.pred_state, st.state, daGainCode, pOverflow);
				}
				EcGains.ec_gain_pitch_update(st.ec_gain_p_st, bfi, st.prev_bf, daGainPit, pOverflow);
				EcGains.ec_gain_code_update(st.ec_gain_c_st, bfi, st.prev_bf, daGainCode, pOverflow);
				gain_pit = daGainPit[0];
				gain_code = daGainCode[0];
				pit_sharp = gain_pit;
				if(pit_sharp > Cnst.SHARPMAX)
				{
					pit_sharp = Cnst.SHARPMAX;
				}
			}
			else if(mode <= Cnst.MR74 || mode == Cnst.MR102)
			{
				/* read and decode pitch and code gain */
				index = parm[pParm++]; /* index of gain(s) */
				if(bfi == 0)
				{
					DecGain.Dec_gain(st.pred_state, mode, index, code, 0, evenSubfr,
						daGainPit, daGainCode, pOverflow);
				}
				else
				{
					EcGains.ec_gain_pitch(st.ec_gain_p_st, st.state, daGainPit, pOverflow);
					EcGains.ec_gain_code(st.ec_gain_c_st, st.pred_state, st.state, daGainCode, pOverflow);
				}
				EcGains.ec_gain_pitch_update(st.ec_gain_p_st, bfi, st.prev_bf, daGainPit, pOverflow);
				EcGains.ec_gain_code_update(st.ec_gain_c_st, bfi, st.prev_bf, daGainCode, pOverflow);
				gain_pit = daGainPit[0];
				gain_code = daGainCode[0];
				pit_sharp = gain_pit;
				if(pit_sharp > Cnst.SHARPMAX)
				{
					pit_sharp = Cnst.SHARPMAX;
				}
				if(mode == Cnst.MR102)
				{
					if(st.old_T0 > Cnst.L_SUBFR + 5)
					{
						if(pit_sharp < 0)
						{
							pit_sharp = ~(~pit_sharp >> 2);
						}
						else
						{
							pit_sharp = pit_sharp >> 2;
						}
					}
				}
			}
			else
			{
				/* read and decode pitch gain */
				index = parm[pParm++]; /* index of gain(s) */
				if(mode == Cnst.MR795)
				{
					/* decode pitch gain */
					if(bfi != 0)
					{
						EcGains.ec_gain_pitch(st.ec_gain_p_st, st.state, daGainPit, pOverflow);
					}
					else
					{
						daGainPit[0] = (short) DecGain.d_gain_pitch(mode, index);
					}
					EcGains.ec_gain_pitch_update(st.ec_gain_p_st, bfi, st.prev_bf, daGainPit, pOverflow);
					gain_pit = daGainPit[0];
					/* read and decode code gain */
					index = parm[pParm++];
					if(bfi == 0)
					{
						DecGain.d_gain_code(st.pred_state, mode, index, code, 0, daGainCode, pOverflow);
					}
					else
					{
						EcGains.ec_gain_code(st.ec_gain_c_st, st.pred_state, st.state, daGainCode, pOverflow);
					}
					EcGains.ec_gain_code_update(st.ec_gain_c_st, bfi, st.prev_bf, daGainCode, pOverflow);
					gain_code = daGainCode[0];
					pit_sharp = gain_pit;
					if(pit_sharp > Cnst.SHARPMAX)
					{
						pit_sharp = Cnst.SHARPMAX;
					}
				}
				else
				{
					/* MR122 */
					if(bfi == 0)
					{
						DecGain.d_gain_code(st.pred_state, mode, index, code, 0, daGainCode, pOverflow);
					}
					else
					{
						EcGains.ec_gain_code(st.ec_gain_c_st, st.pred_state, st.state, daGainCode, pOverflow);
					}
					EcGains.ec_gain_code_update(st.ec_gain_c_st, bfi, st.prev_bf, daGainCode, pOverflow);
					gain_code = daGainCode[0];
					pit_sharp = gain_pit;
				}
			}
			/* store pitch sharpening for next subframe (do not update sharpening
			   in even subframes for MR475) */
			if(mode != Cnst.MR475 || evenSubfr == 0)
			{
				st.sharp = gain_pit;
				if(st.sharp > Cnst.SHARPMAX)
				{
					st.sharp = Cnst.SHARPMAX;
				}
			}
			pit_sharp = Basicop.shl(pit_sharp, 1, pOverflow);
			if(pit_sharp > 16384)
			{
				for(i = 0; i < Cnst.L_SUBFR; i++)
				{
					temp = Basicop.mult(st.old_exc[EXC + i], pit_sharp, pOverflow);
					L_temp = Basicop.L_mult(temp, gain_pit, pOverflow);
					if(mode == Cnst.MR122)
					{
						if(L_temp < 0)
						{
							L_temp = ~(~L_temp >> 1);
						}
						else
						{
							L_temp = L_temp >> 1;
						}
					}
					excp[i] = (short) Basicop.pv_round(L_temp, pOverflow);
				}
			}
			/* Store list of LTP gains needed in the SCD */
			if(bfi == 0)
			{
				for(i = 0; i < 8; i++)
				{
					st.ltpGainHistory[i] = st.ltpGainHistory[i + 1];
				}
				st.ltpGainHistory[8] = (short) gain_pit;
			}
			/* Limit gain_pit if in background noise and BFI for MR475, MR515, MR59 */
			if((st.prev_bf != 0 || bfi != 0) && st.inBackgroundNoise != 0
				&& (mode == Cnst.MR475 || mode == Cnst.MR515 || mode == Cnst.MR59))
				{
				if(gain_pit > 12288)
				{
					/* if (gain_pit > 0.75) in Q14 */
					gain_pit = ((((gain_pit - 12288) >> 1) + 12288) << 16) >> 16;
					/* gain_pit = (gain_pit-0.75)/2.0 + 0.75; */
				}
				if(gain_pit > 14745)
				{
					/* if (gain_pit > 0.90) in Q14 */
					gain_pit = 14745;
				}
			}
			/* Calculate CB mixed gain */
			DPlsf.Int_lsf(prev_lsf, 0, st.lsfState.past_lsf_q, 0, i_subfr, lsf_i, 0, pOverflow);
			gain_code_mix = CGaver.Cb_gain_average(st.Cb_gain_averState, mode, gain_code,
				lsf_i, 0, st.lsp_avg_st.lsp_meanSave, 0, bfi, st.prev_bf, pdfi,
				st.prev_pdf, st.inBackgroundNoise, st.voicedHangover[0], pOverflow);
			/* make sure that MR74, MR795, MR122 have original code_gain */
			if(mode > Cnst.MR67 && mode != Cnst.MR102)
			{
				/* MR74, MR795, MR122 */
				gain_code_mix = gain_code;
			}
			/* Find the total excitation; find synthesis speech for st->exc[] */
			if(mode <= Cnst.MR102)
			{
				/* MR475, MR515, MR59, MR67, MR74, MR795, MR102 */
				pitch_fac = gain_pit;
				tmp_shift = 1;
			}
			else
			{
				/* MR122 */
				if(gain_pit < 0)
				{
					pitch_fac = ~(~gain_pit >> 1);
				}
				else
				{
					pitch_fac = gain_pit >> 1;
				}
				tmp_shift = 2;
			}
			/* copy unscaled LTP excitation to exc_enhanced (used in phase
			   dispersion below) and compute total excitation for LTP feedback */
			for(i = 0; i < Cnst.L_SUBFR; i++)
			{
				exc_enhanced[i] = st.old_exc[EXC + i];
				/* st->exc[i] = gain_pit*st->exc[i] + gain_code*code[i]; */
				L_temp = Basicop.L_mult(st.old_exc[EXC + i], pitch_fac, pOverflow);
				L_temp = Basicop.L_mac(L_temp, code[i], gain_code, pOverflow);
				L_temp = Basicop.L_shl(L_temp, tmp_shift, pOverflow); /* Q16 */
				st.old_exc[EXC + i] = (short) Basicop.pv_round(L_temp, pOverflow);
			}
			/* Adaptive phase dispersion */
			PhDisp.ph_disp_release(st.ph_disp_st); /* free phase dispersion adaption */
			if((mode == Cnst.MR475 || mode == Cnst.MR515 || mode == Cnst.MR59)
				&& st.voicedHangover[0] > 3 && st.inBackgroundNoise != 0 && bfi != 0)
				{
				PhDisp.ph_disp_lock(st.ph_disp_st); /* always use full phase disp. */
			}
			/* apply phase dispersion to innovation (if enabled) and
			   compute total excitation for synthesis part */
			PhDisp.ph_disp(st.ph_disp_st, mode, exc_enhanced, 0, gain_code_mix, gain_pit,
				code, 0, pitch_fac, tmp_shift, pOverflow);
			/* The excitation control module is active during BFI;
			   conceal drops in signal energy if in bg noise. */
			L_temp = 0;
			for(i = 0; i < Cnst.L_SUBFR; i++)
			{
				L_temp = Basicop.L_mac(L_temp, exc_enhanced[i], exc_enhanced[i], pOverflow);
			}
			/* excEnergy = sqrt(L_temp) in Q0 */
			if(L_temp < 0)
			{
				L_temp = ~(~L_temp >> 1);
			}
			else
			{
				L_temp = L_temp >> 1;
			}
			L_temp = Mathops.sqrt_l_exp(L_temp, daSqrtExp, pOverflow);
			temp = daSqrtExp[0];
			/* To cope with 16-bit and scaling in ex_ctrl() */
			L_temp = Basicop.L_shr(L_temp, ((temp >> 1) + 15) << 16 >> 16, pOverflow);
			if(L_temp < 0)
			{
				excEnergy = (~(~L_temp >> 2) << 16) >> 16;
			}
			else
			{
				excEnergy = ((L_temp >> 2) << 16) >> 16;
			}
			if((mode == Cnst.MR475 || mode == Cnst.MR515 || mode == Cnst.MR59)
				&& st.voicedHangover[0] > 5 && st.inBackgroundNoise != 0 && st.state < 4
				&& ((pdfi != 0 && st.prev_pdf != 0) || bfi != 0 || st.prev_bf != 0))
				{
				carefulFlag = 0;
				if(pdfi != 0 && bfi == 0)
				{
					carefulFlag = 1;
				}
				Pstfilt.Ex_ctrl(exc_enhanced, 0, excEnergy, st.excEnergyHist, 0,
					st.voicedHangover[0], st.prev_bf, carefulFlag, pOverflow);
			}
			if(!(st.inBackgroundNoise != 0 && (bfi != 0 || st.prev_bf != 0)
				&& st.state < 4))
				{
				/* Update energy history for all modes */
				for(i = 0; i < 8; i++)
				{
					st.excEnergyHist[i] = st.excEnergyHist[i + 1];
				}
				st.excEnergyHist[8] = (short) excEnergy;
			}
			/* Excitation control module end */
			if(pit_sharp > 16384)
			{
				for(i = 0; i < Cnst.L_SUBFR; i++)
				{
					excp[i] = (short) Basicop.add_16(excp[i], exc_enhanced[i], pOverflow);
				}
				Agc.agc2(exc_enhanced, 0, excp, 0, Cnst.L_SUBFR, pOverflow);
				pOverflow[0] = 0;
				Filters.Syn_filt(A_t, Az, excp, 0, synth, synthOff + i_subfr, Cnst.L_SUBFR,
					st.mem_syn, 0, 0);
			}
			else
			{
				pOverflow[0] = 0;
				Filters.Syn_filt(A_t, Az, exc_enhanced, 0, synth, synthOff + i_subfr, Cnst.L_SUBFR,
					st.mem_syn, 0, 0);
			}
			if(pOverflow[0] != 0)
			{
				/* Test for overflow */
				for(i = Cnst.PIT_MAX + Cnst.L_INTERPOL + Cnst.L_SUBFR - 1; i >= 0; i--)
				{
					if(st.old_exc[i] < 0)
					{
						st.old_exc[i] = (short) (~(~st.old_exc[i] >> 2));
					}
					else
					{
						st.old_exc[i] = (short) (st.old_exc[i] >> 2);
					}
				}
				for(i = Cnst.L_SUBFR - 1; i >= 0; i--)
				{
					if(exc_enhanced[i] < 0)
					{
						exc_enhanced[i] = (short) (~(~exc_enhanced[i] >> 2));
					}
					else
					{
						exc_enhanced[i] = (short) (exc_enhanced[i] >> 2);
					}
				}
				Filters.Syn_filt(A_t, Az, exc_enhanced, 0, synth, synthOff + i_subfr, Cnst.L_SUBFR,
					st.mem_syn, 0, 1);
			}
			else
			{
				for(i = 0; i < Cnst.M; i++)
				{
					st.mem_syn[i] = synth[synthOff + i_subfr + Cnst.L_SUBFR - Cnst.M + i];
				}
			}
			/* Update signal for next frame: shift st->old_exc[] left by L_SUBFR */
			System.arraycopy(st.old_exc, Cnst.L_SUBFR, st.old_exc, 0,
				Cnst.PIT_MAX + Cnst.L_INTERPOL);
			/* interpolated LPC parameters for next subframe */
			Az += Cnst.MP1;
			/* store T0 for next subframe */
			st.old_T0 = T0;
		}
		/* Call the Source Characteristic Detector which updates
		   st->inBackgroundNoise and st->voicedHangover */
		st.inBackgroundNoise = Bgnscd.Bgn_scd(st.background_state, st.ltpGainHistory, 0,
			synth, synthOff, st.voicedHangover, pOverflow);
		DtxDec.dtx_dec_activity_update(st.dtxDecoderState, st.lsfState.past_lsf_q, 0,
			synth, synthOff, pOverflow);
		/* store bfi for next subframe */
		st.prev_bf = bfi;
		st.prev_pdf = pdfi;
		/* Calculate the LSF averages on the eight previous frames */
		EcGains.lsp_avg(st.lsp_avg_st, st.lsfState.past_lsf_q, 0, pOverflow);
		st.dtxDecoderState.dtxGlobalState = newDTXState;
	}
}
