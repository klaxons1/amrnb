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

/* Ported 1:1 from opencore-amr 0.1.6 (agc.h, agc.cpp) via the JS reference port. The class and member names
 * are kept from the C sources so each block can be diffed
 * against the original files. */

/**
 * AGC, ported from opencore-amr 0.1.6 dec/src/agc.cpp (energy_old,
 * energy_new, agcState, agc_reset, agc, agc2)
 * (via src/dec/agc.js of the JS reference port).
 */

final class Agc
{
	private Agc() {}
	/** agc.h agcState */
	public static final class State
	{
		public int past_gain;
		public State()
		{
			reset();
		}
		/** agc.cpp agc_reset */
		public int reset()
		{
			this.past_gain = 4096; /* initial value of past_gain = 1.0 */
			return 0;
		}
	}
	/** agc.cpp energy_old (static) */
	private static int energy_old(short[] input, int inOff, int l_trm, int[] pOverflow)
	{
		int s = 0;
		int temp;
		for(int i = 0; i < l_trm; i++)
		{
			temp = input[inOff + i] >> 2;
			s = Basicop.L_mac(s, temp, temp, pOverflow);
		}
		return s;
	}
	/** agc.cpp energy_new (static) */
	private static int energy_new(short[] input, int inOff, int l_trm, int[] pOverflow)
	{
		int s = 0;
		final int ov_save = pOverflow[0]; /* save in case energy_old must be called */
		for(int i = 0; i < l_trm; i++)
		{
			s = Basicop.L_mac(s, input[inOff + i], input[inOff + i], pOverflow);
		}
		/* check for overflow */
		if(s != Basicop.MAX_32)
		{
			/* s is a sum of squares, so it won't be negative */
			s = s >> 4;
		}
		else
		{
			pOverflow[0] = ov_save; /* restore overflow flag */
			s = energy_old(input, inOff, l_trm, pOverflow);
		}
		return s;
	}
	/** agc.cpp agc */
	public static void agc(State st, short[] sig_in, int sig_inOff, short[] sig_out, int sig_outOff,
						   int agc_fac, int l_trm, int[] pOverflow)
						{
		int i;
		int exp;
		int gain_in;
		int gain_out;
		int g0;
		int gain;
		int s;
		int L_temp;
		int temp;
		/* calculate gain_out with exponent */
		s = energy_new(sig_out, sig_outOff, l_trm, pOverflow);
		if(s == 0)
		{
			st.past_gain = 0;
			return;
		}
		exp = (Basicop.norm_l(s) - 1) << 16 >> 16;
		L_temp = Basicop.L_shl(s, exp, pOverflow);
		gain_out = Basicop.pv_round(L_temp, pOverflow);
		/* calculate gain_in with exponent */
		s = energy_new(sig_in, sig_inOff, l_trm, pOverflow);
		if(s == 0)
		{
			g0 = 0;
		}
		else
		{
			i = Basicop.norm_l(s);
			/* L_temp = L_shl(s, i, pOverflow); */
			L_temp = s << i;
			gain_in = Basicop.pv_round(L_temp, pOverflow);
			exp = (exp - i) << 16 >> 16;
			/* g0 = (1-agc_fac) * sqrt(gain_in/gain_out) */
			/* s = gain_out / gain_in */
			temp = Basicop.div_s(gain_out, gain_in);
			s = temp;
			s = s << 7;
			s = Basicop.L_shr(s, exp, pOverflow); /* add exponent */
			s = Mathops.Inv_sqrt(s, pOverflow);
			L_temp = s << 9;
			i = ((L_temp + 0x00008000) >> 16) << 16 >> 16;
			/* g0 = i * (1-agc_fac) */
			temp = (32767 - agc_fac) << 16 >> 16;
			g0 = ((i * temp) >> 15) << 16 >> 16;
		}
		/* compute gain[n] = agc_fac*gain[n-1] + (1-agc_fac)*sqrt(gain_in/gain_out)
		   sig_out[n] = gain[n] * sig_out[n] */
		gain = st.past_gain;
		int pSig = sig_outOff;
		for(i = 0; i < l_trm; i++)
		{
			gain = ((gain * agc_fac) >> 15) << 16 >> 16;
			gain = (gain + g0) << 16 >> 16; /* C Word16 += without saturation */
			L_temp = (sig_out[pSig] * gain) << 1;
			sig_out[pSig++] = (short) ((L_temp >> 13) << 16 >> 16);
		}
		st.past_gain = gain;
	}
	/** agc.cpp agc2 */
	public static void agc2(short[] sig_in, int sig_inOff, short[] sig_out, int sig_outOff,
							int l_trm, int[] pOverflow)
							{
		int i;
		int exp;
		int gain_in;
		int gain_out;
		int g0;
		int s;
		int L_temp;
		int temp;
		/* calculate gain_out with exponent */
		s = energy_new(sig_out, sig_outOff, l_trm, pOverflow);
		if(s == 0)
		{
			return;
		}
		exp = (Basicop.norm_l(s) - 1) << 16 >> 16;
		L_temp = Basicop.L_shl(s, exp, pOverflow);
		gain_out = Basicop.pv_round(L_temp, pOverflow);
		/* calculate gain_in with exponent */
		s = energy_new(sig_in, sig_inOff, l_trm, pOverflow);
		if(s == 0)
		{
			g0 = 0;
		}
		else
		{
			i = Basicop.norm_l(s);
			L_temp = Basicop.L_shl(s, i, pOverflow);
			gain_in = Basicop.pv_round(L_temp, pOverflow);
			exp = (exp - i) << 16 >> 16;
			/* g0 = sqrt(gain_in/gain_out) */
			temp = Basicop.div_s(gain_out, gain_in);
			s = temp;
			if(s > 0x00ffffff)
			{
				s = Basicop.MAX_32;
			}
			else if(s < -16777216)
			{
				s = Basicop.MIN_32;
			}
			else
			{
				s = s << 7;
			}
			s = Basicop.L_shr(s, exp, pOverflow); /* add exponent */
			s = Mathops.Inv_sqrt(s, pOverflow);
			if(s > 0x003fffff)
			{
				L_temp = Basicop.MAX_32;
			}
			else if(s < -4194304)
			{
				L_temp = Basicop.MIN_32;
			}
			else
			{
				L_temp = s << 9;
			}
			g0 = Basicop.pv_round(L_temp, pOverflow);
		}
		/* sig_out(n) = gain(n) sig_out(n) */
		for(i = l_trm - 1; i >= 0; i--)
		{
			L_temp = Basicop.L_mult(sig_out[sig_outOff + i], g0, pOverflow);
			if(L_temp > 0x0fffffff)
			{
				sig_out[sig_outOff + i] = Basicop.MAX_16;
			}
			else if(L_temp < -268435456)
			{
				sig_out[sig_outOff + i] = Basicop.MIN_16;
			}
			else
			{
				sig_out[sig_outOff + i] = (short) ((L_temp >> 13) << 16 >> 16);
			}
		}
	}
}
