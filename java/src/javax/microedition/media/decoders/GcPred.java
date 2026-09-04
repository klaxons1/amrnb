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

/* Ported 1:1 from opencore-amr 0.1.6 (gc_pred.h, gc_pred.cpp) via the JS reference port. The class and member names
 * are kept from the C sources so each block can be diffed
 * against the original files. */

/**
 * Codebook gain MA prediction, ported from opencore-amr 0.1.6
 * common/src/gc_pred.cpp + common/include/gc_pred.h
 * (via src/common/gc_pred.js of the JS reference port).
 * C output pointers (Word16 *exp_gcode0 etc.) become short[1] parameters.
 */

final class GcPred
{
	private GcPred() {}
	public static final int NPRED = 4; /* number of prediction taps */
	public static final int MEAN_ENER_MR122 = 783741; /* 36/(20*log10(2)) (Q17) */
	public static final int MIN_ENERGY = -14336;      /* 14                 Q10 */
	public static final int MIN_ENERGY_MR122 = -2381; /* 14 / (20*log10(2)) Q10 */
	/* MA prediction coefficients (Q13) and MR122 version (Q6) */
	public static final short[] pred = { 5571, 4751, 2785, 1556 };
	public static final short[] pred_MR122 = { 44, 37, 22, 12 };
	/** gc_pred.h gc_predState */
	public static final class State
	{
		public short[] past_qua_en;       /* normal MA memory, Q10 */
		public short[] past_qua_en_MR122; /* MR122 MA memory,  Q10 */
		public State()
		{
			this.past_qua_en = new short[NPRED];
			this.past_qua_en_MR122 = new short[NPRED];
			reset();
		}
		/** gc_pred.cpp gc_pred_reset */
		public int reset()
		{
			for(int i = 0; i < NPRED; i++)
			{
				past_qua_en[i] = (short) MIN_ENERGY;
				past_qua_en_MR122[i] = (short) MIN_ENERGY_MR122;
			}
			return 0;
		}
	}
	private static final short[] scratchExp = new short[1];
	private static final short[] scratchFrac = new short[1];
	/** gc_pred.cpp gc_pred */
	public static void gc_pred(State st, int mode, short[] code, int codeOff,
							   short[] exp_gcode0, short[] frac_gcode0,
							   short[] exp_en, short[] frac_en, int[] pOverflow)
							{
		int L_temp1, L_temp2;
		int L_tmp;
		int ener_code;
		int ener;
		int exp_code, gcode0;
		int tmp;
		int pCode = codeOff;
		/* energy of code: ener_code = sum(code[i]^2) */
		ener_code = 0;
		/* MR122: Q12*Q12 -> Q25 ; others: Q13*Q13 -> Q27 */
		for(int i = Cnst.L_SUBFR >> 2; i != 0; i--)
		{
			tmp = code[pCode++];
			ener_code += (tmp * tmp) >> 3;
			tmp = code[pCode++];
			ener_code += (tmp * tmp) >> 3;
			tmp = code[pCode++];
			ener_code += (tmp * tmp) >> 3;
			tmp = code[pCode++];
			ener_code += (tmp * tmp) >> 3;
		}
		ener_code <<= 4; /* C Word32 shift wraps */
		if((ener_code >> 31) != 0)
		{
			/* Check for saturation */
			ener_code = Basicop.MAX_32;
		}
		if(mode == Cnst.MR122)
		{
			/* ener_code = ener_code / lcode; lcode = 40; 1/40 = 26214 Q20 */
			ener_code = (Basicop.pv_round(ener_code, pOverflow) * 26214) << 1;
			/* ener_code = 1/2 * Log2(ener_code); Note: Log2=log2+30 */
			Mathops.Log2(ener_code, scratchExp, scratchFrac, pOverflow);
			final int exp = scratchExp[0];
			final int frac = scratchFrac[0];
			/* Q16 for log() -> Q17 for 1/2 log() */
			L_temp1 = (exp - 30) << 16;
			ener_code = L_temp1 + (frac << 1);
			/* predicted energy: ener(Q24) = MEAN_ENER + sum(pred[i]*past_qua_en[i]) */
			ener = MEAN_ENER_MR122; /* Q24 (Q17) */
			for(int i = 0; i < NPRED; i++)
			{
				L_temp1 = (st.past_qua_en_MR122[i] * pred_MR122[i]) << 1;
				ener = Basicop.L_add(ener, L_temp1, pOverflow);
				/* Q10 * Q6 -> Q17 */
			}
			/* predicted codebook gain: gc0 = Pow2(ener - ener_code) */
			/* Q16 */
			L_temp1 = Basicop.L_sub(ener, ener_code, pOverflow);
			exp_gcode0[0] = (short) ((L_temp1 >> 17) << 16 >> 16);
			L_temp2 = exp_gcode0[0] << 15;
			L_temp1 >>= 2;
			frac_gcode0[0] = (short) (((L_temp1 - L_temp2) << 16) >> 16);
		}
		else
		{
			/* all modes except 12.2 */
			/* Compute: means_ener - 10log10(ener_code/L_SUBFR) */
			exp_code = Basicop.norm_l(ener_code);
			ener_code = Basicop.L_shl(ener_code, exp_code, pOverflow);
			/* Log2 = log2 + 27 */
			Mathops.Log2_norm(ener_code, exp_code, scratchExp, scratchFrac);
			final int exp = scratchExp[0];
			final int frac = scratchFrac[0];
			/* fact = 10/log2(10) = 3.01 = 24660 Q13 */
			L_temp2 = (exp * -24660) << 1;
			L_tmp = (frac * -24660) >> 15;
			/* Sign-extend resulting product */
			if((L_tmp & 0x00010000) != 0)
			{
				L_tmp = L_tmp | 0xffff0000;
			}
			L_tmp <<= 1;
			L_tmp = Basicop.L_add(L_tmp, L_temp2, pOverflow);
			if(mode == Cnst.MR102)
			{
				/* mean = 33 dB */
				L_temp2 = 16678 << 7;
				L_tmp = Basicop.L_add(L_tmp, L_temp2, pOverflow); /* Q14 */
			}
			else if(mode == Cnst.MR795)
			{
				/* exp_en = -11-exp_code */
				frac_en[0] = (short) ((ener_code >> 16) << 16 >> 16);
				exp_en[0] = (short) (-11 - exp_code);
				/* mean = 36 dB */
				L_temp2 = 17062 << 7;
				L_tmp = Basicop.L_add(L_tmp, L_temp2, pOverflow); /* Q14 */
			}
			else if(mode == Cnst.MR74)
			{
				/* mean = 30 dB */
				L_temp2 = 32588 << 6;
				L_tmp = Basicop.L_add(L_tmp, L_temp2, pOverflow); /* Q14 */
			}
			else if(mode == Cnst.MR67)
			{
				/* mean = 28.75 dB */
				L_temp2 = 32268 << 6;
				L_tmp = Basicop.L_add(L_tmp, L_temp2, pOverflow); /* Q14 */
			}
			else
			{
				/* MR59, MR515, MR475: mean = 33 dB */
				L_temp2 = 16678 << 7;
				L_tmp = Basicop.L_add(L_tmp, L_temp2, pOverflow); /* Q14 */
			}
			/* Compute gcode0: Sum(pred[i]*past_qua_en[i]) - ener_code + mean_ener */
			/* Q24 */
			if(L_tmp > 0x001fffff)
			{
				pOverflow[0] = 1;
				L_tmp = Basicop.MAX_32;
			}
			else if(L_tmp < -2097152)
			{
				pOverflow[0] = 1;
				L_tmp = Basicop.MIN_32;
			}
			else
			{
				L_tmp <<= 10;
			}
			for(int i = 0; i < 4; i++)
			{
				L_temp2 = (pred[i] * st.past_qua_en[i]) << 1;
				L_tmp = Basicop.L_add(L_tmp, L_temp2, pOverflow); /* Q13 * Q10 -> Q24 */
			}
			gcode0 = (L_tmp >> 16) << 16 >> 16; /* Q8 */
			/* gcode0 = pow(10.0, gcode0/20) = pow(2, 0.166*gcode0) */
			if(mode == Cnst.MR74)
			{
				/* For IS641 bitexactness: 5439 Q15 = 0.165985 */
				L_tmp = (gcode0 * 5439) << 1; /* Q8 * Q15 -> Q24 */
			}
			else
			{
				L_tmp = (gcode0 * 5443) << 1; /* Q8 * Q15 -> Q24 */
			}
			if(L_tmp < 0)
			{
				L_tmp = ~((~L_tmp) >> 8);
			}
			else
			{
				L_tmp >>= 8; /* -> Q16 */
			}
			exp_gcode0[0] = (short) ((L_tmp >> 16) << 16 >> 16);
			if(L_tmp < 0)
			{
				L_temp1 = ~((~L_tmp) >> 1);
			}
			else
			{
				L_temp1 = L_tmp >> 1;
			}
			L_temp2 = exp_gcode0[0] << 15;
			frac_gcode0[0] = (short) ((Basicop.L_sub(L_temp1, L_temp2, pOverflow) << 16) >> 16);
			/* -> Q0.Q15 */
		}
	}
	/** gc_pred.cpp gc_pred_update */
	public static void gc_pred_update(State st, int qua_ener_MR122, int qua_ener)
	{
		st.past_qua_en[3] = st.past_qua_en[2];
		st.past_qua_en_MR122[3] = st.past_qua_en_MR122[2];
		st.past_qua_en[2] = st.past_qua_en[1];
		st.past_qua_en_MR122[2] = st.past_qua_en_MR122[1];
		st.past_qua_en[1] = st.past_qua_en[0];
		st.past_qua_en_MR122[1] = st.past_qua_en_MR122[0];
		st.past_qua_en_MR122[0] = (short) qua_ener_MR122; /*    log2 (qua_err), Q10 */
		st.past_qua_en[0] = (short) qua_ener;             /* 20*log10(qua_err), Q10 */
	}
	/**
	 * gc_pred.cpp gc_pred_average_limited.
	 * @param ener_avg_MR122 short[1] out
	 * @param ener_avg short[1] out
	 */
	public static void gc_pred_average_limited(State st, short[] ener_avg_MR122,
											   short[] ener_avg, int[] pOverflow)
											{
		int av_pred_en;
		/* do average in MR122 mode (log2() domain) */
		av_pred_en = 0;
		for(int i = 0; i < NPRED; i++)
		{
			av_pred_en = Basicop.add_16(av_pred_en, st.past_qua_en_MR122[i], pOverflow);
		}
		/* av_pred_en = 0.25*av_pred_en (with sign-extension) */
		if(av_pred_en < 0)
		{
			av_pred_en = ((av_pred_en >> 2) | 0xc000) << 16 >> 16;
		}
		else
		{
			av_pred_en >>= 2;
		}
		if(av_pred_en < MIN_ENERGY_MR122)
		{
			av_pred_en = MIN_ENERGY_MR122;
		}
		ener_avg_MR122[0] = (short) av_pred_en;
		/* do average for other modes (20*log10() domain) */
		av_pred_en = 0;
		for(int i = 0; i < NPRED; i++)
		{
			av_pred_en = Basicop.add_16(av_pred_en, st.past_qua_en[i], pOverflow);
		}
		if(av_pred_en < 0)
		{
			av_pred_en = ((av_pred_en >> 2) | 0xc000) << 16 >> 16;
		}
		else
		{
			av_pred_en >>= 2;
		}
		if(av_pred_en < MIN_ENERGY)
		{
			av_pred_en = MIN_ENERGY;
		}
		ener_avg[0] = (short) av_pred_en;
	}
}
