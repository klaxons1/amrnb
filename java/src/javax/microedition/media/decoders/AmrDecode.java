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

/* Ported 1:1 from opencore-amr 0.1.6 (wmf_to_ets.cpp, amrdecode.cpp, wrapper.cpp) via the JS reference port. The class and member names
 * are kept from the C sources so each block can be diffed
 * against the original files. */

/**
 * Frame unpacking + decode entry, ported from opencore-amr 0.1.6 dec/src:
 *   wmf_to_ets.cpp, amrdecode.cpp (MIME_IETF path), amrnb/wrapper.cpp
 *   (Decoder_Interface_*)
 * (via src/dec/amrdecode.js of the JS reference port).
 */

final class AmrDecode
{
	private AmrDecode() {}
	public static final int NUM_AMRSID_RXMODE_BITS = 3;
	public static final int AMRSID_RXMODE_BIT_OFFSET = 36;
	public static final int AMRSID_RXTYPE_BIT_OFFSET = 35;
	/** wmf_to_ets.cpp wmf_to_ets */
	public static void wmf_to_ets(int frame_type_3gpp, byte[] wmf_input, int wmfOff, short[] ets_output)
	{
		/* Each bit gets its own slot in ets_output; for speech frames the bits
		   are reordered via reorderBits[][]. */
		if(frame_type_3gpp < Cnst.AMR_SID)
		{
			final short[] reorder = REORDER_BITS[frame_type_3gpp];
			for(int i = Tables.numOfBits[frame_type_3gpp] - 1; i >= 0; i--)
			{
				ets_output[reorder[i]] =
					(short) ((wmf_input[wmfOff + (i >> 3)] >> (~i & 0x7)) & 0x01);
			}
		}
		else
		{
			for(int i = Tables.numOfBits[frame_type_3gpp] - 1; i >= 0; i--)
			{
				ets_output[i] =
					(short) ((wmf_input[wmfOff + (i >> 3)] >> (~i & 0x7)) & 0x01);
			}
		}
	}
	/* reorderBits[mode] — mirrors JS tables/index reorderBits */
	public static final short[][] REORDER_BITS =
	{
		Tables.reorderBits_MR475, Tables.reorderBits_MR515, Tables.reorderBits_MR59,
		Tables.reorderBits_MR67, Tables.reorderBits_MR74, Tables.reorderBits_MR795,
		Tables.reorderBits_MR102, Tables.reorderBits_MR122,
	};
	private static final short[] adEtsBuf = new short[Cnst.MAX_SERIAL_SIZE];
	/**
	 * amrdecode.cpp AMRDecode (MIME_IETF input format only).
	 * speech_bits is a byte[] of the frame payload (after the ToC byte).
	 * Returns byte_offset (bytes consumed) or -1 on invalid frame type.
	 */
	public static int AMRDecode(SpDec.State decoder_state, int frame_type,
								byte[] speech_bits, int speechBitsOff,
								short[] raw_pcm, int raw_pcmOff)
								{
		int mode = Cnst.MR475;
		int rx_type = Cnst.RX_NO_DATA;
		final short[] dec_ets_input_bfr = adEtsBuf;
		int byte_offset = -1;
		for(int i = 0; i < Cnst.MAX_SERIAL_SIZE; i++)
		{
			dec_ets_input_bfr[i] = 0;
		}
		/* Convert incoming packetized raw WMF data to ETS format */
		wmf_to_ets(frame_type, speech_bits, speechBitsOff, dec_ets_input_bfr);
		/* Address offset of the start of next frame */
		byte_offset = Tables.WmfDecBytesPerFrame[frame_type];
		/* Determine AMR codec mode and AMR RX frame type */
		if(frame_type <= Cnst.AMR_122)
		{
			mode = frame_type;
			rx_type = Cnst.RX_SPEECH_GOOD;
		}
		else if(frame_type == Cnst.AMR_SID)
		{
			/* read mode info from input buffer */
			int modeStore = 0;
			for(int i = 0; i < NUM_AMRSID_RXMODE_BITS; i++)
			{
				modeStore |= dec_ets_input_bfr[AMRSID_RXMODE_BIT_OFFSET + i] << i;
			}
			mode = modeStore;
			/* Get RX frame type */
			if(dec_ets_input_bfr[AMRSID_RXTYPE_BIT_OFFSET] == 0)
			{
				rx_type = Cnst.RX_SID_FIRST;
			}
			else
			{
				rx_type = Cnst.RX_SID_UPDATE;
			}
		}
		else if(frame_type < Cnst.AMR_NO_DATA)
		{
			/* Invalid frame_type, return error code */
			byte_offset = -1;
		}
		else
		{
			mode = decoder_state.prev_mode;
			/* RX_NO_DATA: exponential decay from latest valid frame for the first
			   6 frames, after that silent frames */
			rx_type = Cnst.RX_NO_DATA;
		}
		/* Proceed with decoding frame, if there are no errors */
		if(byte_offset != -1)
		{
			/* Decode a 20 ms frame */
			SpDec.GSMFrameDecode(decoder_state, mode, dec_ets_input_bfr, 0, rx_type,
				raw_pcm, raw_pcmOff);
			/* Save mode for next frame */
			decoder_state.prev_mode = mode;
		}
		return byte_offset;
	}
	/** wrapper.cpp Decoder_Interface_init */
	public static SpDec.State Decoder_Interface_init()
	{
		return new SpDec.State();
	}
	/**
	 * wrapper.cpp Decoder_Interface_Decode.
	 * @param state Speech_Decode_FrameState
	 * @param input one IETF frame incl. ToC byte
	 * @param output 160 PCM samples
	 * @param bfi bad frame indicator
	 */
	public static void Decoder_Interface_Decode(SpDec.State state, byte[] input,
												short[] output, int bfi)
												{
		int type = (input[0] >> 3) & 0x0f;
		if(bfi != 0)
		{
			type = Cnst.AMR_NO_DATA;
		}
		AMRDecode(state, type, input, 1, output, 0);
	}
}
