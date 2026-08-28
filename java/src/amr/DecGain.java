package amr;

/**
 * Gain and lag decoding, ported from opencore-amr 0.1.6 dec/src:
 *   d_gain_p.cpp (d_gain_pitch), d_gain_c.cpp (d_gain_code),
 *   dec_gain.cpp (Dec_gain), dec_lag3.cpp (Dec_lag3), dec_lag6.cpp (Dec_lag6)
 * (via src/dec/dec_gain.js of the JS reference port).
 */
public final class DecGain {
    private DecGain() {}

    public static final int MR475_VQ_SIZE = 256;

    /** d_gain_p.cpp d_gain_pitch: returns gain (Q14) */
    public static int d_gain_pitch(int mode, int index) {
        int gain = Tbls.qua_gain_pitch[index];
        if (mode == Cnst.MR122) {
            /* clear 2 LSBits */
            gain = (gain & 0xfffc) << 16 >> 16;
        }
        return gain;
    }

    private static final short[] dgExp = new short[1];
    private static final short[] dgFrac = new short[1];
    private static final short[] dgExpEn = new short[1];
    private static final short[] dgFracEn = new short[1];

    /**
     * d_gain_c.cpp d_gain_code (MR795/MR122).
     * @param gain_code short[1] out
     */
    public static void d_gain_code(GcPred.State pred_state, int mode, int index,
                                   short[] code, int codeOff, short[] gain_code, int[] pOverflow) {
        int gcode0;
        int L_tmp;

        /* predict codebook gain */
        GcPred.gc_pred(pred_state, mode, code, codeOff, dgExp, dgFrac, dgExpEn, dgFracEn, pOverflow);
        final int exp = dgExp[0];
        final int frac = dgFrac[0];

        index &= 31; /* index < 32, to avoid buffer overflow */
        final int tbl_tmp = index + (index << 1);
        int p = tbl_tmp; /* into qua_gain_code */

        /* Different scalings between MR122 and the other modes */
        final int temp = Basicop.sub(mode, Cnst.MR122, pOverflow);
        if (temp == 0) {
            gcode0 = (Mathops.Pow2(exp, frac, pOverflow) << 16) >> 16; /* predicted gain */
            gcode0 = Basicop.shl(gcode0, 4, pOverflow);
            gain_code[0] = (short) Basicop.shl(Basicop.mult(gcode0, Tbls.qua_gain_code[p++], pOverflow), 1, pOverflow);
        } else {
            gcode0 = (Mathops.Pow2(14, frac, pOverflow) << 16) >> 16;
            L_tmp = Basicop.L_mult(Tbls.qua_gain_code[p++], gcode0, pOverflow);
            L_tmp = Basicop.L_shr(L_tmp, Basicop.sub(9, exp, pOverflow), pOverflow);
            gain_code[0] = (short) ((L_tmp >> 16) << 16 >> 16); /* Q1 */
        }

        /* update table of past quantized energies */
        final int qua_ener_MR122 = Tbls.qua_gain_code[p++];
        final int qua_ener = Tbls.qua_gain_code[p++];
        GcPred.gc_pred_update(pred_state, qua_ener_MR122, qua_ener);
    }

