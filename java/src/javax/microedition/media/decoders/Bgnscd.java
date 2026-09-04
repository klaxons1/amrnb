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

/* Ported 1:1 from opencore-amr 0.1.6 (bgnscd.h, bgnscd.cpp) via the JS reference port. The class and member names
 * are kept from the C sources so each block can be diffed
 * against the original files. */

/**
 * Background noise source characteristic detector, ported from
 * opencore-amr 0.1.6 dec/src/bgnscd.cpp
 * (via src/dec/bgnscd.js of the JS reference port).
 */

final class Bgnscd
{
	private Bgnscd() {}
	public static final int L_ENERGYHIST = 60;
	public static final int FRAMEENERGYLIMIT = 17578; /* 150 */
	public static final int LOWERNOISELIMIT = 20;     /*   5 */
	public static final int UPPERNOISELIMIT = 1953;   /*  50 */
	/** bgnscd.h Bgn_scdState */
	public static final class State
	{
		public short[] frameEnergyHist;
		public int bgHangover;
		public State()
		{
			this.frameEnergyHist = new short[L_ENERGYHIST];
			this.bgHangover = 0;
			reset();
		}
		/** bgnscd.cpp Bgn_scd_reset */
		public int reset()
		{
			for(int i = 0; i < L_ENERGYHIST; i++)
			{
				frameEnergyHist[i] = 0;
			}
			this.bgHangover = 0;
			return 0;
		}
	}
	/**
	 * bgnscd.cpp Bgn_scd: returns inbgNoise flag.
	 * @param voicedHangover short[1] in/out
	 */
	public static int Bgn_scd(State st, short[] ltpGainHist, int ltpGainHistOff,
							  short[] speech, int speechOff, short[] voicedHangover, int[] pOverflow)
							{
		int prevVoiced, inbgNoise;
		int temp;
		int ltpLimit, frameEnergyMin;
		int currEnergy, noiseFloor, maxEnergy, maxEnergyLastPart;
		int s, L_temp;
		/* Update the inBackgroundNoise flag (valid for use in next frame if BFI);
		   it works as an energy detector floating on top, not as good as a VAD. */
		s = 0;
		for(int i = Cnst.L_FRAME - 1; i >= 0; i--)
		{
			L_temp = speech[speechOff + i] * speech[speechOff + i];
			if(L_temp != 0x40000000)
			{
				L_temp = L_temp << 1;
			}
			else
			{
				L_temp = Basicop.MAX_32;
			}
			s = Basicop.L_add(s, L_temp, pOverflow);
		}
		/* s is a sum of squares, so don't need to check for neg overflow */
		if(s > 0x1fffffff)
		{
			currEnergy = Basicop.MAX_16;
		}
		else
		{
			currEnergy = (s >> 14) << 16 >> 16;
		}
		frameEnergyMin = 32767;
		for(int i = L_ENERGYHIST - 1; i >= 0; i--)
		{
			if(st.frameEnergyHist[i] < frameEnergyMin)
			{
				frameEnergyMin = st.frameEnergyHist[i];
			}
		}
		/* Frame Energy Margin of 16 */
		L_temp = frameEnergyMin << 4;
		if(L_temp != ((L_temp << 16) >> 16))
		{
			if(L_temp > 0)
			{
				noiseFloor = Basicop.MAX_16;
			}
			else
			{
				noiseFloor = Basicop.MIN_16;
			}
		}
		else
		{
			noiseFloor = (L_temp << 16) >> 16;
		}
		maxEnergy = st.frameEnergyHist[0];
		for(int i = L_ENERGYHIST - 5; i >= 1; i--)
		{
			if(maxEnergy < st.frameEnergyHist[i])
			{
				maxEnergy = st.frameEnergyHist[i];
			}
		}
		maxEnergyLastPart = st.frameEnergyHist[(2 * L_ENERGYHIST / 3)];
		for(int i = (2 * L_ENERGYHIST / 3) + 1; i < L_ENERGYHIST; i++)
		{
			if(maxEnergyLastPart < st.frameEnergyHist[i])
			{
				maxEnergyLastPart = st.frameEnergyHist[i];
			}
		}
		/* Mark as noise if under current noise limit
		   OR if the maximum energy is below the upper limit */
		if(maxEnergy > LOWERNOISELIMIT
			&& currEnergy < FRAMEENERGYLIMIT
			&& currEnergy > LOWERNOISELIMIT
			&& (currEnergy < noiseFloor || maxEnergyLastPart < UPPERNOISELIMIT))
			{
			if(st.bgHangover + 1 > 30)
			{
				st.bgHangover = 30;
			}
			else
			{
				st.bgHangover += 1;
			}
		}
		else
		{
			st.bgHangover = 0;
		}
		/* make final decision about frame state, act somewhat cautiously */
		inbgNoise = st.bgHangover > 1 ? 1 : 0;
		for(int i = 0; i < L_ENERGYHIST - 1; i++)
		{
			st.frameEnergyHist[i] = st.frameEnergyHist[i + 1];
		}
		st.frameEnergyHist[L_ENERGYHIST - 1] = (short) currEnergy;
		/* prepare for voicing decision; tighten threshold after some time in noise */
		if(st.bgHangover > 15)
		{
			ltpLimit = 16383; /* 1.00 Q14 */
		}
		else if(st.bgHangover > 8)
		{
			ltpLimit = 15565; /* 0.95 Q14 */
		}
		else
		{
			ltpLimit = 13926; /* 0.85 Q14 */
		}
		/* weak sort of voicing indication */
		prevVoiced = 0;
		if(Mathops.gmed_n(ltpGainHist, ltpGainHistOff + 4, 5) > ltpLimit)
		{
			prevVoiced = 1;
		}
		if(st.bgHangover > 20)
		{
			if(Mathops.gmed_n(ltpGainHist, ltpGainHistOff, 9) > ltpLimit)
			{
				prevVoiced = 1;
			}
			else
			{
				prevVoiced = 0;
			}
		}
		if(prevVoiced != 0)
		{
			voicedHangover[0] = 0;
		}
		else
		{
			temp = voicedHangover[0] + 1;
			if(temp > 10)
			{
				voicedHangover[0] = 10;
			}
			else
			{
				voicedHangover[0] = (short) temp;
			}
		}
		return inbgNoise;
	}
}
