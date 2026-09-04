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

/* Ported 1:1 from opencore-amr 0.1.6 (d_plsf_3.cpp, d_plsf_5.cpp, d_plsf.h, d_plsf.cpp, int_lsf.cpp) via the JS reference port. The class and member names
 * are kept from the C sources so each block can be diffed
 * against the original files. */

/**
 * LSF decoding, ported from opencore-amr 0.1.6 dec/src:
 *   d_plsf.cpp (D_plsfState, D_plsf_reset), d_plsf_3.cpp (D_plsf_3,
 *   Init_D_plsf_3), d_plsf_5.cpp (D_plsf_5), int_lsf.cpp (Int_lsf)
 * (via src/dec/d_plsf.js of the JS reference port).
 */

final class DPlsf
{
	private DPlsf() {}
	/* d_plsf_3.cpp */
	public static final int ALPHA = 29491;    /* ALPHA    ->  0.9         */
	public static final int ONE_ALPHA = 3277; /* ONE_ALPHA-> (1.0-ALPHA)  */
	/* d_plsf_5.cpp uses different smoothing (0.95) */
	public static final int ALPHA_5 = 31128;
	public static final int ONE_ALPHA_5 = 1639;
	public static final int DICO1_SIZE = 256;
	public static final int DICO2_SIZE = 512;
	public static final int DICO3_SIZE = 512;
	public static final int MR515_3_SIZE = 128;
	public static final int MR795_1_SIZE = 512;
	/** d_plsf.h D_plsfState */
	public static final class State
	{
		public short[] past_r_q;   /* Past quantized prediction error, Q15 */
		public short[] past_lsf_q; /* Past dequantized lsfs,           Q15 */
		public State()
		{
			this.past_r_q = new short[Cnst.M];
			this.past_lsf_q = new short[Cnst.M];
			reset();
		}
		/** d_plsf.cpp D_plsf_reset */
		public int reset()
		{
			for(int i = 0; i < Cnst.M; i++)
			{
				past_r_q[i] = 0;
			}
			System.arraycopy(Tables.mean_lsf_5, 0, past_lsf_q, 0, Cnst.M);
			return 0;
		}
	}
	/** d_plsf_3.cpp Init_D_plsf_3: past_rq_init[] index [0, 7] */
	public static void Init_D_plsf_3(State st, int index)
	{
		System.arraycopy(Tables.past_rq_init, index * Cnst.M, st.past_r_q, 0, Cnst.M);
	}
	private static final short[] lsf1_r3 = new short[Cnst.M];
	private static final short[] lsf1_q3 = new short[Cnst.M];
	/** d_plsf_3.cpp D_plsf_3 */
	public static void D_plsf_3(State st, int mode, int bfi, short[] indice, int indiceOff,
								short[] lsp1_q, int lsp1_qOff, int[] pOverflow)
								{
		int temp;
		int index;
		final short[] lsf1_r = lsf1_r3;
		final short[] lsf1_q = lsf1_q3;
		if(bfi != 0)
		{
			/* if bad frame: use the past LSFs slightly shifted towards their mean */
			for(int i = 0; i < Cnst.M; i++)
			{
				temp = Basicop.mult(st.past_lsf_q[i], ALPHA, pOverflow);
				index = Basicop.mult(Tables.mean_lsf_3[i], ONE_ALPHA, pOverflow);
				lsf1_q[i] = (short) Basicop.add_16(index, temp, pOverflow);
			}
			/* estimate past quantized residual to be used in next frame */
			if(mode != Cnst.MRDTX)
			{
				for(int i = 0; i < Cnst.M; i++)
				{
					temp = Basicop.mult(st.past_r_q[i], Tables.pred_fac_3[i], pOverflow);
					temp = Basicop.add_16(Tables.mean_lsf_3[i], temp, pOverflow);
					st.past_r_q[i] = (short) Basicop.sub(lsf1_q[i], temp, pOverflow);
				}
			}
			else
			{
				for(int i = 0; i < Cnst.M; i++)
				{
					temp = Basicop.add_16(Tables.mean_lsf_3[i], st.past_r_q[i], pOverflow);
					st.past_r_q[i] = (short) Basicop.sub(lsf1_q[i], temp, pOverflow);
				}
			}
		}
		else
		{
			/* if good LSFs received */
			int index_limit_1 = 0;
			final int index_limit_2 = (DICO2_SIZE - 1) * 3;
			int index_limit_3 = 0;
			short[] p_cb1;
			short[] p_cb3;
			final short[] p_cb2 = Tables.dico2_lsf_3;
			if(mode == Cnst.MR475 || mode == Cnst.MR515)
			{
				p_cb1 = Tables.dico1_lsf_3;
				p_cb3 = Tables.mr515_3_lsf;
				index_limit_1 = (DICO1_SIZE - 1) * 3;
				index_limit_3 = (MR515_3_SIZE - 1) * 4;
			}
			else if(mode == Cnst.MR795)
			{
				p_cb1 = Tables.mr795_1_lsf;
				p_cb3 = Tables.dico3_lsf_3;
				index_limit_1 = (MR795_1_SIZE - 1) * 3;
				index_limit_3 = (DICO3_SIZE - 1) * 4;
			}
			else
			{
				/* MR59, MR67, MR74, MR102, MRDTX */
				p_cb1 = Tables.dico1_lsf_3;
				p_cb3 = Tables.dico3_lsf_3;
				index_limit_1 = (DICO1_SIZE - 1) * 3;
				index_limit_3 = (DICO3_SIZE - 1) * 4;
			}
			/* decode prediction residuals from 3 received indices */
			int pInd = indiceOff;
			index = indice[pInd++];
			temp = index + (index << 1); /* 3*index */
			if(temp > index_limit_1)
			{
				temp = index_limit_1; /* avoid buffer overrun */
			}
			lsf1_r[0] = p_cb1[temp];
			lsf1_r[1] = p_cb1[temp + 1];
			lsf1_r[2] = p_cb1[temp + 2];
			index = indice[pInd++];
			if(mode == Cnst.MR475 || mode == Cnst.MR515)
			{
				/* MR475, MR515 only using every second entry */
				index <<= 1;
			}
			temp = index + (index << 1); /* 3*index */
			if(temp > index_limit_2)
			{
				temp = index_limit_2;
			}
			lsf1_r[3] = p_cb2[temp];
			lsf1_r[4] = p_cb2[temp + 1];
			lsf1_r[5] = p_cb2[temp + 2];
			index = indice[pInd++];
			temp = index << 2;
			if(temp > index_limit_3)
			{
				temp = index_limit_3;
			}
			lsf1_r[6] = p_cb3[temp];
			lsf1_r[7] = p_cb3[temp + 1];
			lsf1_r[8] = p_cb3[temp + 2];
			lsf1_r[9] = p_cb3[temp + 3];
			/* Compute quantized LSFs and update the past quantized residual */
			if(mode != Cnst.MRDTX)
			{
				for(int i = 0; i < Cnst.M; i++)
				{
					temp = Basicop.mult(st.past_r_q[i], Tables.pred_fac_3[i], pOverflow);
					temp = Basicop.add_16(Tables.mean_lsf_3[i], temp, pOverflow);
					lsf1_q[i] = (short) Basicop.add_16(lsf1_r[i], temp, pOverflow);
					st.past_r_q[i] = lsf1_r[i];
				}
			}
			else
			{
				for(int i = 0; i < Cnst.M; i++)
				{
					temp = Basicop.add_16(Tables.mean_lsf_3[i], st.past_r_q[i], pOverflow);
					lsf1_q[i] = (short) Basicop.add_16(lsf1_r[i], temp, pOverflow);
					st.past_r_q[i] = lsf1_r[i];
				}
			}
		}
		/* verification that LSFs has minimum distance of LSF_GAP Hz */
		LspFns.Reorder_lsf(lsf1_q, 0, Cnst.LSF_GAP, Cnst.M, pOverflow);
		System.arraycopy(lsf1_q, 0, st.past_lsf_q, 0, Cnst.M);
		/* convert LSFs to the cosine domain */
		LspFns.Lsf_lsp(lsf1_q, 0, lsp1_q, lsp1_qOff, Cnst.M, pOverflow);
	}
	private static final short[] lsf1_r5 = new short[Cnst.M];
	private static final short[] lsf2_r5 = new short[Cnst.M];
	private static final short[] lsf1_q5 = new short[Cnst.M];
	private static final short[] lsf2_q5 = new short[Cnst.M];
	/** d_plsf_5.cpp D_plsf_5 (MR122) */
	public static void D_plsf_5(State st, int bfi, short[] indice, int indiceOff,
								short[] lsp1_q, int lsp1_qOff, short[] lsp2_q, int lsp2_qOff,
								int[] pOverflow)
								{
		int temp;
		int sign;
		int i;
		final short[] lsf1_r = lsf1_r5;
		final short[] lsf2_r = lsf2_r5;
		final short[] lsf1_q = lsf1_q5;
		final short[] lsf2_q = lsf2_q5;
		if(bfi != 0)
		{
			/* if bad frame: use the past LSFs slightly shifted towards their mean */
			for(i = 0; i < Cnst.M; i++)
			{
				temp = ((st.past_lsf_q[i] * ALPHA_5) >> 15) << 16 >> 16;
				sign = ((Tables.mean_lsf_5[i] * ONE_ALPHA_5) >> 15) << 16 >> 16;
				lsf1_q[i] = (short) Basicop.add_16(sign, temp, pOverflow);
				lsf2_q[i] = lsf1_q[i];
				/* estimate past quantized residual to be used in next frame */
				temp = ((st.past_r_q[i] * Cnst.LSP_PRED_FAC_MR122) >> 15) << 16 >> 16;
				temp = Basicop.add_16(Tables.mean_lsf_5[i], temp, pOverflow);
				st.past_r_q[i] = (short) Basicop.sub(lsf2_q[i], temp, pOverflow);
			}
		}
		else
		{
			/* if good LSFs received: decode prediction residuals from 5 indices */
			temp = Basicop.shl(indice[indiceOff], 2, pOverflow);
			lsf1_r[0] = Tables.dico1_lsf_5[temp];
			lsf1_r[1] = Tables.dico1_lsf_5[temp + 1];
			lsf2_r[0] = Tables.dico1_lsf_5[temp + 2];
			lsf2_r[1] = Tables.dico1_lsf_5[temp + 3];
			temp = Basicop.shl(indice[indiceOff + 1], 2, pOverflow);
			lsf1_r[2] = Tables.dico2_lsf_5[temp];
			lsf1_r[3] = Tables.dico2_lsf_5[temp + 1];
			lsf2_r[2] = Tables.dico2_lsf_5[temp + 2];
			lsf2_r[3] = Tables.dico2_lsf_5[temp + 3];
			sign = indice[indiceOff + 2] & 1;
			if(indice[indiceOff + 2] < 0)
			{
				i = ~(~indice[indiceOff + 2] >> 1);
			}
			else
			{
				i = indice[indiceOff + 2] >> 1;
			}
			temp = Basicop.shl(i, 2, pOverflow);
			if(sign == 0)
			{
				lsf1_r[4] = Tables.dico3_lsf_5[temp];
				lsf1_r[5] = Tables.dico3_lsf_5[temp + 1];
				lsf2_r[4] = Tables.dico3_lsf_5[temp + 2];
				lsf2_r[5] = Tables.dico3_lsf_5[temp + 3];
			}
			else
			{
				lsf1_r[4] = (short) Basicop.negate(Tables.dico3_lsf_5[temp]);
				lsf1_r[5] = (short) Basicop.negate(Tables.dico3_lsf_5[temp + 1]);
				lsf2_r[4] = (short) Basicop.negate(Tables.dico3_lsf_5[temp + 2]);
				lsf2_r[5] = (short) Basicop.negate(Tables.dico3_lsf_5[temp + 3]);
			}
			temp = Basicop.shl(indice[indiceOff + 3], 2, pOverflow);
			lsf1_r[6] = Tables.dico4_lsf_5[temp];
			lsf1_r[7] = Tables.dico4_lsf_5[temp + 1];
			lsf2_r[6] = Tables.dico4_lsf_5[temp + 2];
			lsf2_r[7] = Tables.dico4_lsf_5[temp + 3];
			temp = Basicop.shl(indice[indiceOff + 4], 2, pOverflow);
			lsf1_r[8] = Tables.dico5_lsf_5[temp];
			lsf1_r[9] = Tables.dico5_lsf_5[temp + 1];
			lsf2_r[8] = Tables.dico5_lsf_5[temp + 2];
			lsf2_r[9] = Tables.dico5_lsf_5[temp + 3];
			/* Compute quantized LSFs and update the past quantized residual */
			for(i = 0; i < Cnst.M; i++)
			{
				temp = Basicop.mult(st.past_r_q[i], Cnst.LSP_PRED_FAC_MR122, pOverflow);
				temp = Basicop.add_16(Tables.mean_lsf_5[i], temp, pOverflow);
				lsf1_q[i] = (short) Basicop.add_16(lsf1_r[i], temp, pOverflow);
				lsf2_q[i] = (short) Basicop.add_16(lsf2_r[i], temp, pOverflow);
				st.past_r_q[i] = lsf2_r[i];
			}
		}
		/* verification that LSFs have minimum distance of LSF_GAP Hz */
		LspFns.Reorder_lsf(lsf1_q, 0, Cnst.LSF_GAP, Cnst.M, pOverflow);
		LspFns.Reorder_lsf(lsf2_q, 0, Cnst.LSF_GAP, Cnst.M, pOverflow);
		System.arraycopy(lsf2_q, 0, st.past_lsf_q, 0, Cnst.M);
		/* convert LSFs to the cosine domain */
		LspFns.Lsf_lsp(lsf1_q, 0, lsp1_q, lsp1_qOff, Cnst.M, pOverflow);
		LspFns.Lsf_lsp(lsf2_q, 0, lsp2_q, lsp2_qOff, Cnst.M, pOverflow);
	}
	/** int_lsf.cpp Int_lsf: interpolate LSF for subframe i_subfr (0,40,80,120) */
	public static void Int_lsf(short[] lsf_old, int lsf_oldOff, short[] lsf_new, int lsf_newOff,
							   int i_subfr, short[] lsf_out, int lsf_outOff, int[] pOverflow)
							{
		int temp1;
		int temp2;
		if(i_subfr == 0)
		{
			for(int i = Cnst.M - 1; i >= 0; i--)
			{
				if(lsf_old[lsf_oldOff + i] < 0)
				{
					temp1 = ~(~lsf_old[lsf_oldOff + i] >> 2);
				}
				else
				{
					temp1 = lsf_old[lsf_oldOff + i] >> 2;
				}
				if(lsf_new[lsf_newOff + i] < 0)
				{
					temp2 = ~(~lsf_new[lsf_newOff + i] >> 2);
				}
				else
				{
					temp2 = lsf_new[lsf_newOff + i] >> 2;
				}
				lsf_out[lsf_outOff + i] = (short) Basicop.add_16(
					(lsf_old[lsf_oldOff + i] - temp1) << 16 >> 16,
					temp2 << 16 >> 16, pOverflow);
			}
		}
		else if(i_subfr == 40)
		{
			for(int i = Cnst.M - 1; i >= 0; i--)
			{
				if(lsf_old[lsf_oldOff + i] < 0)
				{
					temp1 = ~(~lsf_old[lsf_oldOff + i] >> 1);
				}
				else
				{
					temp1 = lsf_old[lsf_oldOff + i] >> 1;
				}
				if(lsf_new[lsf_newOff + i] < 0)
				{
					temp2 = ~(~lsf_new[lsf_newOff + i] >> 1);
				}
				else
				{
					temp2 = lsf_new[lsf_newOff + i] >> 1;
				}
				lsf_out[lsf_outOff + i] = (short) (temp1 + temp2);
			}
		}
		else if(i_subfr == 80)
		{
			for(int i = Cnst.M - 1; i >= 0; i--)
			{
				if(lsf_old[lsf_oldOff + i] < 0)
				{
					temp1 = ~(~lsf_old[lsf_oldOff + i] >> 2);
				}
				else
				{
					temp1 = lsf_old[lsf_oldOff + i] >> 2;
				}
				if(lsf_new[lsf_newOff + i] < 0)
				{
					temp2 = ~(~lsf_new[lsf_newOff + i] >> 2);
				}
				else
				{
					temp2 = lsf_new[lsf_newOff + i] >> 2;
				}
				lsf_out[lsf_outOff + i] = (short) Basicop.add_16(
					temp1 << 16 >> 16,
					(lsf_new[lsf_newOff + i] - temp2) << 16 >> 16, pOverflow);
			}
		}
		else if(i_subfr == 120)
		{
			for(int i = Cnst.M - 1; i >= 0; i--)
			{
				lsf_out[lsf_outOff + i] = lsf_new[lsf_newOff + i];
			}
		}
	}
}
