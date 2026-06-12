/*
 * Constants and enums, ported from opencore-amr 0.1.6:
 *   .../amr_nb/common/include/cnst.h, mode.h, frame_type_3gpp.h, frame.h
 */

/* cnst.h */
export const L_TOTAL = 320;      /* Total size of speech buffer.             */
export const L_WINDOW = 240;     /* Window size in LP analysis               */
export const L_FRAME = 160;      /* Frame size                               */
export const L_FRAME_BY2 = 80;   /* Frame size divided by 2                  */
export const L_SUBFR = 40;       /* Subframe size                            */
export const L_CODE = 40;        /* codevector length                        */
export const NB_TRACK = 5;       /* number of tracks                         */
export const STEP = 5;           /* codebook step size                       */
export const NB_TRACK_MR102 = 4; /* number of tracks mode mr102              */
export const STEP_MR102 = 4;     /* codebook step size mode mr102            */
export const M = 10;             /* Order of LP filter                       */
export const MP1 = M + 1;        /* Order of LP filter + 1                   */
export const LSF_GAP = 205;      /* Min distance between LSF after quant.    */
export const LSP_PRED_FAC_MR122 = 21299; /* MR122 LSP pred factor (0.65 Q15) */
export const AZ_SIZE = 4 * M + 4; /* Size of array of LP filters in 4 subfrs */
export const PIT_MIN_MR122 = 18; /* Minimum pitch lag (MR122 mode)           */
export const PIT_MIN = 20;       /* Minimum pitch lag (all other modes)      */
export const PIT_MAX = 143;      /* Maximum pitch lag                        */
export const L_INTERPOL = 10 + 1; /* Length of filter for interpolation      */
export const L_INTER_SRCH = 4;   /* Length of filter for CL LTP search       */
export const MU = 26214;         /* Factor for tilt compensation filter 0.8  */
export const AGC_FAC = 29491;    /* Factor for automatic gain control 0.9    */
export const L_NEXT = 40;        /* Overhead in LP analysis                  */
export const SHARPMAX = 13017;   /* Maximum value of pitch sharpening        */
export const SHARPMIN = 0;       /* Minimum value of pitch sharpening        */
export const MAX_PRM_SIZE = 57;  /* max. num. of params                      */
export const MAX_SERIAL_SIZE = 244; /* max. num. of serial bits              */
export const GP_CLIP = 15565;    /* Pitch gain clipping = 0.95               */
export const N_FRAME = 7;        /* old pitch gains in average calculation   */
export const EHF_MASK = 0x0008;  /* encoder homing frame pattern             */

/* mode.h enum Mode */
export const MR475 = 0;
export const MR515 = 1;
export const MR59 = 2;
export const MR67 = 3;
export const MR74 = 4;
export const MR795 = 5;
export const MR102 = 6;
export const MR122 = 7;
export const MRDTX = 8;
export const N_MODES = 9;

/* frame_type_3gpp.h enum Frame_Type_3GPP */
export const AMR_475 = 0;
export const AMR_515 = 1;
export const AMR_59 = 2;
export const AMR_67 = 3;
export const AMR_74 = 4;
export const AMR_795 = 5;
export const AMR_102 = 6;
export const AMR_122 = 7;
export const AMR_SID = 8;
export const GSM_EFR_SID = 9;
export const TDMA_EFR_SID = 10;
export const PDC_EFR_SID = 11;
export const FOR_FUTURE_USE1 = 12;
export const FOR_FUTURE_USE2 = 13;
export const FOR_FUTURE_USE3 = 14;
export const AMR_NO_DATA = 15;

/* frame.h enum RXFrameType */
export const RX_SPEECH_GOOD = 0;
export const RX_SPEECH_DEGRADED = 1;
export const RX_ONSET = 2;
export const RX_SPEECH_BAD = 3;
export const RX_SID_FIRST = 4;
export const RX_SID_UPDATE = 5;
export const RX_SID_BAD = 6;
export const RX_NO_DATA = 7;
export const RX_N_FRAMETYPES = 8;
