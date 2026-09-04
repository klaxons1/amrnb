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

/* Ported 1:1 from opencore-amr 0.1.6 (lsp_az.cpp, lsp_lsf.cpp, reorder.cpp, az_lsp.cpp) via the JS reference port. The class and member names
 * are kept from the C sources so each block can be diffed
 * against the original files. */

/**
 * LSP/LSF conversion functions, ported from opencore-amr 0.1.6 common/src:
 *   lsp_az.cpp (Get_lsp_pol, Lsp_Az), lsp_lsf.cpp (Lsf_lsp, Lsp_lsf),
 *   az_lsp.cpp (Chebps, Az_lsp), reorder.cpp (Reorder_lsf),
 *   lsp_lsf_tbl.cpp, grid_tbl.cpp
 * (via src/common/lsp_fns.js of the JS reference port).
 */

final class LspFns
{
	private LspFns() {}
	public static final int NC = Cnst.M / 2;
	public static final int grid_points = 60;
	private static final int[] f1Pol = new int[6];
	private static final int[] f2Pol = new int[6];
	/** lsp_az.cpp Get_lsp_pol (static): f is int[6] */
	private static void Get_lsp_pol(short[] lsp, int lspOff, int[] f, int[] pOverflow)
	{
		int hi;
		int lo;
		int t0;
		int fi = 0;
		int li = lspOff;
		/* f[0] = 1.0 */
		f[fi++] = 0x01000000;
		f[fi++] = -lsp[li++] << 10; /* f[1] = -2.0 * lsp[0] */
		li++; /* Advance lsp pointer */
		for(int i = 2; i <= 5; i++)
		{
			f[fi] = f[fi - 2];
			for(int j = 1; j < i; j++)
			{
				hi = (f[fi - 1] >> 16) << 16 >> 16;
				lo = ((f[fi - 1] >> 1) - (hi << 15)) << 16 >> 16;
				t0 = hi * lsp[li];
				t0 += (lo * lsp[li]) >> 15;
				f[fi] = f[fi] + f[fi - 2]; /* *f += f[-2] */
				f[fi] = f[fi] - (t0 << 2); /* *f -= t0 */
				fi--;
			}
			f[fi] = f[fi] - (lsp[li++] << 10);
			fi += i;
			li++;
		}
	}
	/** lsp_az.cpp Lsp_Az: lsp[10] -> a[11] (Q12) */
	public static void Lsp_Az(short[] lsp, int lspOff, short[] a, int aOff, int[] pOverflow)
	{
		int t0;
		int t1;
		final int[] f1 = f1Pol;
		final int[] f2 = f2Pol;
		Get_lsp_pol(lsp, lspOff, f1, pOverflow);
		Get_lsp_pol(lsp, lspOff + 1, f2, pOverflow);
		int pF1 = 5;
		int pF2 = 5;
		for(int i = 5; i > 0; i--)
		{
			f1[pF1] = f1[pF1] + f1[i - 1]; /* C: *(p_f1--) += f1[i-1] */
			pF1--;
			f2[pF2] = f2[pF2] - f2[i - 1]; /* C: *(p_f2--) -= f2[i-1] */
			pF2--;
		}
		int pA = aOff;
		a[pA++] = 4096;
		int iF1 = 1;
		int iF2 = 1;
		for(int i = 1, j = 10; i <= 5; i++, j--)
		{
			t0 = f1[iF1] + f2[iF2];     /* f1[i] + f2[i] */
			t1 = f1[iF1++] - f2[iF2++]; /* f1[i] - f2[i] */
			t0 = t0 + (1 << 12);
			t1 = t1 + (1 << 12);
			a[pA++] = (short) ((t0 >> 13) << 16 >> 16);
			a[aOff + j] = (short) ((t1 >> 13) << 16 >> 16);
		}
	}
	/** lsp_lsf.cpp Lsf_lsp: lsf[m] -> lsp[m] */
	public static void Lsf_lsp(short[] lsf, int lsfOff, short[] lsp, int lspOff, int m, int[] pOverflow)
	{
		for(int i = 0; i < m; i++)
		{
			final int ind = lsf[lsfOff + i] >> 8;       /* ind    = b8-b15 of lsf[i] */
			final int offset = lsf[lsfOff + i] & 0x00ff; /* offset = b0-b7 of lsf[i] */
			/* lsp[i] = Tables.table[ind] + ((Tables.table[ind+1]-Tables.table[ind])*offset) / 256 */
			final int L_tmp = ((Tables.table[ind + 1] - Tables.table[ind]) * offset) >> 8;
			lsp[lspOff + i] = (short) ((Tables.table[ind] + ((L_tmp << 16) >> 16)) << 16 >> 16);
		}
	}
	/** lsp_lsf.cpp Lsp_lsf: lsp[m] -> lsf[m] (pOverflow intentionally unused) */
	public static void Lsp_lsf(short[] lsp, int lspOff, short[] lsf, int lsfOff, int m, int[] pOverflow)
	{
		int ind = 63; /* begin at end of table -1 */
		int pLsp = lspOff + m - 1;
		int pLsf = lsfOff + m - 1;
		for(int i = m - 1; i >= 0; i--)
		{
			/* find value in table that is just greater than lsp[i] */
			final int temp = lsp[pLsp--];
			while(Tables.table[ind] < temp)
			{
				ind--;
			}
			/* acos(lsp[i]) = ind*256 + ((lsp[i]-Tables.table[ind]) * Tables.slope[ind])/4096 */
			int L_tmp = (temp - Tables.table[ind]) * Tables.slope[ind];
			L_tmp = ((L_tmp + 0x00000800)) >> 12;
			lsf[pLsf--] = (short) ((((L_tmp << 16) >> 16) + (ind << 8)) << 16 >> 16);
		}
	}
	/** reorder.cpp Reorder_lsf (pOverflow intentionally unused) */
	public static void Reorder_lsf(short[] lsf, int lsfOff, int min_dist, int n, int[] pOverflow)
	{
		int lsf_min = min_dist;
		int p = lsfOff;
		for(int i = 0; i < n; i++)
		{
			if(lsf[p] < lsf_min)
			{
				lsf[p++] = (short) lsf_min;
				lsf_min = (lsf_min + min_dist) << 16 >> 16;
			}
			else
			{
				lsf_min = (lsf[p++] + min_dist) << 16 >> 16;
			}
		}
	}
	/** az_lsp.cpp Chebps (static; pOverflow intentionally unused) */
	private static int Chebps(int x, short[] f, int n, int[] pOverflow)
	{
		int cheb;
		int b1_h;
		int b1_l;
		int t0;
		int L_temp;
		int pF = 1;
		/* L_temp = 1.0 */
		L_temp = 0x01000000;
		t0 = (x << 10) + (f[pF++] << 14);
		/* b1 = t0 = 2*x + f[1] */
		b1_h = (t0 >> 16) << 16 >> 16;
		b1_l = ((t0 >> 1) - (b1_h << 15)) << 16 >> 16;
		for(int i = 2; i < n; i++)
		{
			/* t0 = 2.0*x*b1 */
			t0 = b1_h * x;
			t0 += (b1_l * x) >> 15;
			t0 <<= 2;
			/* t0 = 2.0*x*b1 - b2 */
			t0 -= L_temp;
			/* t0 = 2.0*x*b1 - b2 + f[i] */
			t0 += (f[pF++] << 14);
			L_temp = (b1_h << 16) + (b1_l << 1);
			/* b0 = 2.0*x*b1 - b2 + f[i] */
			b1_h = (t0 >> 16) << 16 >> 16;
			b1_l = ((t0 >> 1) - (b1_h << 15)) << 16 >> 16;
		}
		/* t0 = x*b1 */
		t0 = b1_h * x;
		t0 += (b1_l * x) >> 15;
		t0 <<= 1;
		/* t0 = x*b1 - b2 */
		t0 -= L_temp;
		/* t0 = x*b1 - b2 + f[i]/2 */
		t0 += (f[pF] << 13);
		if(((long) (t0 + 33554432) & 0xffffffffL) < 67108863L)
		{
			cheb = (t0 >> 10) << 16 >> 16;
		}
		else if(t0 > 0x01ffffff)
		{
			cheb = Basicop.MAX_16;
		}
		else
		{
			cheb = Basicop.MIN_16;
		}
		return cheb;
	}
	private static final short[] azF1 = new short[NC + 1];
	private static final short[] azF2 = new short[NC + 1];
	/** az_lsp.cpp Az_lsp: a[MP1] -> lsp[M] (falls back to old_lsp if <10 roots) */
	public static void Az_lsp(short[] a, int aOff, short[] lsp, int lspOff,
							  short[] old_lsp, int old_lspOff, int[] pOverflow)
							{
		int xlow, ylow, xhigh, yhigh, xmid, ymid, xint;
		int x, y, sign, exp;
		final short[] f1 = azF1;
		final short[] f2 = azF2;
		f1[0] = 1024; /* f1[0] = 1.0 */
		f2[0] = 1024; /* f2[0] = 1.0 */
		for(int i = 0; i < NC; i++)
		{
			final int L_temp1 = a[aOff + i + 1];
			final int L_temp2 = a[aOff + Cnst.M - i];
			/* x = (a[i+1] + a[M-i]) >> 2 */
			x = ((L_temp1 + L_temp2) >> 2) << 16 >> 16;
			/* y = (a[i+1] - a[M-i]) >> 2 */
			y = ((L_temp1 - L_temp2) >> 2) << 16 >> 16;
			/* f1[i+1] = a[i+1] + a[M-i] - f1[i] */
			f1[i + 1] = (short) (x - f1[i]); /* short store truncates as the C Word16 does */
			/* f2[i+1] = a[i+1] - a[M-i] + f2[i] */
			f2[i + 1] = (short) (y + f2[i]);
		}
		int nf = 0; /* number of found frequencies */
		int ip = 0; /* indicator for f1 or f2 */
		short[] coef = f1;
		xlow = Tables.grid[0];
		ylow = Chebps(xlow, coef, NC, pOverflow);
		int j = 0;
		while(nf < Cnst.M && j < grid_points)
		{
			j++;
			xhigh = xlow;
			yhigh = ylow;
			xlow = Tables.grid[j];
			ylow = Chebps(xlow, coef, NC, pOverflow);
			if(ylow * yhigh <= 0)
			{
				/* divide 4 times the interval */
				for(int i = 4; i != 0; i--)
				{
					/* xmid = (xlow + xhigh)/2 */
					x = xlow >> 1;
					y = xhigh >> 1;
					xmid = (x + y) << 16 >> 16;
					ymid = Chebps(xmid, coef, NC, pOverflow);
					if(ylow * ymid <= 0)
					{
						yhigh = ymid;
						xhigh = xmid;
					}
					else
					{
						ylow = ymid;
						xlow = xmid;
					}
				}
				/* Linear interpolation: xint = xlow - ylow*(xhigh-xlow)/(yhigh-ylow) */
				x = (xhigh - xlow) << 16 >> 16;
				y = (yhigh - ylow) << 16 >> 16;
				if(y == 0)
				{
					xint = xlow;
				}
				else
				{
					sign = y;
					y = Basicop.abs_s(y);
					exp = Basicop.norm_s(y);
					y = (y << exp) << 16 >> 16;
					y = Basicop.div_s(16383, y);
					y = ((x * y) >> (19 - exp)) << 16 >> 16;
					if(sign < 0)
					{
						y = (-y) << 16 >> 16;
					}
					/* xint = xlow - ylow*y */
					xint = (xlow - ((ylow * y) >> 10)) << 16 >> 16;
				}
				lsp[lspOff + nf] = (short) xint;
				xlow = xint;
				nf++;
				if(ip == 0)
				{
					ip = 1;
					coef = f2;
				}
				else
				{
					ip = 0;
					coef = f1;
				}
				ylow = Chebps(xlow, coef, NC, pOverflow);
			}
		}
		/* Check if M roots found */
		if(nf < Cnst.M)
		{
			for(int i = 0; i < Cnst.M; i++)
			{
				lsp[lspOff + i] = old_lsp[old_lspOff + i];
			}
		}
	}
}
