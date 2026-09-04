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

/* Ported 1:1 from opencore-amr 0.1.6 (cnst.h, mode.h, frame_type_3gpp.h, frame.h) via the JS reference port. The class and member names
 * are kept from the C sources so each block can be diffed
 * against the original files. */

/**
 * Constants and enums, ported from opencore-amr 0.1.6:
 *   .../amr_nb/common/include/cnst.h, mode.h, frame_type_3gpp.h, frame.h
 * (via src/common/cnst.js of the JS reference port).
 */

final class Cnst
{
	private Cnst() {}
	/* cnst.h */
	public static final int L_TOTAL = 320;      /* Total size of speech buffer.             */
	public static final int L_WINDOW = 240;     /* Window size in LP analysis               */
	public static final int L_FRAME = 160;      /* Frame size                               */
	public static final int L_FRAME_BY2 = 80;   /* Frame size divided by 2                  */
	public static final int L_SUBFR = 40;       /* Subframe size                            */
	public static final int L_CODE = 40;        /* codevector length                        */
	public static final int NB_TRACK = 5;       /* number of tracks                         */
	public static final int STEP = 5;           /* codebook step size                       */
	public static final int NB_TRACK_MR102 = 4; /* number of tracks mode mr102              */
	public static final int STEP_MR102 = 4;     /* codebook step size mode mr102            */
	public static final int M = 10;             /* Order of LP filter                       */
	public static final int MP1 = M + 1;        /* Order of LP filter + 1                   */
	public static final int LSF_GAP = 205;      /* Min distance between LSF after quant.    */
	public static final int LSP_PRED_FAC_MR122 = 21299; /* MR122 LSP pred factor (0.65 Q15) */
	public static final int AZ_SIZE = 4 * M + 4; /* Size of array of LP filters in 4 subfrs */
	public static final int PIT_MIN_MR122 = 18; /* Minimum pitch lag (MR122 mode)           */
	public static final int PIT_MIN = 20;       /* Minimum pitch lag (all other modes)      */
	public static final int PIT_MAX = 143;      /* Maximum pitch lag                        */
	public static final int L_INTERPOL = 10 + 1; /* Length of filter for interpolation      */
	public static final int L_INTER_SRCH = 4;   /* Length of filter for CL LTP search       */
	public static final int MU = 26214;         /* Factor for tilt compensation filter 0.8  */
	public static final int AGC_FAC = 29491;    /* Factor for automatic gain control 0.9    */
	public static final int L_NEXT = 40;        /* Overhead in LP analysis                  */
	public static final int SHARPMAX = 13017;   /* Maximum value of pitch sharpening        */
	public static final int SHARPMIN = 0;       /* Minimum value of pitch sharpening        */
	public static final int MAX_PRM_SIZE = 57;  /* max. num. of params                      */
	public static final int MAX_SERIAL_SIZE = 244; /* max. num. of serial bits              */
	public static final int GP_CLIP = 15565;    /* Pitch gain clipping = 0.95               */
	public static final int N_FRAME = 7;        /* old pitch gains in average calculation   */
	public static final int EHF_MASK = 0x0008;  /* encoder homing frame pattern             */
	/* mode.h enum Mode */
	public static final int MR475 = 0;
	public static final int MR515 = 1;
	public static final int MR59 = 2;
	public static final int MR67 = 3;
	public static final int MR74 = 4;
	public static final int MR795 = 5;
	public static final int MR102 = 6;
	public static final int MR122 = 7;
	public static final int MRDTX = 8;
	public static final int N_MODES = 9;
	/* frame_type_3gpp.h enum Frame_Type_3GPP */
	public static final int AMR_475 = 0;
	public static final int AMR_515 = 1;
	public static final int AMR_59 = 2;
	public static final int AMR_67 = 3;
	public static final int AMR_74 = 4;
	public static final int AMR_795 = 5;
	public static final int AMR_102 = 6;
	public static final int AMR_122 = 7;
	public static final int AMR_SID = 8;
	public static final int GSM_EFR_SID = 9;
	public static final int TDMA_EFR_SID = 10;
	public static final int PDC_EFR_SID = 11;
	public static final int FOR_FUTURE_USE1 = 12;
	public static final int FOR_FUTURE_USE2 = 13;
	public static final int FOR_FUTURE_USE3 = 14;
	public static final int AMR_NO_DATA = 15;
	/* frame.h enum RXFrameType */
	public static final int RX_SPEECH_GOOD = 0;
	public static final int RX_SPEECH_DEGRADED = 1;
	public static final int RX_ONSET = 2;
	public static final int RX_SPEECH_BAD = 3;
	public static final int RX_SID_FIRST = 4;
	public static final int RX_SID_UPDATE = 5;
	public static final int RX_SID_BAD = 6;
	public static final int RX_NO_DATA = 7;
	public static final int RX_N_FRAMETYPES = 8;
}
