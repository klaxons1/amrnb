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

/* Ported 1:1 from opencore-amr 0.1.6 (pred_lt.cpp, weight_a.cpp, residu.cpp, syn_filt.cpp) via the JS reference port. The class and member names
 * are kept from the C sources so each block can be diffed
 * against the original files. */

/**
 * Filtering primitives, ported from opencore-amr 0.1.6 common/src:
 *   weight_a.cpp, residu.cpp, syn_filt.cpp, pred_lt.cpp
 * (via src/common/filters.js of the JS reference port).
 * Pointer arithmetic rewritten as (array, offset) index pairs.
 *
 * Word32 accumulators built with raw `+=` may exceed int32; Java int
 * accumulation wraps mod 2^32 at every step, which equals the C mod-2^32
 * wrap of the running sum and the JS ToInt32 of the exact double sum
 * (all intermediate sums are < 2^53, so modular arithmetic agrees).
 * Unsigned-compare sites normalize with a long mask first.
 */

final class Filters
{
	private Filters() {}
	public static final int UP_SAMP_MAX = 6;
	public static final int L_INTER10 = 10; /* L_INTERPOL - 1 */
	/* pred_lt.cpp: (1/6) resolution interpolation filter table (Word16) in Q15 */
	public static final short[] inter_6_pred_lt =
	{
		29443,
		28346, 25207, 20449, 14701, 8693, 3143,
		-1352, -4402, -5865, -5850, -4673, -2783,
		-672, 1211, 2536, 3130, 2991, 2259,
		1170, 0, -1001, -1652, -1868, -1666,
		-1147, -464, 218, 756, 1060, 1099,
		904, 550, 135, -245, -514, -634,
		-602, -451, -231, 0, 191, 308,
		340, 296, 198, 78, -36, -120,
		-163, -165, -132, -79, -19, 34,
		73, 91, 89, 70, 38, 0,
	};
	/** weight_a.cpp Weight_Ai: a[M+1] -> a_exp[M+1] with spectral expansion fac[M] */
	public static void Weight_Ai(short[] a, int aOff, short[] fac, int facOff,
								 short[] a_exp, int a_expOff)
								{
		a_exp[a_expOff] = a[aOff];
		for(int i = 1; i <= Cnst.M; i++)
		{
			a_exp[a_expOff + i] =
				(short) (((a[aOff + i] * fac[facOff + i - 1] + 0x00004000) >> 15) << 16 >> 16);
		}
	}
	/** residu.cpp Residu: LP residual, processes input_len samples (multiple of 4) */
	public static void Residu(short[] coef, int coefOff, short[] input, int inputOff,
							  short[] residual, int residualOff, int input_len)
							{
		int s1, s2, s3, s4;
		int pRes = residualOff + input_len - 1;
		int pIn = inputOff + input_len - 1 - Cnst.M;
		for(int i = input_len >> 2; i != 0; i--)
		{
			s1 = 0x0000800;
			s2 = 0x0000800;
			s3 = 0x0000800;
			s4 = 0x0000800;
			int pCoef = coefOff + Cnst.M;
			int p1 = pIn--;
			int p2 = pIn--;
			int p3 = pIn--;
			int p4 = pIn--;
			for(int j = Cnst.M >> 1; j != 0; j--)
			{
				s1 += coef[pCoef] * input[p1++];
				s2 += coef[pCoef] * input[p2++];
				s3 += coef[pCoef] * input[p3++];
				s4 += coef[pCoef--] * input[p4++];
				s1 += coef[pCoef] * input[p1++];
				s2 += coef[pCoef] * input[p2++];
				s3 += coef[pCoef] * input[p3++];
				s4 += coef[pCoef--] * input[p4++];
			}
			s1 += coef[pCoef] * input[p1];
			s2 += coef[pCoef] * input[p2];
			s3 += coef[pCoef] * input[p3];
			s4 += coef[pCoef] * input[p4];
			residual[pRes--] = (short) ((s1 >> 12) << 16 >> 16);
			residual[pRes--] = (short) ((s2 >> 12) << 16 >> 16);
			residual[pRes--] = (short) ((s3 >> 12) << 16 >> 16);
			residual[pRes--] = (short) ((s4 >> 12) << 16 >> 16);
		}
	}
	private static final short[] synTmp = new short[2 * Cnst.M]; /* C: Word16 tmp[2*M] scratch */
	/** syn_filt.cpp Syn_filt: synthesis filter 1/A(z), lg samples (40) */
	public static void Syn_filt(short[] a, int aOff, short[] x, int xOff,
								short[] y, int yOff, int lg, short[] mem, int memOff, int update)
								{
		int s1, s2;
		int temp;
		final short[] yy = synTmp;
		/* Copy mem[] to yy[] */
		for(int i = 0; i < Cnst.M; i++)
		{
			yy[i] = mem[memOff + i];
		}
		int yyi = Cnst.M;
		/* Do the filtering. */
		int pY = yOff;
		int pX = xOff;
		int pYY1 = yyi - 1; /* index into yy */
		for(int i = Cnst.M >> 1; i != 0; i--)
		{
			int pA = aOff;
			s1 = Basicop.amrnb_fxp_mac_16_by_16bb(x[pX++], a[pA], 0x00000800);
			s2 = Basicop.amrnb_fxp_mac_16_by_16bb(x[pX++], a[pA++], 0x00000800);
			s1 = Basicop.amrnb_fxp_msu_16_by_16bb(a[pA++], yy[pYY1], s1);
			for(int j = (Cnst.M >> 1) - 2; j != 0; j--)
			{
				s2 = Basicop.amrnb_fxp_msu_16_by_16bb(a[pA], yy[pYY1--], s2);
				s1 = Basicop.amrnb_fxp_msu_16_by_16bb(a[pA++], yy[pYY1], s1);
				s2 = Basicop.amrnb_fxp_msu_16_by_16bb(a[pA], yy[pYY1--], s2);
				s1 = Basicop.amrnb_fxp_msu_16_by_16bb(a[pA++], yy[pYY1], s1);
				s2 = Basicop.amrnb_fxp_msu_16_by_16bb(a[pA], yy[pYY1--], s2);
				s1 = Basicop.amrnb_fxp_msu_16_by_16bb(a[pA++], yy[pYY1], s1);
			}
			/* check for overflow on s1 */
			if(((long) (s1 + 134217728) & 0xffffffffL) < 0x0fffffffL)
			{
				temp = ((s1 >> 12) << 16) >> 16;
			}
			else if(s1 > 0x07ffffff)
			{
				temp = Basicop.MAX_16;
			}
			else
			{
				temp = Basicop.MIN_16;
			}
			s2 = Basicop.amrnb_fxp_msu_16_by_16bb(a[aOff + 1], temp, s2);
			yy[yyi++] = (short) temp;
			y[pY++] = (short) temp;
			pYY1 = yyi; /* C: p_yy1 = yy (next unwritten slot, filled by s2 below) */
			/* check for overflow on s2 */
			if(((long) (s2 + 134217728) & 0xffffffffL) < 0x0fffffffL)
			{
				temp = ((s2 >> 12) << 16) >> 16;
			}
			else if(s2 > 0x07ffffff)
			{
				temp = Basicop.MAX_16;
			}
			else
			{
				temp = Basicop.MIN_16;
			}
			yy[yyi++] = (short) temp;
			y[pY++] = (short) temp;
		}
		/* remaining samples read past outputs from y[] itself */
		int pYY1y = yOff + Cnst.M - 1; /* index into y */
		for(int i = (lg - Cnst.M) >> 1; i != 0; i--)
		{
			int pA = aOff;
			s1 = Basicop.amrnb_fxp_mac_16_by_16bb(x[pX++], a[pA], 0x00000800);
			s2 = Basicop.amrnb_fxp_mac_16_by_16bb(x[pX++], a[pA++], 0x00000800);
			s1 = Basicop.amrnb_fxp_msu_16_by_16bb(a[pA++], y[pYY1y], s1);
			for(int j = (Cnst.M >> 1) - 2; j != 0; j--)
			{
				s2 = Basicop.amrnb_fxp_msu_16_by_16bb(a[pA], y[pYY1y--], s2);
				s1 = Basicop.amrnb_fxp_msu_16_by_16bb(a[pA++], y[pYY1y], s1);
				s2 = Basicop.amrnb_fxp_msu_16_by_16bb(a[pA], y[pYY1y--], s2);
				s1 = Basicop.amrnb_fxp_msu_16_by_16bb(a[pA++], y[pYY1y], s1);
				s2 = Basicop.amrnb_fxp_msu_16_by_16bb(a[pA], y[pYY1y--], s2);
				s1 = Basicop.amrnb_fxp_msu_16_by_16bb(a[pA++], y[pYY1y], s1);
			}
			if(((long) (s1 + 134217728) & 0xffffffffL) < 0x0fffffffL)
			{
				temp = ((s1 >> 12) << 16) >> 16;
			}
			else if(s1 > 0x07ffffff)
			{
				temp = Basicop.MAX_16;
			}
			else
			{
				temp = Basicop.MIN_16;
			}
			s2 = Basicop.amrnb_fxp_msu_16_by_16bb(a[aOff + 1], temp, s2);
			y[pY++] = (short) temp;
			pYY1y = pY; /* C: p_yy1 = p_y (slot written by s2 below) */
			if(((long) (s2 + 134217728) & 0xffffffffL) < 0x0fffffffL)
			{
				y[pY++] = (short) ((s2 >> 12) << 16 >> 16);
			}
			else if(s2 > 0x07ffffff)
			{
				y[pY++] = Basicop.MAX_16;
			}
			else
			{
				y[pY++] = Basicop.MIN_16;
			}
		}
		/* Update of memory if update==1 */
		if(update != 0)
		{
			for(int i = 0; i < Cnst.M; i++)
			{
				mem[memOff + i] = y[yOff + lg - Cnst.M + i];
			}
		}
	}
	private static final short[] predLtCoeff = new short[L_INTER10 << 1]; /* C: Word16 Coeff_1[20] */
	/**
	 * pred_lt.cpp Pred_lt_3or6: adaptive codebook prediction, writes
	 * exc[excOff .. excOff+L_subfr-1] interpolating from exc[excOff-T0 ...].
	 * (pOverflow intentionally unused, as in C)
	 */
	public static void Pred_lt_3or6(short[] exc, int excOff, int T0, int frac,
									int L_subfr, int flag3, int[] pOverflow)
									{
		int s1, s2;
		final short[] Coeff_1 = predLtCoeff;
		int pX0 = excOff - T0;
		/* frac goes between -3 and 3 */
		frac = -frac;
		if(flag3 != 0)
		{
			frac <<= 1; /* inter_3l[k] = inter_6[2*k] -> k' = 2*k */
		}
		if(frac < 0)
		{
			frac += UP_SAMP_MAX;
			pX0--;
		}
		int pC1ref = frac;               /* &inter_6_pred_lt[frac] */
		int pC2ref = UP_SAMP_MAX - frac; /* &inter_6_pred_lt[UP_SAMP_MAX - frac] */
		int pC1 = 0;
		int k = 0;
		for(int i = L_INTER10 >> 1; i > 0; i--)
		{
			Coeff_1[pC1++] = inter_6_pred_lt[pC1ref + k];
			Coeff_1[pC1++] = inter_6_pred_lt[pC2ref + k];
			k += UP_SAMP_MAX;
			Coeff_1[pC1++] = inter_6_pred_lt[pC1ref + k];
			Coeff_1[pC1++] = inter_6_pred_lt[pC2ref + k];
			k += UP_SAMP_MAX;
		}
		int pExc = excOff;
		for(int j = L_subfr >> 1; j != 0; j--)
		{
			pX0++;
			int pX2 = pX0;
			int pX3 = pX0++;
			pC1 = 0;
			s1 = 0x00004000;
			s2 = 0x00004000;
			for(int i = L_INTER10 >> 1; i > 0; i--)
			{
				s2 += exc[pX3--] * Coeff_1[pC1];
				s1 += exc[pX3] * Coeff_1[pC1++];
				s1 += exc[pX2++] * Coeff_1[pC1];
				s2 += exc[pX2] * Coeff_1[pC1++];
				s2 += exc[pX3--] * Coeff_1[pC1];
				s1 += exc[pX3] * Coeff_1[pC1++];
				s1 += exc[pX2++] * Coeff_1[pC1];
				s2 += exc[pX2] * Coeff_1[pC1++];
			}
			exc[pExc++] = (short) ((s1 >> 15) << 16 >> 16);
			exc[pExc++] = (short) ((s2 >> 15) << 16 >> 16);
		}
	}
}
