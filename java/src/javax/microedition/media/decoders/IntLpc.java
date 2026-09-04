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

/* Ported 1:1 from opencore-amr 0.1.6 (int_lpc.cpp, lsfwt.cpp) via the JS reference port. The class and member names
 * are kept from the C sources so each block can be diffed
 * against the original files. */

/**
 * LPC interpolation, ported from opencore-amr 0.1.6 common/src/int_lpc.cpp
 * and lsfwt.cpp (via src/common/int_lpc.js of the JS reference port).
 */

final class IntLpc
{
	private IntLpc() {}
	private static final short[] lspTmp = new short[Cnst.M];
	/** int_lpc.cpp Int_lpc_1and3: Az[AZ_SIZE] for all 4 subframes */
	public static void Int_lpc_1and3(short[] lsp_old, int lsp_oldOff, short[] lsp_mid, int lsp_midOff,
									 short[] lsp_new, int lsp_newOff, short[] Az, int AzOff, int[] pOverflow)
									{
		final short[] lsp = lspTmp;
		/* lsp[i] = lsp_mid[i] * 0.5 + lsp_old[i] * 0.5 */
		for(int i = 0; i < Cnst.M; i++)
		{
			lsp[i] = (short) ((lsp_old[lsp_oldOff + i] >> 1) + (lsp_mid[lsp_midOff + i] >> 1));
		}
		LspFns.Lsp_Az(lsp, 0, Az, AzOff, pOverflow); /* Subframe 1 */
		LspFns.Lsp_Az(lsp_mid, lsp_midOff, Az, AzOff + Cnst.MP1, pOverflow); /* Subframe 2 */
		for(int i = 0; i < Cnst.M; i++)
		{
			lsp[i] = (short) ((lsp_mid[lsp_midOff + i] >> 1) + (lsp_new[lsp_newOff + i] >> 1));
		}
		LspFns.Lsp_Az(lsp, 0, Az, AzOff + 2 * Cnst.MP1, pOverflow); /* Subframe 3 */
		LspFns.Lsp_Az(lsp_new, lsp_newOff, Az, AzOff + 3 * Cnst.MP1, pOverflow); /* Subframe 4 */
	}
	/** int_lpc.cpp Int_lpc_1and3_2: only subframes 1 and 3 (2,4 already known) */
	public static void Int_lpc_1and3_2(short[] lsp_old, int lsp_oldOff, short[] lsp_mid, int lsp_midOff,
									   short[] lsp_new, int lsp_newOff, short[] Az, int AzOff, int[] pOverflow)
									{
		final short[] lsp = lspTmp;
		for(int i = 0; i < Cnst.M; i++)
		{
			lsp[i] = (short) ((lsp_old[lsp_oldOff + i] >> 1) + (lsp_mid[lsp_midOff + i] >> 1));
		}
		LspFns.Lsp_Az(lsp, 0, Az, AzOff, pOverflow); /* Subframe 1 */
		for(int i = 0; i < Cnst.M; i++)
		{
			lsp[i] = (short) ((lsp_mid[lsp_midOff + i] >> 1) + (lsp_new[lsp_newOff + i] >> 1));
		}
		LspFns.Lsp_Az(lsp, 0, Az, AzOff + 2 * Cnst.MP1, pOverflow); /* Subframe 3 */
	}
	/** int_lpc.cpp Int_lpc_1to3: Az[AZ_SIZE] for all 4 subframes */
	public static void Int_lpc_1to3(short[] lsp_old, int lsp_oldOff, short[] lsp_new, int lsp_newOff,
									short[] Az, int AzOff, int[] pOverflow)
									{
		final short[] lsp = lspTmp;
		int temp;
		for(int i = 0; i < Cnst.M; i++)
		{
			temp = (lsp_old[lsp_oldOff + i] - (lsp_old[lsp_oldOff + i] >> 2)) << 16 >> 16;
			lsp[i] = (short) (temp + (lsp_new[lsp_newOff + i] >> 2));
		}
		LspFns.Lsp_Az(lsp, 0, Az, AzOff, pOverflow); /* Subframe 1 */
		for(int i = 0; i < Cnst.M; i++)
		{
			lsp[i] = (short) ((lsp_new[lsp_newOff + i] >> 1) + (lsp_old[lsp_oldOff + i] >> 1));
		}
		LspFns.Lsp_Az(lsp, 0, Az, AzOff + Cnst.MP1, pOverflow); /* Subframe 2 */
		for(int i = 0; i < Cnst.M; i++)
		{
			temp = (lsp_new[lsp_newOff + i] - (lsp_new[lsp_newOff + i] >> 2)) << 16 >> 16;
			lsp[i] = (short) (temp + (lsp_old[lsp_oldOff + i] >> 2));
		}
		LspFns.Lsp_Az(lsp, 0, Az, AzOff + 2 * Cnst.MP1, pOverflow); /* Subframe 3 */
		LspFns.Lsp_Az(lsp_new, lsp_newOff, Az, AzOff + 3 * Cnst.MP1, pOverflow); /* Subframe 4 */
	}
	/** int_lpc.cpp Int_lpc_1to3_2: only subframes 1, 2, 3 (4 already known) */
	public static void Int_lpc_1to3_2(short[] lsp_old, int lsp_oldOff, short[] lsp_new, int lsp_newOff,
									  short[] Az, int AzOff, int[] pOverflow)
									{
		final short[] lsp = lspTmp;
		int temp;
		for(int i = 0; i < Cnst.M; i++)
		{
			temp = (lsp_old[lsp_oldOff + i] - (lsp_old[lsp_oldOff + i] >> 2)) << 16 >> 16;
			lsp[i] = (short) (temp + (lsp_new[lsp_newOff + i] >> 2));
		}
		LspFns.Lsp_Az(lsp, 0, Az, AzOff, pOverflow); /* Subframe 1 */
		for(int i = 0; i < Cnst.M; i++)
		{
			lsp[i] = (short) ((lsp_new[lsp_newOff + i] >> 1) + (lsp_old[lsp_oldOff + i] >> 1));
		}
		LspFns.Lsp_Az(lsp, 0, Az, AzOff + Cnst.MP1, pOverflow); /* Subframe 2 */
		for(int i = 0; i < Cnst.M; i++)
		{
			temp = (lsp_new[lsp_newOff + i] - (lsp_new[lsp_newOff + i] >> 2)) << 16 >> 16;
			lsp[i] = (short) (temp + (lsp_old[lsp_oldOff + i] >> 2));
		}
		LspFns.Lsp_Az(lsp, 0, Az, AzOff + 2 * Cnst.MP1, pOverflow); /* Subframe 3 */
	}
	/** lsfwt.cpp Lsf_wt (pOverflow intentionally unused) */
	public static void Lsf_wt(short[] lsf, int lsfOff, short[] wf, int wfOff, int[] pOverflow)
	{
		int temp;
		int wgt_fct;
		int pWf = wfOff;
		int pLsf = lsfOff;
		int pLsf2 = lsfOff + 1;
		/* wf[0] = lsf[1] - 0 */
		wf[pWf++] = lsf[pLsf2++];
		for(int i = 4; i != 0; i--)
		{
			wf[pWf++] = (short) (lsf[pLsf2++] - lsf[pLsf++]);
			wf[pWf++] = (short) (lsf[pLsf2++] - lsf[pLsf++]);
		}
		/* wf[9] = 4000 - lsf[8] */
		wf[pWf] = (short) (16384 - lsf[pLsf]);
		pWf = wfOff;
		for(int i = 10; i != 0; i--)
		{
			/* (wf[i] - 450); 1843 == 450 Hz (Q15 considering 7FFF = 8000 Hz) */
			wgt_fct = wf[pWf];
			temp = (wgt_fct - 1843) << 16 >> 16;
			if(temp > 0)
			{
				temp = (temp * 6242) >> 15 << 16 >> 16;
				wgt_fct = (1843 - temp) << 16 >> 16;
			}
			else
			{
				temp = (wgt_fct * 28160) >> 15 << 16 >> 16;
				wgt_fct = (3427 - temp) << 16 >> 16;
			}
			wf[pWf++] = (short) (wgt_fct << 3); /* short store truncates as C Word16 */
		}
	}
}
