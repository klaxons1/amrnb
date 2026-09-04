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

/* Ported 1:1 from opencore-amr 0.1.6 (pstfilt.h, pstfilt.cpp, ex_ctrl.cpp) via the JS reference port. The class and member names
 * are kept from the C sources so each block can be diffed
 * against the original files. */

/**
 * Post filter and excitation control, ported from opencore-amr 0.1.6
 * dec/src/pstfilt.cpp and dec/src/ex_ctrl.cpp
 * (via src/dec/pstfilt.js of the JS reference port).
 */

final class Pstfilt
{
	private Pstfilt() {}
	public static final int L_H = 22; /* size of truncated impulse response of A(z/g1)/A(z/g2) */
	public static final short[] gamma3_MR122 =
	{
		22938, 16057, 11240, 7868, 5508, 3856, 2699, 1889, 1322, 925,
	};
	public static final short[] gamma3 =
	{
		18022, 9912, 5451, 2998, 1649, 907, 499, 274, 151, 83,
	};
	public static final short[] gamma4_MR122 =
	{
		24576, 18432, 13824, 10368, 7776, 5832, 4374, 3281, 2461, 1846,
	};
	public static final short[] gamma4 =
	{
		22938, 16057, 11240, 7868, 5508, 3856, 2699, 1889, 1322, 925,
	};
	/** pstfilt.h Post_FilterState */
	public static final class State
	{
		public short[] res2;
		public short[] mem_syn_pst;
		public PostPre.PreemphasisState preemph_state;
		public Agc.State agc_state;
		public short[] synth_buf;
		public State()
		{
			this.res2 = new short[Cnst.L_SUBFR];
			this.mem_syn_pst = new short[Cnst.M];
			this.preemph_state = new PostPre.PreemphasisState();
			this.agc_state = new Agc.State();
			this.synth_buf = new short[Cnst.M + Cnst.L_FRAME];
			reset();
		}
		/** pstfilt.cpp Post_Filter_reset */
		public int reset()
		{
			for(int i = 0; i < Cnst.M; i++)
			{
				mem_syn_pst[i] = 0;
			}
			for(int i = 0; i < Cnst.L_SUBFR; i++)
			{
				res2[i] = 0;
			}
			for(int i = 0; i < Cnst.M + Cnst.L_FRAME; i++)
			{
				synth_buf[i] = 0;
			}
			this.agc_state.reset();
			this.preemph_state.reset();
			return 0;
		}
	}
	private static final short[] pfAp3 = new short[Cnst.MP1];
	private static final short[] pfAp4 = new short[Cnst.MP1];
	private static final short[] pfH = new short[L_H];
	/** pstfilt.cpp Post_Filter */
	public static void Post_Filter(State st, int mode, short[] syn, int synOff,
								   short[] Az_4, int Az_4Off, int[] pOverflow)
								{
		final short[] Ap3 = pfAp3;
		final short[] Ap4 = pfAp4; /* bandwidth expanded LP parameters */
		final short[] h = pfH;
		int temp1;
		int temp2;
		int L_tmp;
		int L_tmp2;
		final short[] syn_work = st.synth_buf; /* syn_work = &synth_buf[M] */
		final int SW = Cnst.M; /* offset of syn_work inside synth_buf */
		/* Post filtering */
		for(int i = 0; i < Cnst.L_FRAME; i++)
		{
			syn_work[SW + i] = syn[synOff + i];
		}
		int Az = Az_4Off;
		for(int i_subfr = 0; i_subfr < Cnst.L_FRAME; i_subfr += Cnst.L_SUBFR)
		{
			/* Find weighted filter coefficients Ap3[] and Ap4[] */
			if(mode == Cnst.MR122 || mode == Cnst.MR102)
			{
				Filters.Weight_Ai(Az_4, Az, gamma3_MR122, 0, Ap3, 0);
				Filters.Weight_Ai(Az_4, Az, gamma4_MR122, 0, Ap4, 0);
			}
			else
			{
				Filters.Weight_Ai(Az_4, Az, gamma3, 0, Ap3, 0);
				Filters.Weight_Ai(Az_4, Az, gamma4, 0, Ap4, 0);
			}
			/* filtering of synthesis speech by A(z/0.7) to find res2[] */
			Filters.Residu(Ap3, 0, syn_work, SW + i_subfr, st.res2, 0, Cnst.L_SUBFR);
			/* tilt compensation filter: impulse response of A(z/0.7)/A(z/0.75) */
			for(int i = 0; i <= Cnst.M; i++)
			{
				h[i] = Ap3[i];
			}
			for(int i = Cnst.M + 1; i < L_H; i++)
			{
				h[i] = 0;
			}
			Filters.Syn_filt(Ap4, 0, h, 0, h, 0, L_H, h, Cnst.M + 1, 0);
			/* 1st correlation of h[] */
			L_tmp = 0;
			for(int i = L_H - 1; i >= 0; i--)
			{
				L_tmp2 = h[i] * h[i];
				if(L_tmp2 != 0x40000000)
				{
					L_tmp2 = L_tmp2 << 1;
				}
				else
				{
					/* C: sets pOverflow and breaks without accumulating */
					pOverflow[0] = 1;
					break;
				}
				L_tmp = Basicop.L_add(L_tmp, L_tmp2, pOverflow);
			}
			temp1 = (L_tmp >> 16) << 16 >> 16;
			L_tmp = 0;
			for(int i = L_H - 2; i >= 0; i--)
			{
				L_tmp2 = h[i] * h[i + 1];
				if(L_tmp2 != 0x40000000)
				{
					L_tmp2 = L_tmp2 << 1;
				}
				else
				{
					pOverflow[0] = 1;
					break;
				}
				L_tmp = Basicop.L_add(L_tmp, L_tmp2, pOverflow);
			}
			temp2 = (L_tmp >> 16) << 16 >> 16;
			if(temp2 <= 0)
			{
				temp2 = 0;
			}
			else
			{
				L_tmp = (temp2 * Cnst.MU) >> 15;
				/* Sign-extend product */
				if((L_tmp & 0x00010000) != 0)
				{
					L_tmp = L_tmp | 0xffff0000;
				}
				temp2 = (L_tmp << 16) >> 16;
				temp2 = Basicop.div_s(temp2, temp1);
			}
			PostPre.preemphasis(st.preemph_state, st.res2, 0, temp2, Cnst.L_SUBFR, pOverflow);
			/* filtering through 1/A(z/0.75) */
			Filters.Syn_filt(Ap4, 0, st.res2, 0, syn, synOff + i_subfr, Cnst.L_SUBFR, st.mem_syn_pst, 0, 1);
			/* scale output to input */
			Agc.agc(st.agc_state, syn_work, SW + i_subfr, syn, synOff + i_subfr,
				Cnst.AGC_FAC, Cnst.L_SUBFR, pOverflow);
			Az += Cnst.MP1;
		}
		/* update syn_work[] buffer: syn_work[-M..-1] = syn_work[L_FRAME-M..L_FRAME-1] */
		for(int i = 0; i < Cnst.M; i++)
		{
			st.synth_buf[i] = st.synth_buf[Cnst.L_FRAME + i];
		}
	}
	/** ex_ctrl.cpp Ex_ctrl: excitation scaling for error concealment */
	public static int Ex_ctrl(short[] excitation, int excitationOff, int excEnergy, short[] exEnergyHist,
							  int exEnergyHistOff, int voicedHangover, int prevBFI, int carefulFlag,
							  int[] pOverflow)
							{
		int exp;
		int testEnergy, scaleFactor, avgEnergy, prevEnergy;
		int t0;
		/* get target level */
		avgEnergy = Mathops.gmed_n(exEnergyHist, exEnergyHistOff, 9);
		prevEnergy = (exEnergyHist[exEnergyHistOff + 7] + exEnergyHist[exEnergyHistOff + 8]) >> 1;
		if(exEnergyHist[exEnergyHistOff + 8] < prevEnergy)
		{
			prevEnergy = exEnergyHist[exEnergyHistOff + 8];
		}
		/* upscaling to avoid too rapid energy rises for some cases */
		if(excEnergy < avgEnergy && excEnergy > 5)
		{
			testEnergy = Basicop.shl(prevEnergy, 2, pOverflow); /* 4*prevEnergy */
			if(voicedHangover < 7 || prevBFI != 0)
			{
				/* testEnergy = 3*prevEnergy */
				testEnergy = Basicop.sub(testEnergy, prevEnergy, pOverflow);
			}
			if(avgEnergy > testEnergy)
			{
				avgEnergy = testEnergy;
			}
			/* scaleFactor = avgEnergy/excEnergy in Q0 */
			exp = Basicop.norm_s(excEnergy);
			excEnergy = Basicop.shl(excEnergy, exp, pOverflow);
			excEnergy = Basicop.div_s(16383, excEnergy);
			t0 = Basicop.L_mult(avgEnergy, excEnergy, pOverflow);
			t0 = Basicop.L_shr(t0, Basicop.sub(20, exp, pOverflow), pOverflow); /* 20 for Q10 */
			if(t0 > 32767)
			{
				t0 = 32767; /* saturate */
			}
			scaleFactor = (t0 << 16) >> 16;
			/* test if scaleFactor > 3.0 */
			if(carefulFlag != 0 && scaleFactor > 3072)
			{
				scaleFactor = 3072;
			}
			/* scale the excitation by scaleFactor */
			for(int i = 0; i < Cnst.L_SUBFR; i++)
			{
				t0 = Basicop.L_mult(scaleFactor, excitation[excitationOff + i], pOverflow);
				t0 = Basicop.L_shr(t0, 11, pOverflow);
				excitation[excitationOff + i] = (short) ((t0 << 16) >> 16);
			}
		}
		return 0;
	}
}
