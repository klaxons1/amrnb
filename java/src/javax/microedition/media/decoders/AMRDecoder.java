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

/*
 * AMRDecoder - AMR-NB (Adaptive Multi-Rate Narrowband) speech decoder.
 *
 * AMR-NB is the mandatory narrowband speech codec of the 3GPP (TS 26.090),
 * operating at 8 kHz with one of eight bit rates (4.75 - 12.2 kbit/s) plus
 * a comfort-noise (DTX/SID) mode. The bitstream is split into 20 ms frames
 * of 160 samples each.
 *
 * This decoder accepts the common "*.amr" IETF storage format described in
 * RFC 4867 (https://datatracker.ietf.org/doc/html/rfc4867): an optional
 * 6-byte "#!AMR\n" header followed by one Table of Contents (ToC) byte and
 * one frame payload per 20 ms of audio. A ToC byte of 0x00 - 0x07 selects
 * modes MR475 - MR122, 0x08 is a comfort-noise (SID) frame, and 0x0f marks
 * a "no data" frame; see https://wiki.multimedia.cx/index.php/AMR for an
 * overview of the format.
 *
 * The whole file is decoded in one go, mirroring the IMA/Yamaha ADPCM
 * decoders: pass the raw file bytes in and get 16-bit signed little-endian
 * PCM (8000 Hz, mono) back, 320 bytes per decoded frame. Malformed trailing
 * data is ignored - decoding simply stops at the first frame that does not
 * fit the stream - and a stream without a single valid frame yields an
 * empty array.
 *
 * Implementation notes: this is a 1:1 transliteration of the fixed-point
 * reference decoder in opencore-amr 0.1.6 (see the package's other files,
 * one per C module, whose names match the original sources so each block
 * can be diffed against them). Decoding output is verified byte-identical
 * to the reference implementation across all 8 modes, DTX/SID comfort
 * noise frames and bad-frame (BFI) error concealment. The code is pure
 * Java 1.6 with no dependencies, so this whole folder can be dropped into
 * another project as-is (in FreeJ2ME, feed the returned PCM through
 * WAVTools.upsample() before playback, like WAVImaADPCMDecoder does).
 */
public final class AMRDecoder
{

	private static final int[] FRAME_SIZE = { 13, 14, 16, 18, 20, 21, 27, 32, 6, 1, 1, 1, 1, 1, 1, 1 };

	/* Size of one decoded frame in samples (20 ms at 8 kHz) and in bytes. */
	private static final int FRAME_SAMPLES = 160;
	private static final int FRAME_BYTES = FRAME_SAMPLES * 2;

	/* "#!AMR\n" IETF storage-format header. */
	private static final byte[] MAGIC = { 0x23, 0x21, 0x41, 0x4d, 0x52, 0x0a };

	private AMRDecoder() { }

	/*
	 * Decode the given AMR-NB stream (with or without its "#!AMR\n" header)
	 * into 16-bit signed little-endian PCM, 8000 Hz mono.
	 *
	 * The whole stream is decoded into one array: a decoder state is created
	 * for the call, so consecutive calls (even on the same file, or on
	 * consecutive files of a playlist) always start from a clean state.
	 */
	public static final byte[] decodeAMR(final byte[] input, final int inputSize)
	{
		/* Skip the header, if present. */
		int offset = 0;
		if(inputSize >= MAGIC.length)
		{
			boolean magic = true;
			for(int i = 0; i < MAGIC.length; i++)
			{
				if(input[i] != MAGIC[i]) { magic = false; break; }
			}
			if(magic) { offset = MAGIC.length; }
		}

		/* Count the valid frames first, so the output is exactly sized. */
		int nFrames = 0;
		int pos = offset;
		while(pos + 1 <= inputSize)
		{
			final int size = FRAME_SIZE[(input[pos] >> 3) & 0x0f];
			if(pos + size > inputSize) { break; }
			pos += size;
			nFrames++;
		}

		final byte[] output = new byte[nFrames * FRAME_BYTES];
		if(nFrames == 0) { return output; }

		/* Decode every frame in order into the output buffer. */
		final SpDec.State state = AmrDecode.Decoder_Interface_init();
		final byte[] frame = new byte[32];
		final short[] pcm = new short[FRAME_SAMPLES];
		int outputIndex = 0;
		while(offset + 1 <= inputSize)
		{
			final int size = FRAME_SIZE[(input[offset] >> 3) & 0x0f];
			if(offset + size > inputSize) { break; }

			System.arraycopy(input, offset, frame, 0, size);
			AmrDecode.Decoder_Interface_Decode(state, frame, pcm, 0);

			for(int i = 0; i < FRAME_SAMPLES; i++)
			{
				output[outputIndex++] = (byte) pcm[i];
				output[outputIndex++] = (byte) (pcm[i] >> 8);
			}
			offset += size;
		}

		return output;
	}

	/* Convenience overload of decodeAMR() for a whole input array. */
	public static final byte[] decodeAMR(final byte[] input)
	{
		return decodeAMR(input, input.length);
	}
}
