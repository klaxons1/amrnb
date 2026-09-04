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

/* Ported 1:1 from opencore-amr 0.1.6 (preemph.h, preemph.cpp, post_pro.cpp, post_pro.h, a_refl.cpp, b_cn_cod.cpp) via the JS reference port. The class and member names
 * are kept from the C sources so each block can be diffed
 * against the original files. */

/**
 * Pre/post processing helpers, ported from opencore-amr 0.1.6 dec/src:
 *   preemph.cpp (preemphasisState, preemphasis),
 *   post_pro.cpp (Post_ProcessState, Post_Process),
 *   a_refl.cpp (A_Refl),
 *   b_cn_cod.cpp (pseudonoise, build_CN_code, build_CN_param)
 * (via src/dec/post_pre.js of the JS reference port).
 */

final class PostPre
{
	private PostPre() {}
	/** preemph.h preemphasisState */
	public static final class PreemphasisState
	{
		public int mem_pre;
		public PreemphasisState()
		{
			reset();
		}
		public int reset()
		{
			this.mem_pre = 0; /* preemphasis filter state */
			return 0;
		}
	}
	/** preemph.cpp preemphasis */
	public static void preemphasis(PreemphasisState st, short[] signal, int signalOff,
								   int g, int L, int[] pOverflow)
								{
		int temp2;
		int p1 = signalOff + L - 1;
		int p2 = p1 - 1;
		final int temp = signal[p1];
		for(int i = 0; i <= L - 2; i++)
		{
			temp2 = Basicop.mult(g, signal[p2--], pOverflow);
			signal[p1] = (short) Basicop.sub(signal[p1], temp2, pOverflow);
			p1--;
		}
		temp2 = Basicop.mult(g, st.mem_pre, pOverflow);
		signal[p1] = (short) Basicop.sub(signal[p1], temp2, pOverflow);
		st.mem_pre = temp;
	}
	/* post_pro.cpp HP filter coefficients */
	public static final short[] pp_b = { 7699, -15398, 7699 };
	public static final short[] pp_a = { 8192, 15836, -7667 };
	/** post_pro.h Post_ProcessState */
	public static final class PostProcessState
	{
		public int y2_hi;
		public int y2_lo;
		public int y1_hi;
		public int y1_lo;
		public int x0;
		public int x1;
		public PostProcessState()
		{
			reset();
		}
		/** post_pro.cpp Post_Process_reset */
		public int reset()
		{
			this.y2_hi = 0;
			this.y2_lo = 0;
			this.y1_hi = 0;
			this.y1_lo = 0;
			this.x0 = 0;
			this.x1 = 0;
			return 0;
		}
	}
	/** post_pro.cpp Post_Process: HP filter + upscaling of output speech */
	public static void Post_Process(PostProcessState st, short[] signal, int signalOff, int lg, int[] pOverflow)
	{
		int x2;
		int L_tmp;
		final int c_a1 = pp_a[1];
		final int c_a2 = pp_a[2];
		final int c_b0 = pp_b[0];
		final int c_b1 = pp_b[1];
		final int c_b2 = pp_b[2];
		int p = signalOff;
		for(int i = 0; i < lg; i++)
		{
			x2 = st.x1;
			st.x1 = st.x0;
			st.x0 = signal[p];
			/* y[i] = b[0]*x[i]*2 + b[1]*x[i-1]*2 + b[2]*x[i-2]/2
					  + a[1]*y[i-1] + a[2]*y[i-2]; */
			L_tmp = st.y1_hi * c_a1;
			L_tmp += (st.y1_lo * c_a1) >> 15;
			L_tmp += st.y2_hi * c_a2;
			L_tmp += (st.y2_lo * c_a2) >> 15;
			L_tmp += st.x0 * c_b0;
			L_tmp += st.x1 * c_b1;
			L_tmp += x2 * c_b2;
			/* int accumulation wraps mod 2^32 == the JS `| 0` before L_shl */
			L_tmp = Basicop.L_shl(L_tmp, 3, pOverflow);
			/* Multiplication by two of output speech with saturation. */
			signal[p++] = (short) Basicop.pv_round(Basicop.L_shl(L_tmp, 1, pOverflow), pOverflow);
			st.y2_hi = st.y1_hi;
			st.y2_lo = st.y1_lo;
			st.y1_hi = (L_tmp >> 16) << 16 >> 16;
			st.y1_lo = ((L_tmp >> 1) - (st.y1_hi << 15)) << 16 >> 16;
		}
	}
	private static final short[] aReflAState = new short[Cnst.M];
	private static final short[] aReflBState = new short[Cnst.M];
	/** a_refl.cpp A_Refl: convert direct-form coefficients to reflection coeffs */
	public static void A_Refl(short[] a, int aOff, short[] refl, int reflOff, int[] pOverflow)
	{
		final short[] aState = aReflAState;
		final short[] bState = aReflBState;
		int normShift;
		int normProd;
		int L_acc;
		int scale;
		int L_temp;
		int temp;
		int multFac;
		/* initialize states */
		for(int i = 0; i < Cnst.M; i++)
		{
			aState[i] = a[aOff + i];
		}
		/* backward Levinson recursion */
		for(int i = Cnst.M - 1; i >= 0; i--)
		{
			if(Basicop.abs_s(aState[i]) >= 4096)
			{
				for(int j = 0; j < Cnst.M; j++)
				{
					refl[reflOff + j] = 0;
				}
				break;
			}
			refl[reflOff + i] = (short) Basicop.shl(aState[i], 3, pOverflow);
			L_temp = Basicop.L_mult(refl[reflOff + i], refl[reflOff + i], pOverflow);
			L_acc = Basicop.L_sub(Basicop.MAX_32, L_temp, pOverflow);
			normShift = Basicop.norm_l(L_acc);
			scale = (15 - normShift) << 16 >> 16;
			L_acc = Basicop.L_shl(L_acc, normShift, pOverflow);
			normProd = Basicop.pv_round(L_acc, pOverflow);
			multFac = Basicop.div_s(16384, normProd);
			boolean aborted = false;
			for(int j = 0; j < i; j++)
			{
				L_acc = aState[j] << 16;
				L_acc = Basicop.L_msu(L_acc, refl[reflOff + i], aState[i - j - 1], pOverflow);
				temp = Basicop.pv_round(L_acc, pOverflow);
				L_temp = Basicop.L_mult(multFac, temp, pOverflow);
				L_temp = Basicop.L_shr_r(L_temp, scale, pOverflow);
				int L_tmp_abs = L_temp - (L_temp < 0 ? 1 : 0);
				L_tmp_abs = L_tmp_abs ^ (L_tmp_abs >> 31);
				if(L_tmp_abs > 32767)
				{
					for(int k = 0; k < Cnst.M; k++)
					{
						refl[reflOff + k] = 0;
					}
					aborted = true;
					break;
				}
				bState[j] = (short) ((L_temp << 16) >> 16);
			}
			if(aborted)
			{
				break;
			}
			for(int j = 0; j < i; j++)
			{
				aState[j] = bState[j];
			}
		}
	}
	public static final int NB_PULSE_DTX = 10; /* number of random pulses in DTX operation */
	/**
	 * b_cn_cod.cpp pseudonoise.
	 * @param pShift_reg int[1] in/out CN generator state
	 */
	public static int pseudonoise(int[] pShift_reg, int no_bits)
	{
		int noise_bits = 0;
		int Sn;
		int temp;
		for(int i = 0; i < no_bits; i++)
		{
			/* State n == 31 */
			if((pShift_reg[0] & 0x00000001) != 0)
			{
				Sn = 1;
			}
			else
			{
				Sn = 0;
			}
			/* State n == 3 */
			if((pShift_reg[0] & 0x10000000) != 0)
			{
				Sn ^= 1;
			}
			else
			{
				Sn ^= 0;
			}
			noise_bits = (noise_bits << 1) << 16 >> 16;
			temp = (pShift_reg[0] & 1) << 16 >> 16;
			noise_bits = (noise_bits | temp) << 16 >> 16;
			pShift_reg[0] >>= 1;
			if((Sn & 1) != 0)
			{
				pShift_reg[0] |= 0x40000000;
			}
		}
		return noise_bits;
	}
	/**
	 * b_cn_cod.cpp build_CN_code.
	 * @param pSeed int[1] in/out CN generator state
	 */
	public static void build_CN_code(int[] pSeed, short[] cod, int codOff, int[] pOverflow)
	{
		int i, j, temp;
		for(i = 0; i < Cnst.L_SUBFR; i++)
		{
			cod[codOff + i] = 0;
		}
		for(int k = 0; k < NB_PULSE_DTX; k++)
		{
			i = pseudonoise(pSeed, 2); /* generate pulse position */
			temp = (Basicop.L_mult(i, 10, pOverflow) << 16) >> 16;
			i = temp >> 1;
			i = Basicop.add_16(i, k, pOverflow);
			j = pseudonoise(pSeed, 1); /* generate sign */
			if(j > 0)
			{
				cod[codOff + i] = 4096;
			}
			else
			{
				cod[codOff + i] = -4096;
			}
		}
	}
	/**
	 * b_cn_cod.cpp build_CN_param.
	 * @param pSeed short[1] in/out (Word16 seed!)
	 */
	public static void build_CN_param(short[] pSeed, int n_param, short[] param_size_table,
									  short[] parm, int parmOff, int[] pOverflow)
									{
		int L_temp;
		int temp;
		L_temp = Basicop.L_mult(pSeed[0], 31821, pOverflow);
		L_temp >>= 1;
		pSeed[0] = (short) ((Basicop.L_add(L_temp, 13849, pOverflow) << 16) >> 16);
		int pTemp = pSeed[0] & 0x7f; /* index into window_200_40 */
		for(int i = 0; i < n_param; i++)
		{
			temp = (~(0xffff << param_size_table[i])) << 16 >> 16;
			parm[parmOff + i] = (short) (Tables.window_200_40[pTemp++] & temp);
		}
	}
}
