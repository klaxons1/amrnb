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

/* Ported 1:1 from opencore-amr 0.1.6 (c_g_aver.h, c_g_aver.cpp, this.h, st.h) via the JS reference port. The class and member names
 * are kept from the C sources so each block can be diffed
 * against the original files. */

/**
 * Codebook gain averaging, ported from opencore-amr 0.1.6 dec/src/c_g_aver.cpp
 * (via src/dec/c_g_aver.js of the JS reference port).
 */

final class CGaver
{
	private CGaver() {}
	public static final int L_CBGAINHIST = 7;
	/** c_g_aver.h Cb_gain_averageState */
	public static final class State
	{
		public short[] cbGainHistory;
		public int hangVar;
		public int hangCount;
		public State()
		{
			this.cbGainHistory = new short[L_CBGAINHIST];
			reset();
		}
		/** c_g_aver.cpp Cb_gain_average_reset */
		public int reset()
		{
			for(int i = 0; i < L_CBGAINHIST; i++)
			{
				cbGainHistory[i] = 0;
			}
			this.hangVar = 0;
			this.hangCount = 0;
			return 0;
		}
	}
	private static final short[] cgTmp = new short[Cnst.M];
	/** c_g_aver.cpp Cb_gain_average: returns smoothed cb gain (Q1) */
	public static int Cb_gain_average(State st, int mode, int gain_code, short[] lsp, int lspOff,
									  short[] lspAver, int lspAverOff, int bfi, int prev_bf, int pdfi,
									  int prev_pdf, int inBackgroundNoise, int voicedHangover, int[] pOverflow)
									{
		int cbGainMix;
		int diff;
		int tmp_diff;
		int bgMix;
		int cbGainMean;
		int L_sum;
		final short[] tmp = cgTmp;
		int tmp1;
		int tmp2;
		int shift1;
		int shift2;
		int shift;
		/* set correct cbGainMix for MR74, MR795, MR122 */
		cbGainMix = gain_code;
		/* Store list of CB gain needed in the CB gain averaging */
		for(int i = 0; i < L_CBGAINHIST - 1; i++)
		{
			st.cbGainHistory[i] = st.cbGainHistory[i + 1];
		}
		st.cbGainHistory[L_CBGAINHIST - 1] = (short) gain_code;
		diff = 0;
		/* compute lsp difference */
		for(int i = 0; i < Cnst.M; i++)
		{
			tmp1 = Basicop.abs_s(Basicop.sub(lspAver[lspAverOff + i], lsp[lspOff + i], pOverflow)); /* Q15 */
			shift1 = (Basicop.norm_s(tmp1) - 1) << 16 >> 16;        /* Qn */
			tmp1 = Basicop.shl(tmp1, shift1, pOverflow);            /* Q15+Qn */
			shift2 = Basicop.norm_s(lspAver[lspAverOff + i]);       /* Qm */
			tmp2 = Basicop.shl(lspAver[lspAverOff + i], shift2, pOverflow); /* Q15+Qm */
			tmp[i] = (short) Basicop.div_s(tmp1, tmp2); /* Q15+(Q15+Qn)-(Q15+Qm) */
			shift = (2 + shift1 - shift2) << 16 >> 16;
			if(shift >= 0)
			{
				tmp[i] = (short) Basicop.shr(tmp[i], shift, pOverflow); /* Q15+Qn-Qm-Qx=Q13 */
			}
			else
			{
				tmp[i] = (short) Basicop.shl(tmp[i], Basicop.negate(shift), pOverflow);
			}
			diff = Basicop.add_16(diff, tmp[i], pOverflow); /* Q13 */
		}
		/* Compute hangover */
		if(diff > 5325)
		{
			/* 0.65 in Q11 */
			st.hangVar += 1;
		}
		else
		{
			st.hangVar = 0;
		}
		if(st.hangVar > 10)
		{
			/* Speech period, reset hangover variable */
			st.hangCount = 0;
		}
		/* Compute mix constant (bgMix) */
		bgMix = 8192; /* 1 in Q13 */
		if(mode <= Cnst.MR67 || mode == Cnst.MR102)
		{
			/* MR475, MR515, MR59, MR67, MR102 */
			/* if errors and presumed noise make smoothing probability stronger */
			if(((pdfi != 0 && prev_pdf != 0) || bfi != 0 || prev_bf != 0)
				&& voicedHangover > 1
				&& inBackgroundNoise != 0
				&& (mode == Cnst.MR475 || mode == Cnst.MR515 || mode == Cnst.MR59))
				{
				/* bgMix = min(0.25, max(0.0, diff-0.55)) / 0.25; */
				tmp_diff = (diff - 4506) << 16 >> 16; /* 0.55 in Q13 */
			}
			else
			{
				/* bgMix = min(0.25, max(0.0, diff-0.40)) / 0.25; */
				tmp_diff = (diff - 3277) << 16 >> 16; /* 0.4 in Q13 */
			}
			/* max(0.0, diff-0.55) or max(0.0, diff-0.40) */
			tmp1 = tmp_diff > 0 ? tmp_diff : 0;
			/* min(0.25, tmp1) */
			if(tmp1 > 2048)
			{
				bgMix = 8192;
			}
			else
			{
				bgMix = Basicop.shl(tmp1, 2, pOverflow);
			}
			if(st.hangCount < 40 || diff > 5325)
			{
				/* 0.65 in Q13: disable mix if too short time since */
				bgMix = 8192;
			}
			/* Smoothen the cb gain trajectory; smoothing depends on bgMix */
			L_sum = Basicop.L_mult(6554, st.cbGainHistory[2], pOverflow); /* 0.2 in Q15 */
			for(int i = 3; i < L_CBGAINHIST; i++)
			{
				L_sum = Basicop.L_mac(L_sum, 6554, st.cbGainHistory[i], pOverflow);
			}
			cbGainMean = Basicop.pv_round(L_sum, pOverflow); /* Q1 */
			/* more smoothing in error and bg noise (NB no DFI used here) */
			if((bfi != 0 || prev_bf != 0) && inBackgroundNoise != 0
				&& (mode == Cnst.MR475 || mode == Cnst.MR515 || mode == Cnst.MR59))
				{
				/* 0.143 in Q15 */
				L_sum = Basicop.L_mult(4681, st.cbGainHistory[0], pOverflow);
				for(int i = 1; i < L_CBGAINHIST; i++)
				{
					L_sum = Basicop.L_mac(L_sum, 4681, st.cbGainHistory[i], pOverflow);
				}
				cbGainMean = Basicop.pv_round(L_sum, pOverflow); /* Q1 */
			}
			/* cbGainMix = bgMix*cbGainMix + (1-bgMix)*cbGainMean; L_sum in Q15 */
			L_sum = Basicop.L_mult(bgMix, cbGainMix, pOverflow);
			L_sum = Basicop.L_mac(L_sum, 8192, cbGainMean, pOverflow);
			L_sum = Basicop.L_msu(L_sum, bgMix, cbGainMean, pOverflow);
			cbGainMix = Basicop.pv_round(Basicop.L_shl(L_sum, 2, pOverflow), pOverflow); /* Q1 */
		}
		st.hangCount += 1;
		return cbGainMix;
	}
}
