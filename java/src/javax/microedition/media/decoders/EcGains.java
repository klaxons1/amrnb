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

/* Ported 1:1 from opencore-amr 0.1.6 (ec_gains.h, ec_gains.cpp, lsp_avg.h, lsp_avg.cpp) via the JS reference port. The class and member names
 * are kept from the C sources so each block can be diffed
 * against the original files. */

/**
 * Error-concealment gains and LSP averaging, ported from opencore-amr 0.1.6
 * dec/src/ec_gains.cpp and dec/src/lsp_avg.cpp
 * (via src/dec/ec_gains.js of the JS reference port).
 */

final class EcGains
{
	private EcGains() {}
	/** ec_gains.h ec_gain_pitchState */
	public static final class GainPitchState
	{
		public short[] pbuf;
		public int past_gain_pit;
		public int prev_gp;
		public GainPitchState()
		{
			this.pbuf = new short[5];
			reset();
		}
		/** ec_gains.cpp ec_gain_pitch_reset */
		public int reset()
		{
			for(int i = 0; i < 5; i++)
			{
				pbuf[i] = 1640;
			}
			this.past_gain_pit = 0;
			this.prev_gp = 16384;
			return 0;
		}
	}
	/** ec_gains.h ec_gain_codeState */
	public static final class GainCodeState
	{
		public short[] gbuf;
		public int past_gain_code;
		public int prev_gc;
		public GainCodeState()
		{
			this.gbuf = new short[5];
			reset();
		}
		/** ec_gains.cpp ec_gain_code_reset */
		public int reset()
		{
			for(int i = 0; i < 5; i++)
			{
				gbuf[i] = 1;
			}
			this.past_gain_code = 0;
			this.prev_gc = 1;
			return 0;
		}
	}
	public static final short[] cdown = { 32767, 32112, 32112, 32112, 32112, 32112, 22937 };
	public static final short[] pdown = { 32767, 32112, 32112, 26214, 9830, 6553, 6553 };
	private static final short[] ecQuaEnerMR122 = new short[1];
	private static final short[] ecQuaEner = new short[1];
	/**
	 * ec_gains.cpp ec_gain_code.
	 * @param gain_code short[1] out
	 */
	public static void ec_gain_code(GainCodeState st, GcPred.State pred_state, int state,
									short[] gain_code, int[] pOverflow)
									{
		/* calculate median of last five gain values */
		int tmp = Mathops.gmed_n(st.gbuf, 0, 5);
		/* new gain = minimum(median, past_gain) * cdown[state] */
		if(Basicop.sub(tmp, st.past_gain_code, pOverflow) > 0)
		{
			tmp = st.past_gain_code;
		}
		tmp = Basicop.mult(tmp, cdown[state], pOverflow);
		gain_code[0] = (short) tmp;
		/* update table of past quantized energies with average of current values */
		GcPred.gc_pred_average_limited(pred_state, ecQuaEnerMR122, ecQuaEner, pOverflow);
		GcPred.gc_pred_update(pred_state, ecQuaEnerMR122[0], ecQuaEner[0]);
	}
	/**
	 * ec_gains.cpp ec_gain_code_update.
	 * @param gain_code short[1] in/out
	 */
	public static void ec_gain_code_update(GainCodeState st, int bfi, int prev_bf,
										   short[] gain_code, int[] pOverflow)
										{
		/* limit gain_code by previous good gain if previous frame was bad */
		if(bfi == 0)
		{
			if(prev_bf != 0)
			{
				if(Basicop.sub(gain_code[0], st.prev_gc, pOverflow) > 0)
				{
					gain_code[0] = (short) st.prev_gc;
				}
			}
			st.prev_gc = gain_code[0];
		}
		/* update EC states: previous gain, gain buffer */
		st.past_gain_code = gain_code[0];
		for(int i = 1; i < 5; i++)
		{
			st.gbuf[i - 1] = st.gbuf[i];
		}
		st.gbuf[4] = gain_code[0];
	}
	/**
	 * ec_gains.cpp ec_gain_pitch.
	 * @param gain_pitch short[1] out (Q14)
	 */
	public static void ec_gain_pitch(GainPitchState st, int state, short[] gain_pitch, int[] pOverflow)
	{
		/* calculate median of last five gains */
		int tmp = Mathops.gmed_n(st.pbuf, 0, 5);
		/* new gain = minimum(median, past_gain) * pdown[state] */
		if(Basicop.sub(tmp, st.past_gain_pit, pOverflow) > 0)
		{
			tmp = st.past_gain_pit;
		}
		gain_pitch[0] = (short) Basicop.mult(tmp, pdown[state], pOverflow);
	}
	/**
	 * ec_gains.cpp ec_gain_pitch_update.
	 * @param gain_pitch short[1] in/out
	 */
	public static void ec_gain_pitch_update(GainPitchState st, int bfi, int prev_bf,
											short[] gain_pitch, int[] pOverflow)
											{
		if(bfi == 0)
		{
			if(prev_bf != 0)
			{
				if(Basicop.sub(gain_pitch[0], st.prev_gp, pOverflow) > 0)
				{
					gain_pitch[0] = (short) st.prev_gp;
				}
			}
			st.prev_gp = gain_pitch[0];
		}
		st.past_gain_pit = gain_pitch[0];
		if(Basicop.sub(st.past_gain_pit, 16384, pOverflow) > 0)
		{
			/* if (st->past_gain_pit > 1.0) */
			st.past_gain_pit = 16384;
		}
		for(int i = 1; i < 5; i++)
		{
			st.pbuf[i - 1] = st.pbuf[i];
		}
		st.pbuf[4] = (short) st.past_gain_pit;
	}
	public static final int EXPCONST = 5243; /* 0.16 in Q15 */
	/** lsp_avg.h lsp_avgState */
	public static final class LspAvgState
	{
		public short[] lsp_meanSave; /* Averaged LSPs */
		public LspAvgState()
		{
			this.lsp_meanSave = new short[Cnst.M];
			reset();
		}
		/** lsp_avg.cpp lsp_avg_reset */
		public int reset()
		{
			System.arraycopy(Tables.mean_lsf_5, 0, lsp_meanSave, 0, Cnst.M);
			return 0;
		}
	}
	/** lsp_avg.cpp lsp_avg */
	public static void lsp_avg(LspAvgState st, short[] lsp, int lspOff, int[] pOverflow)
	{
		int L_tmp; /* Q31 */
		for(int i = 0; i < Cnst.M; i++)
		{
			/* mean = 0.84*mean */
			L_tmp = st.lsp_meanSave[i] << 16;
			L_tmp = Basicop.L_msu(L_tmp, EXPCONST, st.lsp_meanSave[i], pOverflow);
			/* Add 0.16 of newest LSPs to mean */
			L_tmp = Basicop.L_mac(L_tmp, EXPCONST, lsp[lspOff + i], pOverflow);
			/* Save means */
			st.lsp_meanSave[i] = (short) Basicop.pv_round(L_tmp, pOverflow); /* Q15 */
		}
	}
}
