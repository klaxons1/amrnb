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

/* Ported 1:1 from opencore-amr 0.1.6 (sp_dec.cpp, sp_dec.h) via the JS reference port. The class and member names
 * are kept from the C sources so each block can be diffed
 * against the original files. */

/**
 * Frame decode assembly, ported from opencore-amr 0.1.6 dec/src/sp_dec.cpp
 * (Bin2int, Bits2prm, Speech_Decode_FrameState, GSMInitDecode,
 * Speech_Decode_Frame_reset, GSMFrameDecode)
 * (via src/dec/sp_dec.js of the JS reference port).
 */

final class SpDec
{
	private SpDec() {}
	/** sp_dec.cpp Bin2int (static) */
	private static int Bin2int(int no_of_bits, short[] bitstream, int bitstreamOff)
	{
		int value = 0;
		for(int i = 0; i < no_of_bits; i++)
		{
			value <<= 1;
			value |= bitstream[bitstreamOff + i];
		}
		return value;
	}
	/** sp_dec.cpp Bits2prm */
	public static void Bits2prm(int mode, short[] bits, int bitsOff, short[] prm, int prmOff)
	{
		int pBits = bitsOff;
		final short[] bitno = DecAmr.BITNO[mode];
		for(int i = 0; i < Tables.prmno[mode]; i++)
		{
			prm[prmOff + i] = (short) Bin2int(bitno[i], bits, pBits);
			pBits += bitno[i];
		}
	}
	/** sp_dec.h Speech_Decode_FrameState */
	public static final class State
	{
		public DecAmr.State decoder_amrState;
		public Pstfilt.State post_state;
		public PostPre.PostProcessState postHP_state;
		public int prev_mode;
		/** sp_dec.cpp GSMInitDecode */
		public State()
		{
			this.decoder_amrState = new DecAmr.State();
			this.post_state = new Pstfilt.State();
			this.postHP_state = new PostPre.PostProcessState();
			this.prev_mode = Cnst.MR475;
			reset();
		}
		/** sp_dec.cpp Speech_Decode_Frame_reset */
		public int reset()
		{
			DecAmr.Decoder_amr_reset(this.decoder_amrState, Cnst.MR475);
			this.post_state.reset();
			this.postHP_state.reset();
			this.prev_mode = Cnst.MR475;
			return 0;
		}
	}
	private static final short[] sdParm = new short[Cnst.MAX_PRM_SIZE + 1];
	private static final short[] sdAzDec = new short[Cnst.AZ_SIZE];
	/** sp_dec.cpp GSMFrameDecode */
	public static void GSMFrameDecode(State st, int mode, short[] serial, int serialOff,
									  int frame_type, short[] synth, int synthOff)
									{
		final short[] parm = sdParm;    /* synthesis parameters */
		final short[] Az_dec = sdAzDec; /* decoded Az for post-filter in 4 subframes */
		final int[] pOverflow = st.decoder_amrState.overflow;
		/* Serial to parameters */
		if(frame_type == Cnst.RX_SID_BAD || frame_type == Cnst.RX_SID_UPDATE)
		{
			/* Override mode to MRDTX */
			Bits2prm(Cnst.MRDTX, serial, serialOff, parm, 0);
		}
		else
		{
			Bits2prm(mode, serial, serialOff, parm, 0);
		}
		/* Synthesis */
		DecAmr.Decoder_amr(st.decoder_amrState, mode, parm, 0, frame_type,
			synth, synthOff, Az_dec, 0);
		/* Post-filter */
		Pstfilt.Post_Filter(st.post_state, mode, synth, synthOff, Az_dec, 0, pOverflow);
		/* post HP filter, and 15->16 bits */
		PostPre.Post_Process(st.postHP_state, synth, synthOff, Cnst.L_FRAME, pOverflow);
		/* Truncate to 13 bits (C builds without NO13BIT defined) */
		for(int i = 0; i < Cnst.L_FRAME; i++)
		{
			synth[synthOff + i] = (short) (synth[synthOff + i] & 0xfff8);
		}
	}
}