    /**
     * dec_gain.cpp Dec_gain: decode pitch and codebook gains.
     * @param gain_pit short[1] out
     * @param gain_cod short[1] out
     */
    public static void Dec_gain(GcPred.State pred_state, int mode, int index, short[] code, int codeOff,
                                int evenSubfr, short[] gain_pit, short[] gain_cod, int[] pOverflow) {
        int p;
        short[] tbl;
        int g_code;
        int qua_ener;
        int qua_ener_MR122;
        int L_tmp;
        int temp1;
        int temp2;

        /* Read the quantized gains (table depends on mode) */
        index = Basicop.shl(index, 2, pOverflow);

        if (mode == Cnst.MR102 || mode == Cnst.MR74 || mode == Cnst.MR67) {
            tbl = Tbls.table_gain_highrates;
            p = index;
            gain_pit[0] = tbl[p++];
            g_code = tbl[p++];
            qua_ener_MR122 = tbl[p++];
            qua_ener = tbl[p];
        } else if (mode == Cnst.MR475) {
            index += (1 ^ evenSubfr) << 1; /* evenSubfr is 0 or 1 */
            if (index > MR475_VQ_SIZE * 4 - 2) {
                index = MR475_VQ_SIZE * 4 - 2; /* avoid possible buffer overflow */
            }
            tbl = Tbls.table_gain_MR475;
            p = index;
            gain_pit[0] = tbl[p++];
            g_code = tbl[p++];

            /* calculate predictor update values:
               qua_ener = log2(g), qua_ener_MR122 = 20*log10(g) */
            /* Log2(x Q12) = log2(x) + 12 */
            temp1 = g_code;
            Mathops.Log2(temp1, dgExp, dgFrac, pOverflow);
            final int exp475 = (dgExp[0] - 12) << 16 >> 16;
            temp1 = Basicop.shr_r(dgFrac[0], 5, pOverflow);
            temp2 = Basicop.shl(exp475, 10, pOverflow);
            qua_ener_MR122 = Basicop.add_16(temp1, temp2, pOverflow);

            /* 24660 Q12 ~= 6.0206 = 20*log10(2) */
            L_tmp = Basicop.Mpy_32_16(exp475, dgFrac[0], 24660, pOverflow);
            L_tmp = Basicop.L_shl(L_tmp, 13, pOverflow);
            qua_ener = Basicop.pv_round(L_tmp, pOverflow); /* Q12 * Q0 = Q13 -> Q10 */
        } else {
            tbl = Tbls.table_gain_lowrates;
            p = index;
            gain_pit[0] = tbl[p++];
            g_code = tbl[p++];
            qua_ener_MR122 = tbl[p++];
            qua_ener = tbl[p];
        }

        /* predict codebook gain: gcode0 (Q14) = 2^14*2^frac = gc0 * 2^(14-exp) */
        GcPred.gc_pred(pred_state, mode, code, codeOff, dgExp, dgFrac, null, null, pOverflow);
        final int gcode0 = (Mathops.Pow2(14, dgFrac[0], pOverflow) << 16) >> 16;

        L_tmp = Basicop.L_mult(g_code, gcode0, pOverflow);
        temp1 = (10 - dgExp[0]) << 16 >> 16;
        L_tmp = Basicop.L_shr(L_tmp, temp1, pOverflow);
        gain_cod[0] = (short) ((L_tmp >> 16) << 16 >> 16);

        /* update table of past quantized energies */
        GcPred.gc_pred_update(pred_state, qua_ener_MR122, qua_ener);
    }

