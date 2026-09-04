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

/* Ported 1:1 from opencore-amr 0.1.6 (d2_9pf.cpp, d2_11pf.cpp, d3_14pf.cpp, d4_17pf.cpp, d8_31pf.cpp, d1035pf.cpp) via the JS reference port. The class and member names
 * are kept from the C sources so each block can be diffed
 * against the original files. */

/**
 * Algebraic codebook pulse decoders, ported from opencore-amr 0.1.6 dec/src:
 *   d2_9pf.cpp (decode_2i40_9bits), d2_11pf.cpp (decode_2i40_11bits),
 *   d3_14pf.cpp (decode_3i40_14bits), d4_17pf.cpp (decode_4i40_17bits),
 *   d8_31pf.cpp (decompress10, decompress_code, dec_8i40_31bits),
 *   d1035pf.cpp (dec_10i40_35bits)
 * (via src/dec/d_pulse.js of the JS reference port).
 */

final class DPulse
{
	private DPulse() {}
	public static final int POS_CODE = 8191;
	public static final int NEG_CODE = 8191;
	/** d2_9pf.cpp decode_2i40_9bits */
	public static void decode_2i40_9bits(int subNr, int sign, int index, short[] cod, int codOff, int[] pOverflow)
	{
		final short[] pos = new short[2];
		int i, j, k;
		/* Decode the positions; table bit is the MSB */
		j = (index & 64) << 16 >> 16;
		j >>= 3;
		i = index & 7;
		k = Basicop.shl(subNr, 1, pOverflow);
		k = (k + j) << 16 >> 16;
		/* pos0 = i*5 + startPos[j*8 + subNr*2] */
		pos[0] = (short) (i * 5 + Tables.startPos[k++]);
		index >>= 3;
		i = index & 7;
		/* pos1 = i*5 + startPos[j*8 + subNr*2 + 1] */
		pos[1] = (short) (i * 5 + Tables.startPos[k]);
		/* decode the signs and build the codeword */
		for(i = Cnst.L_SUBFR - 1; i >= 0; i--)
		{
			cod[codOff + i] = 0;
		}
		for(j = 0; j < 2; j++)
		{
			i = sign & 0x1;
			cod[codOff + pos[j]] = (short) (i * 16383 - 8192);
			sign >>= 1;
		}
	}
	/** d2_11pf.cpp decode_2i40_11bits */
	public static void decode_2i40_11bits(int sign, int index, short[] cod, int codOff)
	{
		final short[] pos = new short[2];
		int i, j;
		/* Decode the positions */
		j = index & 0x1;
		index >>= 1;
		i = index & 0x7;
		pos[0] = (short) (i * 5 + j * 2 + 1);
		index >>= 3;
		j = index & 0x3;
		index >>= 2;
		i = index & 0x7;
		if(j == 3)
		{
			pos[1] = (short) (i * 5 + 4);
		}
		else
		{
			pos[1] = (short) (i * 5 + j);
		}
		/* decode the signs and build the codeword */
		for(i = 0; i < Cnst.L_SUBFR; i++)
		{
			cod[codOff + i] = 0;
		}
		for(j = 0; j < 2; j++)
		{
			i = sign & 1;
			cod[codOff + pos[j]] = (short) (i * 16383 - 8192);
			sign >>= 1;
		}
	}
	/** d3_14pf.cpp decode_3i40_14bits */
	public static void decode_3i40_14bits(int sign, int index, short[] cod, int codOff)
	{
		final short[] pos = new short[3];
		int i, j;
		/* Decode the positions */
		i = index & 0x7;
		pos[0] = (short) (i * 5);
		index >>= 3;
		j = index & 0x1;
		index >>= 1;
		i = index & 0x7;
		pos[1] = (short) (i * 5 + j * 2 + 1);
		index >>= 3;
		j = index & 0x1;
		index >>= 1;
		i = index & 0x7;
		pos[2] = (short) (i * 5 + j * 2 + 2);
		/* decode the signs and build the codeword */
		for(i = 0; i < Cnst.L_SUBFR; i++)
		{
			cod[codOff + i] = 0;
		}
		for(j = 0; j < 3; j++)
		{
			i = sign & 1;
			cod[codOff + pos[j]] = (short) (i * 16383 - 8192);
			sign >>= 1;
		}
	}
	/** d4_17pf.cpp decode_4i40_17bits */
	public static void decode_4i40_17bits(int sign, int index, short[] cod, int codOff)
	{
		final short[] pos = new short[4];
		int i, j;
		/* Decode the positions */
		i = index & 0x7;
		i = Tables.dgray[i];
		pos[0] = (short) (i * 5); /* pos0 = i*5 */
		index >>= 3;
		i = index & 0x7;
		i = Tables.dgray[i];
		pos[1] = (short) (i * 5 + 1); /* pos1 = i*5+1 */
		index >>= 3;
		i = index & 0x7;
		i = Tables.dgray[i];
		pos[2] = (short) (i * 5 + 2); /* pos2 = i*5+2 */
		index >>= 3;
		j = index & 0x1;
		index >>= 1;
		i = index & 0x7;
		i = Tables.dgray[i];
		pos[3] = (short) (i * 5 + 3 + j); /* pos3 = i*5+3+j */
		/* decode the signs and build the codeword */
		for(i = 0; i < Cnst.L_SUBFR; i++)
		{
			cod[codOff + i] = 0;
		}
		for(j = 0; j < 4; j++)
		{
			i = sign & 0x1;
			cod[codOff + pos[j]] = (short) (i * 16383 - 8192);
			sign >>= 1;
		}
	}
	/** d8_31pf.cpp decompress10 (static) */
	private static void decompress10(int MSBs, int LSBs, int index1, int index2, int index3,
									 short[] pos_indx, int[] pOverflow)
									{
		int ia, ib, ic;
		int tempWord32;
		if(MSBs > 124)
		{
			MSBs = 124;
		}
		ia = Basicop.mult(MSBs, 1311, pOverflow);
		tempWord32 = Basicop.L_mult(ia, 25, pOverflow);
		ia = ((MSBs - (tempWord32 >> 1)) << 16) >> 16;
		ib = Basicop.mult(ia, 6554, pOverflow);
		tempWord32 = Basicop.L_mult(ib, 5, pOverflow);
		ib = (ia - (((tempWord32 >> 1) << 16) >> 16)) << 16 >> 16;
		ib = Basicop.shl(ib, 1, pOverflow);
		ic = (LSBs - ((LSBs >> 2) << 2)) << 16 >> 16;
		pos_indx[index1] = (short) ((ib + (ic & 1)) << 16 >> 16);
		ib = Basicop.mult(ia, 6554, pOverflow);
		ib = Basicop.shl(ib, 1, pOverflow);
		pos_indx[index2] = (short) ((ib + (ic >> 1)) << 16 >> 16);
		ib = LSBs >> 2;
		ic = Basicop.mult(MSBs, 1311, pOverflow);
		ic = Basicop.shl(ic, 1, pOverflow);
		pos_indx[index3] = (short) Basicop.add_16(ib, ic, pOverflow);
	}
	private static final short[] dcSignIndx = new short[Cnst.NB_TRACK_MR102];
	private static final short[] dcPosIndx = new short[8];
	/** d8_31pf.cpp decompress_code (static) */
	private static void decompress_code(short[] indx, int indxOff, short[] sign_indx,
										short[] pos_indx, int[] pOverflow)
										{
		int ia, ib;
		int MSBs, LSBs, MSBs0_24;
		int tempWord32;
		for(int i = 0; i < Cnst.NB_TRACK_MR102; i++)
		{
			sign_indx[i] = indx[indxOff + i];
		}
		/* First index: 7+1x3 bits */
		MSBs = indx[indxOff + Cnst.NB_TRACK_MR102] >> 3;
		LSBs = indx[indxOff + Cnst.NB_TRACK_MR102] & 0x7;
		decompress10(MSBs, LSBs, 0, 4, 1, pos_indx, pOverflow);
		/* Second index: 7+1x3 bits */
		MSBs = indx[indxOff + Cnst.NB_TRACK_MR102 + 1] >> 3;
		LSBs = indx[indxOff + Cnst.NB_TRACK_MR102 + 1] & 0x7;
		decompress10(MSBs, LSBs, 2, 6, 5, pos_indx, pOverflow);
		/* Third index: 5+1x2 bits */
		MSBs = indx[indxOff + Cnst.NB_TRACK_MR102 + 2] >> 2;
		LSBs = indx[indxOff + Cnst.NB_TRACK_MR102 + 2] & 0x3;
		tempWord32 = Basicop.L_mult(MSBs, 25, pOverflow);
		ia = (Basicop.L_shr(tempWord32, 1, pOverflow) << 16) >> 16;
		ia = (ia + 12) << 16 >> 16;
		MSBs0_24 = ia >> 5;
		ia = Basicop.mult(MSBs0_24, 6554, pOverflow);
		ia &= 1;
		ib = Basicop.mult(MSBs0_24, 6554, pOverflow);
		tempWord32 = Basicop.L_mult(ib, 5, pOverflow);
		ib = (MSBs0_24 - (((tempWord32 >> 1) << 16) >> 16)) << 16 >> 16;
		if(ia == 1)
		{
			ib = (4 - ib) << 16 >> 16;
		}
		ib = Basicop.shl(ib, 1, pOverflow);
		ia = LSBs & 0x1;
		pos_indx[3] = (short) Basicop.add_16(ib, ia, pOverflow);
		ia = Basicop.mult(MSBs0_24, 6554, pOverflow);
		ia = Basicop.shl(ia, 1, pOverflow);
		pos_indx[7] = (short) ((ia + (LSBs >> 1)) << 16 >> 16);
	}
	/** d8_31pf.cpp dec_8i40_31bits (MR102) */
	public static void dec_8i40_31bits(short[] index, int indexOff, short[] cod, int codOff, int[] pOverflow)
	{
		int pos1, pos2, sign;
		final short[] linear_signs = dcSignIndx;
		final short[] linear_codewords = dcPosIndx;
		for(int i = 0; i < Cnst.L_CODE; i++)
		{
			cod[codOff + i] = 0;
		}
		decompress_code(index, indexOff, linear_signs, linear_codewords, pOverflow);
		/* decode the positions and signs of pulses and build the codeword */
		for(int j = 0; j < Cnst.NB_TRACK_MR102; j++)
		{
			/* position of pulse "j" */
			pos1 = ((linear_codewords[j] << 2) + j) << 16 >> 16;
			if(linear_signs[j] == 0)
			{
				sign = POS_CODE; /* +1.0 */
			}
			else
			{
				sign = -NEG_CODE; /* -1.0 */
			}
			if(pos1 < Cnst.L_SUBFR)
			{
				cod[codOff + pos1] = (short) sign; /* avoid buffer overflow */
			}
			/* position of pulse "j+4" */
			pos2 = ((linear_codewords[j + 4] << 2) + j) << 16 >> 16;
			if(pos2 < pos1)
			{
				sign = Basicop.negate(sign);
			}
			if(pos2 < Cnst.L_SUBFR)
			{
				cod[codOff + pos2] = (short) ((cod[codOff + pos2] + sign) << 16 >> 16); /* += */
			}
		}
	}
	/** d1035pf.cpp dec_10i40_35bits (MR122) */
	public static void dec_10i40_35bits(short[] index, int indexOff, short[] cod, int codOff)
	{
		int pos1, pos2, sign, tmp, i;
		for(i = 0; i < Cnst.L_CODE; i++)
		{
			cod[codOff + i] = 0;
		}
		/* decode the positions and signs of pulses and build the codeword */
		for(int j = 0; j < Cnst.NB_TRACK; j++)
		{
			/* compute index i */
			tmp = index[indexOff + j];
			i = tmp & 7;
			i = Tables.dgray[i];
			i = (i * 5) << 16 >> 16;
			pos1 = (i + j) << 16 >> 16; /* position of pulse "j" */
			i = (tmp >> 3) & 1;
			sign = i == 0 ? 4096 : -4096;
			cod[codOff + pos1] = (short) sign;
			/* compute index i for pulse "j+5" */
			i = index[indexOff + j + 5] & 7;
			i = Tables.dgray[i];
			i = (i * 5) << 16 >> 16;
			pos2 = (i + j) << 16 >> 16;
			if(pos2 < pos1)
			{
				sign = Basicop.negate(sign);
			}
			cod[codOff + pos2] = (short) ((cod[codOff + pos2] + sign) << 16 >> 16); /* += */
		}
	}
}