    /**
     * dec_lag3.cpp Dec_lag3.
     * @param T0 short[1] in/out
     * @param T0_frac short[1] out
     */
    public static void Dec_lag3(int index, int t0_min, int t0_max, int i_subfr, int T0_prev,
                                short[] T0, short[] T0_frac, int flag4, int[] pOverflow) {
        int i;
        int tmp_lag;

        if (i_subfr == 0) {
            /* if 1st or 3rd subframe */
            if (index < 197) {
                tmp_lag = (index + 2) << 16 >> 16;
                tmp_lag = Basicop.mult(tmp_lag, 10923, pOverflow);
                i = (tmp_lag + 19) << 16 >> 16;
                T0[0] = (short) i;

                /* i = 3 * (*T0) */
                i = (i << 1) << 16 >> 16;
                i = (i + T0[0]) << 16 >> 16;

                tmp_lag = (index - i) << 16 >> 16;
                T0_frac[0] = (short) ((tmp_lag + 58) << 16 >> 16);
            } else {
                T0[0] = (short) ((index - 112) << 16 >> 16);
                T0_frac[0] = 0;
            }
        } else {
            /* 2nd or 4th subframe */
            if (flag4 == 0) {
                /* 'normal' decoding: either with 5 or 6 bit resolution */
                i = (index + 2) << 16 >> 16;
                i = (i * 10923 >> 15) << 16 >> 16;
                i = (i - 1) << 16 >> 16;
                T0[0] = (short) ((i + t0_min) << 16 >> 16);

                /* i = 3* (*T0) */
                i = (i + ((i << 1) << 16 >> 16)) << 16 >> 16;

                tmp_lag = (index - 2) << 16 >> 16;
                T0_frac[0] = (short) ((tmp_lag - i) << 16 >> 16);
            } else {
                /* decoding with 4 bit resolution */
                tmp_lag = T0_prev;
                i = Basicop.sub(tmp_lag, t0_min, pOverflow);
                if (i > 5) {
                    tmp_lag = (t0_min + 5) << 16 >> 16;
                }
                i = (t0_max - tmp_lag) << 16 >> 16;
                if (i > 4) {
                    tmp_lag = (t0_max - 4) << 16 >> 16;
                }

                if (index < 4) {
                    i = (tmp_lag - 5) << 16 >> 16;
                    T0[0] = (short) ((i + index) << 16 >> 16);
                    T0_frac[0] = 0;
                } else if (index < 12) {
                    /* 4 <= index < 12 */
                    i = (index - 5) << 16 >> 16;
                    i = (i * 10923 >> 15) << 16 >> 16;
                    i = (i - 1) << 16 >> 16;
                    T0[0] = (short) ((i + tmp_lag) << 16 >> 16);

                    i = (i + ((i << 1) << 16 >> 16)) << 16 >> 16;

                    tmp_lag = (index - 9) << 16 >> 16;
                    T0_frac[0] = (short) ((tmp_lag - i) << 16 >> 16);
                } else {
                    i = (index - 12) << 16 >> 16;
                    i = (i + tmp_lag) << 16 >> 16;
                    T0[0] = (short) ((i + 1) << 16 >> 16);
                    T0_frac[0] = 0;
                }
            }
        }
    }

    /**
     * dec_lag6.cpp Dec_lag6.
     * @param T0 short[1] in/out
     * @param T0_frac short[1] out
     */
    public static void Dec_lag6(int index, int pit_min, int pit_max, int i_subfr,
                                short[] T0, short[] T0_frac, int[] pOverflow) {
        int i;
        int T0_min;
        int T0_max;
        int k;

        if (i_subfr == 0) {
            /* if 1st or 3rd subframe */
            if (index < 463) {
                /* T0 = (index+5)/6 + 17 */
                i = (index + 5) << 16 >> 16;
                i = (i * 5462 >> 15) << 16 >> 16;
                i = (i + 17) << 16 >> 16;
                T0[0] = (short) i;

                /* i = 3* (*T0) */
                i = (i << 1) << 16 >> 16;
                i = (i + T0[0]) << 16 >> 16;

                /* *T0_frac = index - T0*6 + 105 */
                i = (i << 1) << 16 >> 16;
                i = (index - i) << 16 >> 16;
                T0_frac[0] = (short) ((i + 105) << 16 >> 16);
            } else {
                T0[0] = (short) ((index - 368) << 16 >> 16);
                T0_frac[0] = 0;
            }
        } else {
            /* second or fourth subframe */
            /* find T0_min and T0_max for 2nd (or 4th) subframe */
            T0_min = (T0[0] - 5) << 16 >> 16;
            if (T0_min < pit_min) {
                T0_min = pit_min;
            }
            T0_max = (T0_min + 9) << 16 >> 16;
            if (T0_max > pit_max) {
                T0_max = pit_max;
                T0_min = (T0_max - 9) << 16 >> 16;
            }

            /* i = (index+5)/6 - 1 */
            i = (index + 5) << 16 >> 16;
            i = (i * 5462 >> 15) << 16 >> 16;
            i = (i - 1) << 16 >> 16;
            T0[0] = (short) ((i + T0_min) << 16 >> 16);

            /* i = 3* (*T0) */
            i = (i + ((i << 1) << 16 >> 16)) << 16 >> 16;
            i = (i << 1) << 16 >> 16;

            k = (index - 3) << 16 >> 16;
            T0_frac[0] = (short) ((k - i) << 16 >> 16);
        }
    }
}
